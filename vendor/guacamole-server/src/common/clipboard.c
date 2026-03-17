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
#include "common/clipboard.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/stream.h>
#include <guacamole/string.h>
#include <guacamole/user.h>
#include <pthread.h>
#include <string.h>
#include <stdlib.h>

guac_common_clipboard* guac_common_clipboard_alloc() {

    guac_common_clipboard* clipboard = guac_mem_alloc(sizeof(guac_common_clipboard));

    /* Init clipboard */
    clipboard->mimetype[0] = '\0';
    clipboard->buffer = guac_mem_alloc(GUAC_COMMON_CLIPBOARD_MAX_LENGTH);
    clipboard->available = GUAC_COMMON_CLIPBOARD_MAX_LENGTH;
    clipboard->length = 0;

    pthread_mutex_init(&(clipboard->lock), NULL);

    return clipboard;

}

void guac_common_clipboard_free(guac_common_clipboard* clipboard) {

    /* Destroy lock */
    pthread_mutex_destroy(&(clipboard->lock));

    /* Free buffer */
    guac_mem_free(clipboard->buffer);

    /* Free base structure */
    guac_mem_free(clipboard);

}

/**
 * Callback for guac_client_foreach_user() which sends clipboard data to each
 * connected client.
 *
 * @param user
 *     The user to send the clipboard data to.
 *
 * @param
 *     A pointer to the guac_common_clipboard structure containing the
 *     clipboard data that should be sent to the given user.
 *
 * @return
 *     Always NULL.
 */
static void* __send_user_clipboard(guac_user* user, void* data) {

    guac_common_clipboard* clipboard = (guac_common_clipboard*) data;

    char* current = clipboard->buffer;
    int remaining = clipboard->length;

    /* Begin stream */
    guac_stream* stream = guac_user_alloc_stream(user);
    guac_protocol_send_clipboard(user->socket, stream, clipboard->mimetype);

    guac_user_log(user, GUAC_LOG_DEBUG,
            "Created stream %i for %s clipboard data.",
            stream->index, clipboard->mimetype);

    /* Split clipboard into chunks */
    while (remaining > 0) {

        /* Calculate size of next block */
        int block_size = GUAC_COMMON_CLIPBOARD_BLOCK_SIZE;
        if (remaining < block_size)
            block_size = remaining; 

        /* Send block */
        guac_protocol_send_blob(user->socket, stream, current, block_size);
        guac_user_log(user, GUAC_LOG_DEBUG,
                "Sent %i bytes of clipboard data on stream %i.",
                block_size, stream->index);

        /* Next block */
        remaining -= block_size;
        current += block_size;

    }

    guac_user_log(user, GUAC_LOG_DEBUG,
            "Clipboard stream %i complete.",
            stream->index);

    /* End stream */
    guac_protocol_send_end(user->socket, stream);
    guac_socket_flush(user->socket);
    guac_user_free_stream(user, stream);

    return NULL;

}

void guac_common_clipboard_send(guac_common_clipboard* clipboard, guac_client* client) {

    pthread_mutex_lock(&(clipboard->lock));

    guac_client_log(client, GUAC_LOG_DEBUG, "Broadcasting clipboard to all connected users.");
    guac_client_foreach_user(client, __send_user_clipboard, clipboard);
    guac_client_log(client, GUAC_LOG_DEBUG, "Broadcast of clipboard complete.");

    pthread_mutex_unlock(&(clipboard->lock));

}

void guac_common_clipboard_reset(guac_common_clipboard* clipboard,
        const char* mimetype) {

    pthread_mutex_lock(&(clipboard->lock));

    /* Clear clipboard contents */
    clipboard->length = 0;

    /* Assign given mimetype */
    guac_strlcpy(clipboard->mimetype, mimetype, sizeof(clipboard->mimetype));

    pthread_mutex_unlock(&(clipboard->lock));

}

void guac_common_clipboard_append(guac_common_clipboard* clipboard, const char* data, int length) {

    pthread_mutex_lock(&(clipboard->lock));

    /* Truncate data to available length */
    int remaining = clipboard->available - clipboard->length;
    if (remaining < length)
        length = remaining;

    /* Append to buffer */
    memcpy(clipboard->buffer + clipboard->length, data, length);

    /* Update length */
    clipboard->length += length;

    pthread_mutex_unlock(&(clipboard->lock));

}

