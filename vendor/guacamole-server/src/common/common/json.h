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

#ifndef GUAC_COMMON_JSON_H
#define GUAC_COMMON_JSON_H

#include "config.h"

#include <guacamole/stream.h>
#include <guacamole/user.h>

/**
 * The current streaming state of an arbitrary JSON object, consisting of
 * any number of property name/value pairs.
 */
typedef struct guac_common_json_state {

    /**
     * Buffer of partial JSON data. The individual blobs which make up the JSON
     * body of the object being sent over the Guacamole protocol will be
     * built here.
     */
    char buffer[4096];

    /**
     * The number of bytes currently used within the JSON buffer.
     */
    int size;

    /**
     * The number of property name/value pairs written to the JSON object thus
     * far.
     */
    int properties_written;

} guac_common_json_state;

/**
 * Given a stream, the user to which it belongs, and the current stream state
 * of a JSON object, flushes the contents of the JSON buffer to a blob
 * instruction. Note that this will flush the JSON buffer only, and will not
 * necessarily flush the underlying guac_socket of the user.
 *
 * @param user
 *     The user to which the data will be flushed.
 *
 * @param stream
 *     The stream through which the flushed data should be sent as a blob.
 *
 * @param json_state
 *     The state object whose buffer should be flushed.
 */
void guac_common_json_flush(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state);

/**
 * Given a stream, the user to which it belongs, and the current stream state
 * of a JSON object, writes the contents of the given buffer to the JSON buffer
 * of the stream state, flushing as necessary.
 *
 * @param user
 *     The user to which the data will be flushed as necessary.
 *
 * @param stream
 *     The stream through which the flushed data should be sent as a blob, if
 *     data must be flushed at all.
 *
 * @param json_state
 *     The state object containing the JSON buffer to which the given buffer
 *     should be written.
 *
 * @param buffer
 *     The buffer to write.
 *
 * @param length
 *     The number of bytes in the buffer.
 *
 * @return
 *     Non-zero if at least one blob was written, zero otherwise.
 */
int guac_common_json_write(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state, const char* buffer, int length);

/**
 * Given a stream, the user to which it belongs, and the current stream state
 * of a JSON object state, writes the given string as a proper JSON string,
 * including starting and ending quotes. The contents of the string will be
 * escaped as necessary.
 *
 * @param user
 *     The user to which the data will be flushed as necessary.
 *
 * @param stream
 *     The stream through which the flushed data should be sent as a blob, if
 *     data must be flushed at all.
 *
 * @param json_state
 *     The state object containing the JSON buffer to which the given string
 *     should be written as a JSON name/value pair.
 *
 * @param str
 *     The string to write.
 *
 * @return
 *     Non-zero if at least one blob was written, zero otherwise.
 */
int guac_common_json_write_string(guac_user* user,
        guac_stream* stream, guac_common_json_state* json_state,
        const char* str);

/**
 * Given a stream, the user to which it belongs, and the current stream state
 * of a JSON object, writes the given JSON property name/value pair. The
 * name and value will be written as proper JSON strings separated by a colon.
 *
 * @param user
 *     The user to which the data will be flushed as necessary.
 *
 * @param stream
 *     The stream through which the flushed data should be sent as a blob, if
 *     data must be flushed at all.
 *
 * @param json_state
 *     The state object containing the JSON buffer to which the given strings
 *     should be written as a JSON name/value pair.
 *
 * @param name
 *     The name of the property to write.
 *
 * @param value
 *     The value of the property to write.
 *
 * @return
 *     Non-zero if at least one blob was written, zero otherwise.
 */
int guac_common_json_write_property(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state, const char* name,
        const char* value);

/**
 * Given a stream, the user to which it belongs, and the current stream state
 * of a JSON object, initializes the state for writing a new JSON object. Note
 * that although the user and stream must be provided, no instruction or
 * blobs will be written due to any call to this function.
 *
 * @param user
 *     The user associated with the given stream.
 *
 * @param stream
 *     The stream associated with the JSON object being written.
 *
 * @param json_state
 *     The state object to initialize.
 */
void guac_common_json_begin_object(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state);

/**
 * Given a stream, the user to which it belongs, and the current stream state
 * of a JSON object, completes writing that JSON object by writing the final
 * terminating brace. This function must only be called following a
 * corresponding call to guac_common_json_begin_object().
 *
 * @param user
 *     The user associated with the given stream.
 *
 * @param stream
 *     The stream associated with the JSON object being written.
 *
 * @param json_state
 *     The state object whose in-progress JSON object should be terminated.
 *
 * @return
 *     Non-zero if at least one blob was written, zero otherwise.
 */
int guac_common_json_end_object(guac_user* user, guac_stream* stream,
        guac_common_json_state* json_state);

#endif

