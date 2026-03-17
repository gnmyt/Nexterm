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

#include "guacamole/mem.h"
#include "guacamole/argv.h"
#include "guacamole/client.h"
#include "guacamole/protocol.h"
#include "guacamole/socket.h"
#include "guacamole/stream.h"
#include "guacamole/string.h"
#include "guacamole/user.h"

#include <pthread.h>
#include <stdlib.h>
#include <string.h>

/**
 * The state of an argument that will be automatically processed. Note that
 * this is distinct from the state of an argument value that is currently being
 * processed. Argument value states are dynamically-allocated and scoped by the
 * associated guac_stream.
 */
typedef struct guac_argv_state {

    /**
     * The name of the argument.
     */
    char name[GUAC_ARGV_MAX_NAME_LENGTH];

    /**
     * Whether at least one value for this argument has been received since it
     * was registered.
     */
    int received;

    /**
     * Bitwise OR of all option flags that should affect processing of this
     * argument.
     */
    int options;

    /**
     * The callback that should be invoked when a new value for the associated
     * argument has been received. If the GUAC_ARGV_OPTION_ONCE flag is set,
     * the callback will be invoked at most once.
     */
    guac_argv_callback* callback;

    /**
     * The arbitrary data that should be passed to the callback.
     */
    void* data;

} guac_argv_state;

/**
 * The current state of automatic processing of "argv" streams.
 */
typedef struct guac_argv_await_state {

    /**
     * Whether automatic argument processing has been stopped via a call to
     * guac_argv_stop().
     */
    int stopped;

    /**
     * The total number of arguments registered.
     */
    unsigned int num_registered;

    /**
     * All registered arguments and their corresponding callbacks.
     */
    guac_argv_state registered[GUAC_ARGV_MAX_REGISTERED];

    /**
     * Lock which protects multi-threaded access to this entire state
     * structure, including the condition that signals specific modifications
     * to the structure.
     */
    pthread_mutex_t lock;

    /**
     * Condition which is signalled whenever the overall state of "argv"
     * processing changes, either through the receipt of a new argument value
     * or due to a call to guac_argv_stop().
     */
    pthread_cond_t changed;

} guac_argv_await_state;

/**
 * The value or current status of a connection parameter received over an
 * "argv" stream.
 */
typedef struct guac_argv {

    /**
     * The state of the specific setting being updated.
     */
    guac_argv_state* state;

    /**
     * The mimetype of the data being received.
     */
    char mimetype[GUAC_ARGV_MAX_MIMETYPE_LENGTH];

    /**
     * Buffer space for containing the received argument value.
     */
    char buffer[GUAC_ARGV_MAX_LENGTH];

    /**
     * The number of bytes received so far.
     */
    int length;

} guac_argv;

/**
 * Statically-allocated, shared state of the guac_argv_*() family of functions.
 */
static guac_argv_await_state await_state = {
    .lock = PTHREAD_MUTEX_INITIALIZER,
    .changed = PTHREAD_COND_INITIALIZER
};

/**
 * Returns whether at least one value for each of the provided arguments has
 * been received.
 *
 * @param args
 *     A NULL-terminated array of the names of all arguments to test.
 *
 * @return
 *     Non-zero if at least one value has been received for each of the
 *     provided arguments, zero otherwise.
 */
static int guac_argv_is_received(const char** args) {

    for (int i = 0; i < await_state.num_registered; i++) {

        /* Ignore all received arguments */
        guac_argv_state* state = &await_state.registered[i];
        if (state->received)
            continue;

        /* Fail immediately for any matching non-received arguments */
        for (const char** arg = args; *arg != NULL; arg++) {
            if (strcmp(state->name, *arg) == 0)
                return 0;
        }

    }

    /* All arguments were received */
    return 1;

}

int guac_argv_register(const char* name, guac_argv_callback* callback, void* data, int options) {

    pthread_mutex_lock(&await_state.lock);

    if (await_state.num_registered == GUAC_ARGV_MAX_REGISTERED) {
        pthread_mutex_unlock(&await_state.lock);
        return 1;
    }

    guac_argv_state* state = &await_state.registered[await_state.num_registered++];
    guac_strlcpy(state->name, name, sizeof(state->name));
    state->options = options;
    state->callback = callback;
    state->data = data;

    pthread_mutex_unlock(&await_state.lock);
    return 0;

}

int guac_argv_await(const char** args) {

    /* Wait for all requested arguments to be received (or for receipt to be
     * stopped) */
    pthread_mutex_lock(&await_state.lock);
    while (!await_state.stopped && !guac_argv_is_received(args))
        pthread_cond_wait(&await_state.changed, &await_state.lock);

    /* Arguments were successfully received only if receipt was not stopped */
    int retval = await_state.stopped;
    pthread_mutex_unlock(&await_state.lock);
    return retval;

}

/**
 * Handler for "blob" instructions which appends the data from received blobs
 * to the end of the in-progress argument value buffer.
 *
 * @see guac_user_blob_handler
 */
static int guac_argv_blob_handler(guac_user* user, guac_stream* stream,
        void* data, int length) {

    guac_argv* argv = (guac_argv*) stream->data;

    /* Calculate buffer size remaining, including space for null terminator,
     * adjusting received length accordingly */
    int remaining = sizeof(argv->buffer) - argv->length - 1;
    if (length > remaining)
        length = remaining;

    /* Append received data to end of buffer */
    memcpy(argv->buffer + argv->length, data, length);
    argv->length += length;

    return 0;

}

/**
 * Handler for "end" instructions which applies the changes specified by the
 * argument value buffer associated with the stream.
 *
 * @see guac_user_end_handler
 */
static int guac_argv_end_handler(guac_user* user, guac_stream* stream) {

    int result = 0;

    /* Append null terminator to value */
    guac_argv* argv = (guac_argv*) stream->data;
    argv->buffer[argv->length] = '\0';

    pthread_mutex_lock(&await_state.lock);

    /* Invoke callback, limiting to a single invocation if
     * GUAC_ARGV_OPTION_ONCE applies */
    guac_argv_state* state = argv->state;
    if (!(state->options & GUAC_ARGV_OPTION_ONCE) || !state->received) {
        if (state->callback != NULL)
            result = state->callback(user, argv->mimetype, state->name, argv->buffer, state->data);
    }

    /* Alert connected clients regarding newly-accepted values if echo is
     * enabled */
    if (!result && (state->options & GUAC_ARGV_OPTION_ECHO)) {
        guac_client* client = user->client;
        guac_client_stream_argv(client, client->socket, argv->mimetype, state->name, argv->buffer);
    }

    /* Notify that argument has been received */
    state->received = 1;
    pthread_cond_broadcast(&await_state.changed);

    pthread_mutex_unlock(&await_state.lock);

    guac_mem_free(argv);
    return 0;

}

int guac_argv_received(guac_stream* stream, const char* mimetype, const char* name) {

    pthread_mutex_lock(&await_state.lock);

    for (int i = 0; i < await_state.num_registered; i++) {

        /* Ignore any arguments that have already been received if they are
         * declared as being acceptable only once */
        guac_argv_state* state = &await_state.registered[i];
        if ((state->options & GUAC_ARGV_OPTION_ONCE) && state->received)
            continue;

        /* Argument matched */
        if (strcmp(state->name, name) == 0) {

            guac_argv* argv = guac_mem_alloc(sizeof(guac_argv));
            guac_strlcpy(argv->mimetype, mimetype, sizeof(argv->mimetype));
            argv->state = state;
            argv->length = 0;

            stream->data = argv;
            stream->blob_handler = guac_argv_blob_handler;
            stream->end_handler = guac_argv_end_handler;

            pthread_mutex_unlock(&await_state.lock);
            return 0;

        }

    }

    /* No such argument awaiting processing */
    pthread_mutex_unlock(&await_state.lock);
    return 1;

}

void guac_argv_stop() {
    pthread_mutex_lock(&await_state.lock);

    /* Signal any waiting threads that no further argument values will be
     * received */
    if (!await_state.stopped) {
        await_state.stopped = 1;
        pthread_cond_broadcast(&await_state.changed);

    }

    pthread_mutex_unlock(&await_state.lock);
}

int guac_argv_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* name) {

    /* Refuse stream if argument is not registered */
    if (guac_argv_received(stream, mimetype, name)) {
        guac_protocol_send_ack(user->socket, stream, "Not allowed.",
                GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Signal stream is ready */
    guac_protocol_send_ack(user->socket, stream, "Ready for updated "
            "parameter.", GUAC_PROTOCOL_STATUS_SUCCESS);
    guac_socket_flush(user->socket);
    return 0;

}

