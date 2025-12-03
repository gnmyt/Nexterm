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

#ifndef __GUAC_CLIPBOARD_H
#define __GUAC_CLIPBOARD_H

#include "config.h"

#include <guacamole/client.h>
#include <pthread.h>

/**
 * The maximum number of bytes to send in an individual blob when
 * transmitting the clipboard contents to a connected client.
 */
#define GUAC_COMMON_CLIPBOARD_BLOCK_SIZE 4096

/**
 * The maximum number of bytes to allow within the clipboard.
 */
#define GUAC_COMMON_CLIPBOARD_MAX_LENGTH 262144

/**
 * Generic clipboard structure.
 */
typedef struct guac_common_clipboard {

    /**
     * Lock which restricts simultaneous access to the clipboard, guaranteeing
     * ordered modifications to the clipboard and that changes to the clipboard
     * are not allowed while the clipboard is being broadcast to all users.
     */
    pthread_mutex_t lock;

    /**
     * The mimetype of the contained clipboard data.
     */
    char mimetype[256];

    /**
     * Arbitrary clipboard data.
     */
    char* buffer;

    /**
     * The number of bytes currently stored in the clipboard buffer.
     */
    int length;

    /**
     * The total number of bytes available in the clipboard buffer.
     */
    int available;

} guac_common_clipboard;

/**
 * Creates a new clipboard.
 */
guac_common_clipboard* guac_common_clipboard_alloc();

/**
 * Frees the given clipboard.
 *
 * @param clipboard The clipboard to free.
 */
void guac_common_clipboard_free(guac_common_clipboard* clipboard);

/**
 * Sends the contents of the clipboard along the given client, splitting
 * the contents as necessary.
 *
 * @param clipboard The clipboard whose contents should be sent.
 * @param client The client to send the clipboard contents on.
 */
void guac_common_clipboard_send(guac_common_clipboard* clipboard, guac_client* client);

/**
 * Clears the clipboard contents and assigns a new mimetype for future data.
 *
 * @param clipboard The clipboard to reset.
 * @param mimetype The mimetype of future data.
 */
void guac_common_clipboard_reset(guac_common_clipboard* clipboard, const char* mimetype);

/**
 * Appends the given data to the current clipboard contents. The data must
 * match the mimetype chosen for the clipboard data by
 * guac_common_clipboard_reset().
 *
 * @param clipboard The clipboard to append data to.
 * @param data The data to append.
 * @param length The number of bytes to append from the data given.
 */
void guac_common_clipboard_append(guac_common_clipboard* clipboard, const char* data, int length);

#endif

