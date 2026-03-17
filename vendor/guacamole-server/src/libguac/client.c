/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#include "config.h"

#include "encode-jpeg.h"
#include "encode-png.h"
#include "encode-webp.h"
#include "guacamole/mem.h"
#include "guacamole/client.h"
#include "guacamole/error.h"
#include "guacamole/layer.h"
#include "guacamole/plugin.h"
#include "guacamole/pool.h"
#include "guacamole/protocol.h"
#include "guacamole/rwlock.h"
#include "guacamole/socket.h"
#include "guacamole/stream.h"
#include "guacamole/string.h"
#include "guacamole/timestamp.h"
#include "guacamole/user.h"
#include "id.h"

#include <dlfcn.h>
#include <errno.h>
#include <inttypes.h>
#include <pthread.h>
#include <signal.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * The number of milliseconds between times that the pending users list will be
 * synchronized and emptied (250 milliseconds aka 1/4 second).
 */
#define GUAC_CLIENT_PENDING_USERS_REFRESH_INTERVAL 250

/**
 * A value that indicates that the pending users timer has yet to be
 * initialized and started.
 */
#define GUAC_CLIENT_PENDING_TIMER_UNREGISTERED 0

/**
 * A value that indicates that the pending users timer has been initialized
 * and started, but that the timer handler is not currently running.
 */
#define GUAC_CLIENT_PENDING_TIMER_REGISTERED 1

/**
 * A value that indicates that the pending users timer has been initialized
 * and started, and that the timer handler is currently running.
 */
#define GUAC_CLIENT_PENDING_TIMER_TRIGGERED 2

/**
 * Empty NULL-terminated array of argument names.
 */
const char* __GUAC_CLIENT_NO_ARGS[] = { NULL };

guac_layer __GUAC_DEFAULT_LAYER = {
    .index = 0
};

const guac_layer* GUAC_DEFAULT_LAYER = &__GUAC_DEFAULT_LAYER;

guac_layer* guac_client_alloc_layer(guac_client* client) {

    /* Init new layer */
    guac_layer* allocd_layer = guac_mem_alloc(sizeof(guac_layer));
    allocd_layer->index = guac_pool_next_int(client->__layer_pool)+1;

    return allocd_layer;

}

guac_layer* guac_client_alloc_buffer(guac_client* client) {

    /* Init new layer */
    guac_layer* allocd_layer = guac_mem_alloc(sizeof(guac_layer));
    allocd_layer->index = -guac_pool_next_int(client->__buffer_pool) - 1;

    return allocd_layer;

}

void guac_client_free_buffer(guac_client* client, guac_layer* layer) {

    /* Release index to pool */
    guac_pool_free_int(client->__buffer_pool, -layer->index - 1);

    /* Free layer */
    guac_mem_free(layer);

}

void guac_client_free_layer(guac_client* client, guac_layer* layer) {

    /* Release index to pool */
    guac_pool_free_int(client->__layer_pool, layer->index);

    /* Free layer */
    guac_mem_free(layer);

}

guac_stream* guac_client_alloc_stream(guac_client* client) {

    guac_stream* allocd_stream;
    int stream_index;

    /* Allocate stream, but refuse to allocate beyond maximum */
    stream_index = guac_pool_next_int_below(client->__stream_pool, GUAC_CLIENT_MAX_STREAMS);
    if (stream_index < 0)
        return NULL;

    /* Initialize stream with odd index (even indices are user-level) */
    allocd_stream = &(client->__output_streams[stream_index]);
    allocd_stream->index = (stream_index * 2) + 1;
    allocd_stream->data = NULL;
    allocd_stream->ack_handler = NULL;
    allocd_stream->blob_handler = NULL;
    allocd_stream->end_handler = NULL;

    return allocd_stream;

}

void guac_client_free_stream(guac_client* client, guac_stream* stream) {

    /* Mark stream as closed */
    int freed_index = stream->index;
    stream->index = GUAC_CLIENT_CLOSED_STREAM_INDEX;

    /* Release index to pool */
    guac_pool_free_int(client->__stream_pool, (freed_index - 1) / 2);

}

/**
 * Promote all pending users to full users, calling the join pending handler
 * before, if any.
 *
 * @param client
 *     The client for which all pending users should be promoted.
 */
static void guac_client_promote_pending_users(guac_client* client) {

    /* Acquire the lock for reading and modifying the list of pending users */
    guac_rwlock_acquire_write_lock(&(client->__pending_users_lock));

    /* Skip user promotion entirely if there's no pending users */
    if (client->__pending_users == NULL)
        goto promotion_complete;

    /* Run the pending join handler, if one is defined */
    if (client->join_pending_handler) {

        /* If an error occurs in the pending handler */
        if(client->join_pending_handler(client)) {

            /* Log a warning and abort the promotion of the pending users */
            guac_client_log(client, GUAC_LOG_WARNING,
                    "join_pending_handler did not successfully complete;"
                    " any pending users have not been promoted.\n");

            goto promotion_complete;
        }
    }

    /* The first pending user in the list, if any */
    guac_user* first_user = client->__pending_users;

    /* The final user in the list, if any */
    guac_user* last_user = first_user;

    /* Iterate through the pending users to find the final user */
    guac_user* user = first_user;
    while (user != NULL) {
        last_user = user;
        user = user->__next;
    }

    /* Mark the list as empty */
    client->__pending_users = NULL;

    /* Acquire the lock for reading and modifying the list of full users. */
    guac_rwlock_acquire_write_lock(&(client->__users_lock));

    /* If any users were removed from the pending list, promote them now */
    if (last_user != NULL) {

        /* Add all formerly-pending users to the start of the user list */
        if (client->__users != NULL)
            client->__users->__prev = last_user;

        last_user->__next = client->__users;
        client->__users = first_user;

    }

    guac_rwlock_release_lock(&(client->__users_lock));

promotion_complete:

    /* Release the lock (this is done AFTER updating the connected user list
     * to ensure that all users are always on exactly one of these lists) */
    guac_rwlock_release_lock(&(client->__pending_users_lock));

}

/**
 * Thread that periodically checks for users that have requested to join the
 * current connection (pending users). The check is performed every
 * GUAC_CLIENT_PENDING_USERS_REFRESH_INTERVAL milliseconds.
 *
 * @param data
 *     A pointer to the guac_client associated with the connection.
 *
 * @return
 *     Always NULL.
 */
static void* guac_client_pending_users_thread(void* data) {

    guac_client* client = (guac_client*) data;

    while (client->state == GUAC_CLIENT_RUNNING) {
        guac_client_promote_pending_users(client);
        guac_timestamp_msleep(GUAC_CLIENT_PENDING_USERS_REFRESH_INTERVAL);
    }

    return NULL;

}

guac_client* guac_client_alloc() {

    int i;

    /* Allocate new client */
    guac_client* client = guac_mem_alloc(sizeof(guac_client));
    if (client == NULL) {
        guac_error = GUAC_STATUS_NO_MEMORY;
        guac_error_message = "Could not allocate memory for client";
        return NULL;
    }

    /* Init new client */
    memset(client, 0, sizeof(guac_client));

    client->args = __GUAC_CLIENT_NO_ARGS;
    client->state = GUAC_CLIENT_RUNNING;
    client->last_sent_timestamp = guac_timestamp_current();

    /* Generate ID */
    client->connection_id = guac_generate_id(GUAC_CLIENT_ID_PREFIX);
    if (client->connection_id == NULL) {
        guac_mem_free(client);
        return NULL;
    }

    /* Allocate buffer and layer pools */
    client->__buffer_pool = guac_pool_alloc(GUAC_BUFFER_POOL_INITIAL_SIZE);
    client->__layer_pool = guac_pool_alloc(GUAC_BUFFER_POOL_INITIAL_SIZE);

    /* Allocate stream pool */
    client->__stream_pool = guac_pool_alloc(0);

    /* Initialize streams */
    client->__output_streams = guac_mem_alloc(sizeof(guac_stream), GUAC_CLIENT_MAX_STREAMS);

    for (i=0; i<GUAC_CLIENT_MAX_STREAMS; i++) {
        client->__output_streams[i].index = GUAC_CLIENT_CLOSED_STREAM_INDEX;
    }

    /* Init locks */
    guac_rwlock_init(&(client->__users_lock));
    guac_rwlock_init(&(client->__pending_users_lock));

    /* Set up broadcast sockets */
    client->socket = guac_socket_broadcast(client);
    client->pending_socket = guac_socket_broadcast_pending(client);

    return client;

}

void guac_client_free(guac_client* client) {

    /* Ensure that anything waiting for the client can begin shutting down */
    guac_client_stop(client);

    /* Acquire write locks before referencing user pointers */
    guac_rwlock_acquire_write_lock(&(client->__pending_users_lock));
    guac_rwlock_acquire_write_lock(&(client->__users_lock));

    /* Remove all pending users */
    while (client->__pending_users != NULL)
        guac_client_remove_user(client, client->__pending_users);

    /* Remove all users */
    while (client->__users != NULL)
        guac_client_remove_user(client, client->__users);

    /* Clean up the thread monitoring for new pending users, if it's been
     * started */
    if (client->__pending_users_thread_started)
        pthread_join(client->__pending_users_thread, NULL);

    /* Release the locks */
    guac_rwlock_release_lock(&(client->__users_lock));
    guac_rwlock_release_lock(&(client->__pending_users_lock));

    if (client->free_handler) {

        /* FIXME: Errors currently ignored... */
        client->free_handler(client);

    }

    /* Free sockets */
    guac_socket_free(client->socket);
    guac_socket_free(client->pending_socket);

    /* Free layer pools */
    guac_pool_free(client->__buffer_pool);
    guac_pool_free(client->__layer_pool);

    /* Free streams */
    guac_mem_free(client->__output_streams);

    /* Free stream pool */
    guac_pool_free(client->__stream_pool);

    /* Close associated plugin */
    if (client->__plugin_handle != NULL) {
        if (dlclose(client->__plugin_handle))
            guac_client_log(client, GUAC_LOG_ERROR, "Unable to close plugin: %s", dlerror());
    }

    /* Destroy the reentrant read-write locks */
    guac_rwlock_destroy(&(client->__users_lock));
    guac_rwlock_destroy(&(client->__pending_users_lock));

    guac_mem_free(client->connection_id);
    guac_mem_free(client);
}

void vguac_client_log(guac_client* client, guac_client_log_level level,
        const char* format, va_list ap) {

    /* Call handler if defined */
    if (client->log_handler != NULL)
        client->log_handler(client, level, format, ap);

}

void guac_client_log(guac_client* client, guac_client_log_level level,
        const char* format, ...) {

    va_list args;
    va_start(args, format);

    vguac_client_log(client, level, format, args);

    va_end(args);

}

void guac_client_stop(guac_client* client) {
    client->state = GUAC_CLIENT_STOPPING;
}

void vguac_client_abort(guac_client* client, guac_protocol_status status,
        const char* format, va_list ap) {

    /* Only relevant if client is running */
    if (client->state == GUAC_CLIENT_RUNNING) {

        /* Log detail of error */
        vguac_client_log(client, GUAC_LOG_ERROR, format, ap);

        /* Send error immediately, limit information given */
        guac_protocol_send_error(client->socket, "Aborted. See logs.", status);
        guac_socket_flush(client->socket);

        /* Stop client */
        guac_client_stop(client);

    }

}

void guac_client_abort(guac_client* client, guac_protocol_status status,
        const char* format, ...) {

    va_list args;
    va_start(args, format);

    vguac_client_abort(client, status, format, args);

    va_end(args);

}

/**
 * Add the provided user to the list of pending users who have yet to have
 * their connection state synchronized after joining, for the connection
 * associated with the given guac client.
 *
 * @param client
 *     The client associated with the connection for which the provided user
 *     is pending a connection state synchronization after joining.
 *
 * @param user
 *     The user to add to the pending list.
 */
static void guac_client_add_pending_user(guac_client* client,
        guac_user* user) {

    /* Acquire the lock for modifying the list of pending users */
    guac_rwlock_acquire_write_lock(&(client->__pending_users_lock));

    /* Set up the pending user promotion mutex */
    if (!client->__pending_users_thread_started) {
        pthread_create(&client->__pending_users_thread, NULL,
                guac_client_pending_users_thread, (void*) client);
        client->__pending_users_thread_started = 1;
    }

    user->__prev = NULL;
    user->__next = client->__pending_users;

    if (client->__pending_users != NULL)
        client->__pending_users->__prev = user;

    client->__pending_users = user;

    /* Increment the user count */
    client->connected_users++;

    /* Release the lock */
    guac_rwlock_release_lock(&(client->__pending_users_lock));

}

int guac_client_add_user(guac_client* client, guac_user* user, int argc, char** argv) {

    int retval = 0;

    /* Call handler, if defined */
    if (client->join_handler)
        retval = client->join_handler(user, argc, argv);

    if (retval == 0) {

        /*
         * Add the user to the list of pending users, to have their connection
         * state synchronized asynchronously.
         */
        guac_client_add_pending_user(client, user);

        /* Update owner pointer if user is owner */
        if (user->owner)
            client->__owner = user;

    }

    /* Notify owner of user joining connection. */
    if (retval == 0 && !user->owner)
        guac_client_owner_notify_join(client, user);

    return retval;

}

void guac_client_remove_user(guac_client* client, guac_user* user) {

    guac_rwlock_acquire_write_lock(&(client->__pending_users_lock));
    guac_rwlock_acquire_write_lock(&(client->__users_lock));

    /* Update prev / head */
    if (user->__prev != NULL)
        user->__prev->__next = user->__next;
    else if (client->__users == user)
        client->__users = user->__next;
    else if (client->__pending_users == user)
        client->__pending_users = user->__next;

    /* Update next */
    if (user->__next != NULL)
        user->__next->__prev = user->__prev;

    client->connected_users--;

    /* Update owner pointer if user was owner */
    if (user->owner)
        client->__owner = NULL;

    guac_rwlock_release_lock(&(client->__users_lock));
    guac_rwlock_release_lock(&(client->__pending_users_lock));

    /* Update owner of user having left the connection. */
    if (!user->owner)
        guac_client_owner_notify_leave(client, user);

    /* Call handler, if defined */
    if (user->leave_handler)
        user->leave_handler(user);
    else if (client->leave_handler)
        client->leave_handler(user);

}

void guac_client_foreach_user(guac_client* client, guac_user_callback* callback, void* data) {

    guac_user* current;

    guac_rwlock_acquire_read_lock(&(client->__users_lock));

    /* Call function on each user */
    current = client->__users;
    while (current != NULL) {
        callback(current, data);
        current = current->__next;
    }

    guac_rwlock_release_lock(&(client->__users_lock));

}

void guac_client_foreach_pending_user(
        guac_client* client, guac_user_callback* callback, void* data) {

    guac_user* current;

    guac_rwlock_acquire_read_lock(&(client->__pending_users_lock));

    /* Call function on each pending user */
    current = client->__pending_users;
    while (current != NULL) {
        callback(current, data);
        current = current->__next;
    }

    guac_rwlock_release_lock(&(client->__pending_users_lock));

}

void* guac_client_for_owner(guac_client* client, guac_user_callback* callback,
        void* data) {

    void* retval;

    guac_rwlock_acquire_read_lock(&(client->__users_lock));

    /* Invoke callback with current owner */
    retval = callback(client->__owner, data);

    guac_rwlock_release_lock(&(client->__users_lock));

    /* Return value from callback */
    return retval;

}

void* guac_client_for_user(guac_client* client, guac_user* user,
        guac_user_callback* callback, void* data) {

    guac_user* current;

    int user_valid = 0;
    void* retval;

    guac_rwlock_acquire_read_lock(&(client->__users_lock));

    /* Loop through all users, searching for a pointer to the given user */
    current = client->__users;
    while (current != NULL) {

        /* If the user's pointer exists in the list, they are indeed valid */
        if (current == user) {
            user_valid = 1;
            break;
        }

        current = current->__next;
    }

    /* Use NULL if user does not actually exist */
    if (!user_valid)
        user = NULL;

    /* Invoke callback with requested user (if they exist) */
    retval = callback(user, data);

    guac_rwlock_release_lock(&(client->__users_lock));

    /* Return value from callback */
    return retval;

}

int guac_client_end_frame(guac_client* client) {
    return guac_client_end_multiple_frames(client, 0);
}

int guac_client_end_multiple_frames(guac_client* client, int frames) {

    /* Update and send timestamp */
    client->last_sent_timestamp = guac_timestamp_current();

    /* Log received timestamp and calculated lag (at TRACE level only) */
    guac_client_log(client, GUAC_LOG_TRACE, "Server completed "
            "frame %" PRIu64 "ms (%i logical frames)", client->last_sent_timestamp, frames);

    return guac_protocol_send_sync(client->socket, client->last_sent_timestamp, frames);

}

int guac_client_load_plugin(guac_client* client, const char* protocol) {

    /* Reference to dlopen()'d plugin */
    void* client_plugin_handle;

    /* Pluggable client */
    char protocol_lib[GUAC_PROTOCOL_LIBRARY_LIMIT] =
        GUAC_PROTOCOL_LIBRARY_PREFIX;

    /* Type-pun for the sake of dlsym() - cannot typecast a void* to a function
     * pointer otherwise */ 
    union {
        guac_client_init_handler* client_init;
        void* obj;
    } alias;

    /* Add protocol and .so suffix to protocol_lib */
    guac_strlcat(protocol_lib, protocol, sizeof(protocol_lib));
    if (guac_strlcat(protocol_lib, GUAC_PROTOCOL_LIBRARY_SUFFIX,
                sizeof(protocol_lib)) >= sizeof(protocol_lib)) {
        guac_error = GUAC_STATUS_NO_MEMORY;
        guac_error_message = "Protocol name is too long";
        return -1;
    }

    /* Load client plugin */
    client_plugin_handle = dlopen(protocol_lib, RTLD_LAZY);
    if (!client_plugin_handle) {
        guac_error = GUAC_STATUS_NOT_FOUND;
        guac_error_message = dlerror();
        return -1;
    }

    dlerror(); /* Clear errors */

    /* Get init function */
    alias.obj = dlsym(client_plugin_handle, "guac_client_init");

    /* Fail if cannot find guac_client_init */
    if (dlerror() != NULL) {
        guac_error = GUAC_STATUS_INTERNAL_ERROR;
        guac_error_message = dlerror();
        dlclose(client_plugin_handle);
        return -1;
    }

    /* Init client */
    client->__plugin_handle = client_plugin_handle;

    return alias.client_init(client);

}

/**
 * A callback function which is invoked by guac_client_owner_send_required() to
 * send the required parameters to the specified user, who is the owner of the
 * client session.
 * 
 * @param user
 *     The guac_user that will receive the required parameters, who is the owner
 *     of the client.
 * 
 * @param data
 *     A pointer to a NULL-terminated array of required parameters that will be
 *     passed on to the owner to continue the connection.
 * 
 * @return
 *     Zero if the operation succeeds or non-zero on failure, cast as a void*.
 */
static void* guac_client_owner_send_required_callback(guac_user* user, void* data) {
    
    const char** required = (const char **) data;
    
    /* Send required parameters to owner. */
    if (user != NULL)
        return (void*) ((intptr_t) guac_protocol_send_required(user->socket, required));
    
    return (void*) ((intptr_t) -1);
    
}

int guac_client_owner_send_required(guac_client* client, const char** required) {

    /* Don't send required instruction if client does not support it. */
    if (!guac_client_owner_supports_required(client))
        return -1;
    
    return (int) ((intptr_t) guac_client_for_owner(client, guac_client_owner_send_required_callback, required));

}

/**
 * Updates the provided approximate processing lag, taking into account the
 * processing lag of the given user.
 *
 * @param user
 *     The guac_user to use to update the approximate processing lag.
 *
 * @param data
 *     Pointer to an int containing the current approximate processing lag.
 *     The int will be updated according to the processing lag of the given
 *     user.
 *
 * @return
 *     Always NULL.
 */
static void* __calculate_lag(guac_user* user, void* data) {

    int* processing_lag = (int*) data;

    /* Simply find maximum */
    if (user->processing_lag > *processing_lag)
        *processing_lag = user->processing_lag;

    return NULL;

}

int guac_client_get_processing_lag(guac_client* client) {

    int processing_lag = 0;

    /* Approximate the processing lag of all users */
    guac_client_foreach_user(client, __calculate_lag, &processing_lag);

    return processing_lag;

}

void guac_client_stream_argv(guac_client* client, guac_socket* socket,
        const char* mimetype, const char* name, const char* value) {

    /* Allocate new stream for argument value */
    guac_stream* stream = guac_client_alloc_stream(client);

    /* Declare stream as containing connection parameter data */
    guac_protocol_send_argv(socket, stream, mimetype, name);

    /* Write parameter data */
    guac_protocol_send_blobs(socket, stream, value, strlen(value));

    /* Terminate stream */
    guac_protocol_send_end(socket, stream);

    /* Free allocated stream */
    guac_client_free_stream(client, stream);

}

void guac_client_stream_png(guac_client* client, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface) {

    /* Allocate new stream for image */
    guac_stream* stream = guac_client_alloc_stream(client);

    /* Declare stream as containing image data */
    guac_protocol_send_img(socket, stream, mode, layer, "image/png", x, y);

    /* Write PNG data */
    guac_png_write(socket, stream, surface);

    /* Terminate stream */
    guac_protocol_send_end(socket, stream);

    /* Free allocated stream */
    guac_client_free_stream(client, stream);

}

void guac_client_stream_jpeg(guac_client* client, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface, int quality) {

    /* Allocate new stream for image */
    guac_stream* stream = guac_client_alloc_stream(client);

    /* Declare stream as containing image data */
    guac_protocol_send_img(socket, stream, mode, layer, "image/jpeg", x, y);

    /* Write JPEG data */
    guac_jpeg_write(socket, stream, surface, quality);

    /* Terminate stream */
    guac_protocol_send_end(socket, stream);

    /* Free allocated stream */
    guac_client_free_stream(client, stream);

}

void guac_client_stream_webp(guac_client* client, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface, int quality, int lossless) {

#ifdef ENABLE_WEBP
    /* Allocate new stream for image */
    guac_stream* stream = guac_client_alloc_stream(client);

    /* Declare stream as containing image data */
    guac_protocol_send_img(socket, stream, mode, layer, "image/webp", x, y);

    /* Write WebP data */
    guac_webp_write(socket, stream, surface, quality, lossless);

    /* Terminate stream */
    guac_protocol_send_end(socket, stream);

    /* Free allocated stream */
    guac_client_free_stream(client, stream);
#else
    /* Do nothing if WebP support is not built in */
#endif

}

#ifdef ENABLE_WEBP
/**
 * Callback which is invoked by guac_client_supports_webp() for each user
 * associated with the given client, thus updating an overall support flag
 * describing the WebP support state for the client as a whole.
 *
 * @param user
 *     The user to check for WebP support.
 *
 * @param data
 *     Pointer to an int containing the current WebP support status for the
 *     client associated with the given user. This flag will be 0 if any user
 *     already checked has lacked WebP support, or 1 otherwise.
 *
 * @return
 *     Always NULL.
 */
static void* __webp_support_callback(guac_user* user, void* data) {

    int* webp_supported = (int*) data;

    /* Check whether current user supports WebP */
    if (*webp_supported)
        *webp_supported = guac_user_supports_webp(user);

    return NULL;

}
#endif

/**
 * A callback function which is invoked by guac_client_owner_supports_msg()
 * to determine if the owner of a client supports the "msg" instruction,
 * returning zero if the user does not support the instruction or non-zero if
 * the user supports it.
 * 
 * @param user
 *     The guac_user that will be checked for "msg" instruction support.
 * 
 * @param data
 *     Data provided to the callback. This value is never used within this
 *     callback.
 * 
 * @return
 *     A non-zero integer if the provided user who owns the connection supports
 *     the "msg" instruction, or zero if the user does not. The integer is cast
 *     as a void*.
 */
static void* guac_owner_supports_msg_callback(guac_user* user, void* data) {

    return (void*) ((intptr_t) guac_user_supports_msg(user));

}

int guac_client_owner_supports_msg(guac_client* client) {

    return (int) ((intptr_t) guac_client_for_owner(client, guac_owner_supports_msg_callback, NULL));

}

/**
 * A callback function which is invoked by guac_client_owner_supports_required()
 * to determine if the owner of a client supports the "required" instruction,
 * returning zero if the user does not support the instruction or non-zero if
 * the user supports it.
 * 
 * @param user
 *     The guac_user that will be checked for "required" instruction support.
 * 
 * @param data
 *     Data provided to the callback. This value is never used within this
 *     callback.
 * 
 * @return
 *     A non-zero integer if the provided user who owns the connection supports
 *     the "required" instruction, or zero if the user does not. The integer
 *     is cast as a void*.
 */
static void* guac_owner_supports_required_callback(guac_user* user, void* data) {
    
    return (void*) ((intptr_t) guac_user_supports_required(user));
    
}

int guac_client_owner_supports_required(guac_client* client) {
    
    return (int) ((intptr_t) guac_client_for_owner(client, guac_owner_supports_required_callback, NULL));
    
}

/**
 * A callback function that is invoked by guac_client_owner_notify_join() to
 * notify the owner of a connection that another user has joined the
 * connection, returning zero if the message is sent successfully, or non-zero
 * if an error occurs.
 *
 * @param user
 *     The user to send the notification to, which will be the owner of the
 *     connection.
 *
 * @param data
 *     The data provided to the callback, which is the user that is joining the
 *     connection.
 *
 * @return
 *     Zero if the message is sent successfully to the owner, otherwise
 *     non-zero, cast as a void*.
 */
static void* guac_client_owner_notify_join_callback(guac_user* user, void* data) {

    const guac_user* joiner = (const guac_user *) data;

    if (user == NULL)
        return (void*) ((intptr_t) -1);

    char* log_owner = "owner";
    if (user->info.name != NULL)
        log_owner = (char *) user->info.name;

    char* log_joiner = "anonymous";
    char* send_joiner = "";
    if (joiner->info.name != NULL) {
        log_joiner = (char *) joiner->info.name;
        send_joiner = (char *) joiner->info.name;
    }

    guac_user_log(user, GUAC_LOG_DEBUG, "Notifying owner \"%s\" of \"%s\" joining.",
            log_owner, log_joiner);
    
    /* Send user joined notification to owner. */
    const char* args[] = { (const char*)joiner->user_id, (const char*)send_joiner, NULL };
    return (void*) ((intptr_t) guac_protocol_send_msg(user->socket, GUAC_MESSAGE_USER_JOINED, args));

}

int guac_client_owner_notify_join(guac_client* client, guac_user* joiner) {

    /* Don't send msg instruction if client does not support it. */
    if (!guac_client_owner_supports_msg(client)) {
        guac_client_log(client, GUAC_LOG_DEBUG,
                        "Client does not support the \"msg\" instruction and "
                        "will not be notified of the user joining the connection.");
        return -1;
    }

    return (int) ((intptr_t) guac_client_for_owner(client, guac_client_owner_notify_join_callback, joiner));

}

/**
 * A callback function that is invoked by guac_client_owner_notify_leave() to
 * notify the owner of a connection that another user has left the connection,
 * returning zero if the message is sent successfully, or non-zero
 * if an error occurs.
 *
 * @param user
 *     The user to send the notification to, which will be the owner of the
 *     connection.
 *
 * @param data
 *     The data provided to the callback, which is the user that is leaving the
 *     connection.
 *
 * @return
 *     Zero if the message is sent successfully to the owner, otherwise
 *     non-zero, cast as a void*.
 */
static void* guac_client_owner_notify_leave_callback(guac_user* user, void* data) {

    const guac_user* quitter = (const guac_user *) data;

    if (user == NULL)
        return (void*) ((intptr_t) -1);

    char* log_owner = "owner";
    if (user->info.name != NULL)
        log_owner = (char *) user->info.name;

    char* log_quitter = "anonymous";
    char* send_quitter = "";
    if (quitter->info.name != NULL) {
        log_quitter = (char *) quitter->info.name;
        send_quitter = (char *) quitter->info.name;
    }

    guac_user_log(user, GUAC_LOG_DEBUG, "Notifying owner \"%s\" of \"%s\" leaving.",
            log_owner, log_quitter);
    
    /* Send user left notification to owner. */
    const char* args[] = { (const char*)quitter->user_id, (const char*)send_quitter, NULL };
    return (void*) ((intptr_t) guac_protocol_send_msg(user->socket, GUAC_MESSAGE_USER_LEFT, args));

}

int guac_client_owner_notify_leave(guac_client* client, guac_user* quitter) {

    /* Don't send msg instruction if client does not support it. */
    if (!guac_client_owner_supports_msg(client)) {
        guac_client_log(client, GUAC_LOG_DEBUG,
                        "Client does not support the \"msg\" instruction and "
                        "will not be notified of the user leaving the connection.");
        return -1;
    }

    return (int) ((intptr_t) guac_client_for_owner(client, guac_client_owner_notify_leave_callback, quitter));

}

int guac_client_supports_webp(guac_client* client) {

#ifdef ENABLE_WEBP
    int webp_supported = 1;

    /* WebP is supported for entire client only if each user supports it */
    guac_client_foreach_user(client, __webp_support_callback, &webp_supported);

    return webp_supported;
#else
    /* Support for WebP is completely absent */
    return 0;
#endif

}

