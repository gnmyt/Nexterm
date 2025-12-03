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

#ifndef _GUAC_CLIENT_H
#define _GUAC_CLIENT_H

/**
 * Functions and structure contents for the Guacamole proxy client.
 *
 * @file client.h
 */

#include "client-fntypes.h"
#include "client-types.h"
#include "client-constants.h"
#include "layer-types.h"
#include "object-types.h"
#include "pool-types.h"
#include "rwlock.h"
#include "socket-types.h"
#include "stream-types.h"
#include "timestamp-types.h"
#include "user-fntypes.h"
#include "user-types.h"

#include <cairo/cairo.h>

#include <pthread.h>
#include <stdarg.h>
#include <time.h>

struct guac_client {

    /**
     * The guac_socket structure to be used to communicate with all non-pending
     * connected web-clients (users). Unlike the user-level guac_socket, this
     * guac_socket will broadcast instructions to all non-pending connected users
     * simultaneously. It is expected that the implementor of any Guacamole proxy
     * client will provide their own mechanism of I/O for their protocol. The
     * guac_socket structure is used only to communicate conveniently with the
     * Guacamole web-client.
     */
    guac_socket* socket;

    /**
     * The guac_socket structure to be used to communicate with all pending
     * connected web-clients (users). Aside from operating on a different
     * subset of users, this socket has all the same behavior and semantics as
     * the non-pending socket.
     */
    guac_socket* pending_socket;

    /**
     * The current state of the client. When the client is first allocated,
     * this will be initialized to GUAC_CLIENT_RUNNING. It will remain at
     * GUAC_CLIENT_RUNNING until an event occurs which requires the client to
     * shutdown, at which point the state becomes GUAC_CLIENT_STOPPING.
     */
    guac_client_state state;

    /**
     * Arbitrary reference to proxy client-specific data. Implementors of a
     * Guacamole proxy client can store any data they want here, which can then
     * be retrieved as necessary in the message handlers.
     */
    void* data;

    /**
     * The time (in milliseconds) that the last sync message was sent to the
     * client.
     */
    guac_timestamp last_sent_timestamp;

    /**
     * Handler for freeing data when the client is being unloaded.
     *
     * This handler will be called when the client needs to be unloaded
     * by the proxy, and any data allocated by the proxy client should be
     * freed.
     *
     * Note that this handler will NOT be called if the client's
     * guac_client_init() function fails.
     *
     * Implement this handler if you store data inside the client.
     *
     * Example:
     * @code
     *     int free_handler(guac_client* client);
     *
     *     int guac_client_init(guac_client* client) {
     *         client->free_handler = free_handler;
     *     }
     * @endcode
     */
    guac_client_free_handler* free_handler;

    /**
     * Logging handler. This handler will be called via guac_client_log() when
     * the client needs to log messages of any type.
     *
     * In general, only programs loading the client should implement this
     * handler, as those are the programs that would provide the logging
     * facilities.
     *
     * Client implementations should expect these handlers to already be
     * set.
     *
     * Example:
     * @code
     *     void log_handler(guac_client* client, guac_client_log_level level, const char* format, va_list args);
     *
     *     void function_of_daemon() {
     *
     *         guac_client* client = [pass log_handler to guac_client_plugin_get_client()];
     *
     *     }
     * @endcode
     */
    guac_client_log_handler* log_handler;

    /**
     * Pool of buffer indices. Buffers are simply layers with negative indices.
     * Note that because guac_pool always gives non-negative indices starting
     * at 0, the output of this guac_pool will be adjusted.
     */
    guac_pool* __buffer_pool;

    /**
     * Pool of layer indices. Note that because guac_pool always gives
     * non-negative indices starting at 0, the output of this guac_pool will
     * be adjusted.
     */
    guac_pool* __layer_pool;

    /**
     * Pool of stream indices.
     */
    guac_pool* __stream_pool;

    /**
     * All available client-level output streams (data going to all connected
     * users).
     */
    guac_stream* __output_streams;

    /**
     * The unique identifier allocated for the connection, which may
     * be used within the Guacamole protocol to refer to this connection.
     * This identifier is guaranteed to be unique from all existing
     * connections and will not collide with any available protocol
     * names.
     */
    char* connection_id;

    /**
     * Lock which is acquired when the users list is being manipulated, or when
     * the users list is being iterated.
     */
    guac_rwlock __users_lock;

    /**
     * The first user within the list of all connected users, or NULL if no
     * users are currently connected.
     */
    guac_user* __users;

    /**
     * Lock which is acquired when the pending users list is being manipulated,
     * or iterated, or when checking/altering the
     * __pending_users_thread_started flag.
     */
    guac_rwlock __pending_users_lock;

    /**
     * A timer that will periodically synchronize the list of pending users,
     * emptying the list once synchronization is complete. Only for internal
     * use within the client. This will be NULL until the first user joins
     * the connection, as it is lazily instantiated at that time.
     */
    pthread_t __pending_users_thread;

    /**
     * Whether the pending users thread has started for this guac_client. The
     * __pending_users_lock must be acquired before checking or altering this
     * value.
     */
    int __pending_users_thread_started;

    /**
     * The first user within the list of connected users who have not yet had
     * their connection states synchronized after joining.
     */
    guac_user* __pending_users;

    /**
     * The user that first created this connection. This user will also have
     * their "owner" flag set to a non-zero value. If the owner has left the
     * connection, this will be NULL.
     */
    guac_user* __owner;

    /**
     * The number of currently-connected users. This value may include inactive
     * users if cleanup of those users has not yet finished.
     */
    int connected_users;

    /**
     * Handler for join events, called whenever a new user is joining an active
     * connection. Note that because users may leave the connection at any
     * time, a reference to a guac_user can become invalid at any time and
     * should never be maintained outside the scope of a function invoked by
     * libguac to which that guac_user was passed (the scope in which the
     * guac_user reference is guaranteed to be valid) UNLESS that reference is
     * properly invalidated within the leave_handler.
     *
     * The handler is given a pointer to a newly-allocated guac_user which
     * must then be initialized, if needed.
     *
     * Example:
     * @code
     *     int join_handler(guac_user* user, int argc, char** argv);
     *
     *     int guac_client_init(guac_client* client) {
     *         client->join_handler = join_handler;
     *     }
     * @endcode
     */
    guac_user_join_handler* join_handler;

    /**
     * A handler that will be run prior to pending users being promoted to full
     * users. Any required pending user operations should be performed using
     * the client's pending user socket.
     *
     * Example:
     * @code
     *     int join_pending_handler(guac_client* client);
     *
     *     int guac_client_init(guac_client* client) {
     *         client->join_pending_handler = join_pending_handler;
     *     }
     * @endcode
     */
    guac_client_join_pending_handler* join_pending_handler;

    /**
     * Handler for leave events, called whenever a new user is leaving an
     * active connection.
     *
     * The handler is given a pointer to the leaving guac_user whose custom
     * data and associated resources must now be freed, if any.
     *
     * Example:
     * @code
     *     int leave_handler(guac_user* user);
     *
     *     int guac_client_init(guac_client* client) {
     *         client->leave_handler = leave_handler;
     *     }
     * @endcode
     */
    guac_user_leave_handler* leave_handler;

    /**
     * NULL-terminated array of all arguments accepted by this client , in
     * order. New users will specify these arguments when they join the
     * connection, and the values of those arguments will be made available to
     * the function initializing newly-joined users.
     *
     * The guac_client_init entry point is expected to initialize this, if
     * arguments are expected.
     *
     * Example:
     * @code
     *     const char* __my_args[] = {
     *         "hostname",
     *         "port",
     *         "username",
     *         "password",
     *         NULL
     *     };
     *
     *     int guac_client_init(guac_client* client) {
     *         client->args = __my_args;
     *     }
     * @endcode
     */
    const char** args;

    /**
     * Handle to the dlopen()'d plugin, which should be given to dlclose() when
     * this client is freed. This is only assigned if guac_client_load_plugin()
     * is used.
     */
    void* __plugin_handle;

};

/**
 * Returns a new, barebones guac_client. This new guac_client has no handlers
 * set, but is otherwise usable.
 *
 * @return A pointer to the new client.
 */
guac_client* guac_client_alloc();

/**
 * Free all resources associated with the given client.
 *
 * @param client The proxy client to free all resources of.
 */
void guac_client_free(guac_client* client);

/**
 * Writes a message in the log used by the given client. The logger used will
 * normally be defined by guacd (or whichever program loads the proxy client)
 * by setting the logging handlers of the client when it is loaded.
 *
 * @param client The proxy client logging this message.
 * @param level The level at which to log this message.
 * @param format A printf-style format string to log.
 * @param ... Arguments to use when filling the format string for printing.
 */
void guac_client_log(guac_client* client, guac_client_log_level level,
        const char* format, ...);

/**
 * Writes a message in the log used by the given client. The logger used will
 * normally be defined by guacd (or whichever program loads the proxy client)
 * by setting the logging handlers of the client when it is loaded.
 *
 * @param client The proxy client logging this message.
 * @param level The level at which to log this message.
 * @param format A printf-style format string to log.
 * @param ap The va_list containing the arguments to be used when filling the
 *           format string for printing.
 */
void vguac_client_log(guac_client* client, guac_client_log_level level,
        const char* format, va_list ap);

/**
 * Signals the given client to stop gracefully. This is a completely
 * cooperative signal, and can be ignored by the client or the hosting
 * daemon.
 *
 * @param client The proxy client to signal to stop.
 */
void guac_client_stop(guac_client* client);

/**
 * Signals the given client to stop gracefully, while also signalling via the
 * Guacamole protocol that an error has occurred. Note that this is a completely
 * cooperative signal, and can be ignored by the client or the hosting
 * daemon. The message given will be logged to the system logs.
 *
 * @param client The proxy client to signal to stop.
 * @param status The status to send over the Guacamole protocol.
 * @param format A printf-style format string to log.
 * @param ... Arguments to use when filling the format string for printing.
 */
void guac_client_abort(guac_client* client, guac_protocol_status status,
        const char* format, ...);

/**
 * Signals the given client to stop gracefully, while also signalling via the
 * Guacamole protocol that an error has occurred. Note that this is a completely
 * cooperative signal, and can be ignored by the client or the hosting
 * daemon. The message given will be logged to the system logs.
 *
 * @param client The proxy client to signal to stop.
 * @param status The status to send over the Guacamole protocol.
 * @param format A printf-style format string to log.
 * @param ap The va_list containing the arguments to be used when filling the
 *           format string for printing.
 */
void vguac_client_abort(guac_client* client, guac_protocol_status status,
        const char* format, va_list ap);

/**
 * Allocates a new buffer (invisible layer). An arbitrary index is
 * automatically assigned if no existing buffer is available for use.
 *
 * @param client The proxy client to allocate the buffer for.
 * @return The next available buffer, or a newly allocated buffer.
 */
guac_layer* guac_client_alloc_buffer(guac_client* client);

/**
 * Allocates a new layer. An arbitrary index is automatically assigned
 * if no existing layer is available for use.
 *
 * @param client The proxy client to allocate the layer buffer for.
 * @return The next available layer, or a newly allocated layer.
 */
guac_layer* guac_client_alloc_layer(guac_client* client);

/**
 * Returns the given buffer to the pool of available buffers, such that it
 * can be reused by any subsequent call to guac_client_allow_buffer().
 *
 * @param client The proxy client to return the buffer to.
 * @param layer The buffer to return to the pool of available buffers.
 */
void guac_client_free_buffer(guac_client* client, guac_layer* layer);

/**
 * Returns the given layer to the pool of available layers, such that it
 * can be reused by any subsequent call to guac_client_allow_layer().
 *
 * @param client The proxy client to return the layer to.
 * @param layer The buffer to return to the pool of available layer.
 */
void guac_client_free_layer(guac_client* client, guac_layer* layer);

/**
 * Allocates a new stream. An arbitrary index is automatically assigned
 * if no previously-allocated stream is available for use.
 *
 * @param client
 *     The client to allocate the stream for.
 *
 * @return
 *     The next available stream, or a newly allocated stream, or NULL if the
 *     maximum number of active streams has been reached.
 */
guac_stream* guac_client_alloc_stream(guac_client* client);

/**
 * Returns the given stream to the pool of available streams, such that it
 * can be reused by any subsequent call to guac_client_alloc_stream().
 *
 * @param client
 *     The client to return the stream to.
 *
 * @param stream
 *     The stream to return to the pool of available stream.
 */
void guac_client_free_stream(guac_client* client, guac_stream* stream);

/**
 * Adds the given user to the internal list of connected users. Future writes
 * to the broadcast socket stored within guac_client will also write to this
 * user. The join handler of this guac_client will be called.
 *
 * @param client The proxy client to add the user to.
 * @param user The user to add.
 * @param argc The number of arguments to pass to the new user.
 * @param argv An array of strings containing the argument values being passed.
 * @return Zero if the user was added successfully, non-zero if the user could
 *         not join the connection.
 */
int guac_client_add_user(guac_client* client, guac_user* user, int argc, char** argv);

/**
 * Removes the given user, removing the user from the internally-tracked list
 * of connected users, and calling any appropriate leave handler.
 *
 * @param client The proxy client to return the buffer to.
 * @param user The user to remove.
 */
void guac_client_remove_user(guac_client* client, guac_user* user);

/**
 * Calls the given function on all currently-connected users of the given
 * client. The function will be given a reference to a guac_user and the
 * specified arbitrary data. The value returned by the callback will be
 * ignored.
 *
 * This function is reentrant, but the user list MUST NOT be manipulated
 * within the same thread as a callback to this function. Though the callback
 * MAY invoke guac_client_foreach_user(), doing so should not be necessary, and
 * may indicate poor design choices.
 *
 * @param client
 *     The client whose users should be iterated.
 *
 * @param callback
 *     The function to call for each user.
 *
 * @param data
 *     Arbitrary data to pass to the callback each time it is invoked.
 */
void guac_client_foreach_user(guac_client* client,
        guac_user_callback* callback, void* data);

/**
 * Calls the given function on all pending users of the given client. The
 * function will be given a reference to a guac_user and the specified
 * arbitrary data. The value returned by the callback will be ignored.
 *
 * This function is reentrant, but the pending user list MUST NOT be manipulated
 * within the same thread as a callback to this function.
 *
 * @param client
 *     The client whose users should be iterated.
 *
 * @param callback
 *     The function to call for each pending user.
 *
 * @param data
 *     Arbitrary data to pass to the callback each time it is invoked.
 */
void guac_client_foreach_pending_user(guac_client* client,
        guac_user_callback* callback, void* data);

/**
 * Calls the given function with the currently-connected user that is marked as
 * the owner. The owner of a connection is the user that established the
 * initial connection that created the connection (the first user to connect
 * and join). The function will be given a reference to the guac_user and the
 * specified arbitrary data. If the owner has since left the connection, the
 * function will instead be invoked with NULL as the guac_user. The value
 * returned by the callback will be returned by this function.
 *
 * This function is reentrant, but the user list MUST NOT be manipulated
 * within the same thread as a callback to this function.
 *
 * @param client
 *     The client to retrieve the owner from.
 *
 * @param callback
 *     The callback to invoke on the user marked as the owner of the
 *     connection. NULL will be passed to this callback instead if there is no
 *     owner.
 *
 * @param data
 *     Arbitrary data to pass to the given callback.
 *
 * @return
 *     The value returned by the callback.
 */
void* guac_client_for_owner(guac_client* client, guac_user_callback* callback,
        void* data);

/**
 * Calls the given function with the given user ONLY if they are currently
 * connected. The function will be given a reference to the guac_user and the
 * specified arbitrary data. If the provided user doesn't exist or has since
 * left the connection, the function will instead be invoked with NULL as the
 * guac_user. The value returned by the callback will be returned by this
 * function.
 *
 * This function is reentrant, but the user list MUST NOT be manipulated
 * within the same thread as a callback to this function.
 *
 * @param client
 *     The client that the given user is expected to be associated with.
 *
 * @param user
 *     The user to provide to the given callback if valid. The pointer need not
 *     even point to properly allocated memory; the user will only be passed to
 *     the callback function if they are valid, and the provided user pointer
 *     will not be dereferenced during this process.
 *
 * @param callback
 *     The callback to invoke on the given user if they are valid. NULL will be
 *     passed to this callback instead if the user is not valid.
 *
 * @param data
 *     Arbitrary data to pass to the given callback.
 *
 * @return
 *     The value returned by the callback.
 */
void* guac_client_for_user(guac_client* client, guac_user* user,
        guac_user_callback* callback, void* data);

/**
 * Marks the end of the current frame by sending a "sync" instruction to all
 * connected users, where the number of input frames that were considered in
 * creating this frame is either unknown or inapplicable. This instruction will
 * contain the current timestamp. The last_sent_timestamp member of guac_client
 * will be updated accordingly.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param client
 *     The guac_client which has finished a frame.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_client_end_frame(guac_client* client);

/**
 * Marks the end of the current frame by sending a "sync" instruction to all
 * connected users, where that frame may combine or otherwise represent the
 * changes of an arbitrary number of input frames. This instruction will
 * contain the current timestamp, as well as the number of frames that were
 * considered in creating that frame.  The last_sent_timestamp member of
 * guac_client will be updated accordingly.
 *
 * If an error occurs sending the instruction, a non-zero value is
 * returned, and guac_error is set appropriately.
 *
 * @param client
 *     The guac_client which has finished a frame.
 *
 * @param frames
 *     The number of distinct frames that were considered or combined when
 *     generating the current frame, or zero if the boundaries of relevant
 *     frames are unknown.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
int guac_client_end_multiple_frames(guac_client* client, int frames);

/**
 * Initializes the given guac_client using the initialization routine provided
 * by the plugin corresponding to the named protocol. This will automatically
 * invoke guac_client_init within the plugin for the given protocol.
 *
 * Note that the connection will likely not be established until the first
 * user (the "owner") is added to the client.
 *
 * @param client The guac_client to initialize.
 * @param protocol The name of the protocol to use.
 * @return Zero if initialization was successful, non-zero otherwise.
 */
int guac_client_load_plugin(guac_client* client, const char* protocol);

/**
 * Calculates and returns the approximate processing lag experienced by the
 * pool of users. The processing lag is the difference in time between server
 * and client due purely to data processing and excluding network delays.
 *
 * @param client
 *     The guac_client to calculate the processing lag of.
 *
 * @return
 *     The approximate processing lag of the pool of users associated with the
 *     given guac_client, in milliseconds.
 */
int guac_client_get_processing_lag(guac_client* client);

/**
 * Sends a request to the owner of the given guac_client for parameters required
 * to continue the connection started by the client. The function returns zero
 * on success or non-zero on failure.
 * 
 * @param client
 *     The client where additional connection parameters are required.
 * 
 * @param required
 *     The NULL-terminated array of required parameters.
 * 
 * @return
 *     Zero on success, non-zero on failure.
 */
int guac_client_owner_send_required(guac_client* client, const char** required);

/**
 * Streams the given connection parameter value over an argument value stream
 * ("argv" instruction), exposing the current value of the named connection
 * parameter to all users of the given client. The argument value stream will
 * be automatically allocated and freed.
 *
 * @param client
 *     The Guacamole client for which the argument value stream should be
 *     allocated.
 *
 * @param socket
 *     The socket over which instructions associated with the argument value
 *     stream should be sent.
 *
 * @param mimetype
 *     The mimetype of the data within the connection parameter value being
 *     sent.
 *
 * @param name
 *     The name of the connection parameter being sent.
 *
 * @param value
 *     The current value of the connection parameter being sent.
 */
void guac_client_stream_argv(guac_client* client, guac_socket* socket,
        const char* mimetype, const char* name, const char* value);

/**
 * Streams the image data of the given surface over an image stream ("img"
 * instruction) as PNG-encoded data. The image stream will be automatically
 * allocated and freed.
 *
 * @param client
 *     The Guacamole client for which the image stream should be allocated.
 *
 * @param socket
 *     The socket over which instructions associated with the image stream
 *     should be sent.
 *
 * @param mode
 *     The composite mode to use when rendering the image over the given layer.
 *
 * @param layer
 *     The destination layer.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param surface
 *     A Cairo surface containing the image data to be streamed.
 */
void guac_client_stream_png(guac_client* client, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface);

/**
 * Streams the image data of the given surface over an image stream ("img"
 * instruction) as JPEG-encoded data at the given quality. The image stream
 * will be automatically allocated and freed.
 *
 * @param client
 *     The Guacamole client for which the image stream should be allocated.
 *
 * @param socket
 *     The socket over which instructions associated with the image stream
 *     should be sent.
 *
 * @param mode
 *     The composite mode to use when rendering the image over the given layer.
 *
 * @param layer
 *     The destination layer.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param surface
 *     A Cairo surface containing the image data to be streamed.
 *
 * @param quality
 *     The JPEG image quality, which must be an integer value between 0 and 100
 *     inclusive. Larger values indicate improving quality at the expense of
 *     larger file size.
 */
void guac_client_stream_jpeg(guac_client* client, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface, int quality);

/**
 * Streams the image data of the given surface over an image stream ("img"
 * instruction) as WebP-encoded data at the given quality. The image stream
 * will be automatically allocated and freed. If the server does not support
 * WebP, this function has no effect, so be sure to check the result of
 * guac_client_supports_webp() prior to calling this function.
 *
 * @param client
 *     The Guacamole client for whom the image stream should be allocated.
 *
 * @param socket
 *     The socket over which instructions associated with the image stream
 *     should be sent.
 *
 * @param mode
 *     The composite mode to use when rendering the image over the given layer.
 *
 * @param layer
 *     The destination layer.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the destination rectangle
 *     within the given layer.
 *
 * @param surface
 *     A Cairo surface containing the image data to be streamed.
 *
 * @param quality
 *     The WebP image quality, which must be an integer value between 0 and 100
 *     inclusive. For lossy images, larger values indicate improving quality at
 *     the expense of larger file size. For lossless images, this dictates the
 *     quality of compression, with larger values producing smaller files at
 *     the expense of speed.
 *
 * @param lossless
 *     Zero to encode a lossy image, non-zero to encode losslessly.
 */
void guac_client_stream_webp(guac_client* client, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface, int quality, int lossless);

/**
 * Returns whether the owner of the given client supports the "msg"
 * instruction, returning non-zero if the client owner does support the
 * instruction, or zero if the owner does not.
 * 
 * @param client
 *     The Guacamole client whose owner should be checked for supporting
 *     the "msg" instruction.
 * 
 * @return 
 *     Non-zero if the owner of the given client supports the "msg"
 *     instruction, zero otherwise.
 */
int guac_client_owner_supports_msg(guac_client* client);

/**
 * Returns whether the owner of the given client supports the "required"
 * instruction, returning non-zero if the client owner does support the
 * instruction, or zero if the owner does not.
 * 
 * @param client
 *     The Guacamole client whose owner should be checked for supporting
 *     the "required" instruction.
 * 
 * @return 
 *     Non-zero if the owner of the given client supports the "required"
 *     instruction, zero otherwise.
 */
int guac_client_owner_supports_required(guac_client* client);

/**
 * Notifies the owner of the given client that a user has joined the connection,
 * and returns zero if the message was sent successfully, or non-zero if the
 * notification failed.
 *
 * @param client
 *     The Guacamole Client whose owner should be notified of a user joining
 *     the connection.
 *
 * @param joiner
 *     The Guacamole User who joined the connection.
 * 
 * @return
 *     Zero if the notification to the owner was sent successfully, or non-zero
 *     if an error occurred.
 */
int guac_client_owner_notify_join(guac_client* client, guac_user* joiner);

/**
 * Notifies the owner of the given client that a user has left the connection,
 * and returns zero if the message was sent successfully, or non-zero if the
 * notification failed.
 *
 * @param client
 *     The Guacamole Client whose owner should be notified of a user leaving
 *     the connection.
 *
 * @param quitter
 *     The Guacamole User who left the connection.
 * 
 * @return
 *     Zero if the notification to the owner was sent successfully, or non-zero
 *     if an error occurred.
 */
int guac_client_owner_notify_leave(guac_client* client, guac_user* quitter);

/**
 * Returns whether all users of the given client support WebP. If any user does
 * not support WebP, or the server cannot encode WebP images, zero is returned.
 *
 * @param client
 *     The Guacamole client whose users should be checked for WebP support.
 *
 * @return
 *     Non-zero if the all users of the given client claim to support WebP and
 *     the server has been built with WebP support, zero otherwise.
 */
int guac_client_supports_webp(guac_client* client);

/**
 * The default Guacamole client layer, layer 0.
 */
extern const guac_layer* GUAC_DEFAULT_LAYER;

#endif

