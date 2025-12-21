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

#include "common/json.h"

#include <assert.h>
#include <stdlib.h>
#include <string.h>

#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

void guac_common_json_flush(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state) {

    /* If JSON buffer is non-empty, write contents to blob and reset */
    if (json_state->size > 0) {
        guac_protocol_send_blob(user->socket, stream,
                json_state->buffer, json_state->size);

        /* Reset JSON buffer size */
        json_state->size = 0;

    }

}

int guac_common_json_write(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state, const char* buffer, int length) {

    int blob_written = 0;

    /*
     * Append to and flush the JSON buffer as necessary to write the given
     * data
     */
    while (length > 0) {

        /* Ensure provided data does not exceed size of buffer */
        int blob_length = length;
        if (blob_length > sizeof(json_state->buffer))
            blob_length = sizeof(json_state->buffer);

        /* Flush if more room is needed */
        if (json_state->size + blob_length > sizeof(json_state->buffer)) {
            guac_common_json_flush(user, stream, json_state);
            blob_written = 1;
        }

        /* Append data to JSON buffer */
        memcpy(json_state->buffer + json_state->size,
                buffer, blob_length);

        json_state->size += blob_length;

        /* Advance to next blob of data */
        buffer += blob_length;
        length -= blob_length;

    }

    return blob_written;

}

int guac_common_json_write_string(guac_user* user,
        guac_stream* stream, guac_common_json_state* json_state,
        const char* str) {

    int blob_written = 0;

    /* Write starting quote */
    blob_written |= guac_common_json_write(user, stream,
            json_state, "\"", 1);

    /* Write given string, escaping as necessary */
    const char* current = str;
    for (; *current != '\0'; current++) {

        /* Escape all quotes and back-slashes */
        if (*current == '"' || *current == '\\') {

            /* Write any string content up to current character */
            if (current != str)
                blob_written |= guac_common_json_write(user, stream,
                        json_state, str, current - str);

            /* Escape the character that was just read */
            blob_written |= guac_common_json_write(user, stream,
                    json_state, "\\", 1);

            /* Reset string */
            str = current;

        }

    }

    /* Write any remaining string content */
    if (current != str)
        blob_written |= guac_common_json_write(user, stream,
                json_state, str, current - str);

    /* Write ending quote */
    blob_written |= guac_common_json_write(user, stream,
            json_state, "\"", 1);

    return blob_written;

}

int guac_common_json_write_property(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state, const char* name,
        const char* value) {

    int blob_written = 0;

    /* Write leading comma if not first property */
    if (json_state->properties_written != 0)
        blob_written |= guac_common_json_write(user, stream,
                json_state, ",", 1);

    /* Write property name */
    blob_written |= guac_common_json_write_string(user, stream,
            json_state, name);

    /* Separate name from value with colon */
    blob_written |= guac_common_json_write(user, stream,
            json_state, ":", 1);

    /* Write property value */
    blob_written |= guac_common_json_write_string(user, stream,
            json_state, value);

    json_state->properties_written++;

    return blob_written;

}

void guac_common_json_begin_object(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state) {

    /* Init JSON state */
    json_state->size = 0;
    json_state->properties_written = 0;

    /* Write leading brace - no blob can possibly be written by this */
    assert(!guac_common_json_write(user, stream, json_state, "{", 1));

}

int guac_common_json_end_object(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state) {

    /* Write final brace of JSON object */
    return guac_common_json_write(user, stream, json_state, "}", 1);

}

