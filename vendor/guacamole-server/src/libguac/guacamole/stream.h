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

#ifndef _GUAC_STREAM_H
#define _GUAC_STREAM_H

/**
 * Provides functions and structures required for allocating and using streams.
 *
 * @file stream.h
 */

#include "user-fntypes.h"
#include "stream-types.h"

struct guac_stream {

    /**
     * The index of this stream.
     */
    int index;

    /**
     * Arbitrary data associated with this stream.
     */
    void* data;

    /**
     * Handler for ack events sent by the Guacamole web-client.
     *
     * The handler takes a guac_stream which contains the stream index and
     * will persist through the duration of the transfer, a string containing
     * the error or status message, and a status code.
     *
     * Example:
     * @code
     *     int ack_handler(guac_user* user, guac_stream* stream,
     *             char* error, guac_protocol_status status);
     *
     *     int some_function(guac_user* user) {
     *
     *         guac_stream* stream = guac_user_alloc_stream(user);
     *         stream->ack_handler = ack_handler;
     *
     *         guac_protocol_send_clipboard(user->socket,
     *             stream, "text/plain");
     *
     *     }
     * @endcode
     */
    guac_user_ack_handler* ack_handler;

    /**
     * Handler for blob events sent by the Guacamole web-client.
     *
     * The handler takes a guac_stream which contains the stream index and
     * will persist through the duration of the transfer, an arbitrary buffer
     * containing the blob, and the length of the blob.
     *
     * Example:
     * @code
     *     int blob_handler(guac_user* user, guac_stream* stream,
     *             void* data, int length);
     *
     *     int my_clipboard_handler(guac_user* user, guac_stream* stream,
     *             char* mimetype) {
     *         stream->blob_handler = blob_handler;
     *     }
     * @endcode
     */
    guac_user_blob_handler* blob_handler;

    /**
     * Handler for stream end events sent by the Guacamole web-client.
     *
     * The handler takes only a guac_stream which contains the stream index.
     * This guac_stream will be disposed of immediately after this event is
     * finished.
     *
     * Example:
     * @code
     *     int end_handler(guac_user* user, guac_stream* stream);
     *
     *     int my_clipboard_handler(guac_user* user, guac_stream* stream,
     *             char* mimetype) {
     *         stream->end_handler = end_handler;
     *     }
     * @endcode
     */
    guac_user_end_handler* end_handler;

};

#endif

