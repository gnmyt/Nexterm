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
#include "guacamole/object.h"
#include "guacamole/pool.h"
#include "guacamole/protocol.h"
#include "guacamole/socket.h"
#include "guacamole/stream.h"
#include "guacamole/string.h"
#include "guacamole/timestamp.h"
#include "guacamole/user.h"
#include "id.h"
#include "user-handlers.h"

#include <errno.h>
#include <limits.h>
#include <stdlib.h>
#include <string.h>

guac_user* guac_user_alloc() {

    guac_user* user = guac_mem_zalloc(sizeof(guac_user));
    int i;

    /* Generate ID */
    user->user_id = guac_generate_id(GUAC_USER_ID_PREFIX);
    if (user->user_id == NULL) {
        guac_mem_free(user);
        return NULL;
    }

    user->last_received_timestamp = guac_timestamp_current();
    user->last_frame_duration = 0;
    user->processing_lag = 0;
    user->active = 1;

    /* Allocate stream pool */
    user->__stream_pool = guac_pool_alloc(0);

    /* Initialize streams */
    user->__input_streams = guac_mem_alloc(sizeof(guac_stream), GUAC_USER_MAX_STREAMS);
    user->__output_streams = guac_mem_alloc(sizeof(guac_stream), GUAC_USER_MAX_STREAMS);

    for (i=0; i<GUAC_USER_MAX_STREAMS; i++) {
        user->__input_streams[i].index = GUAC_USER_CLOSED_STREAM_INDEX;
        user->__output_streams[i].index = GUAC_USER_CLOSED_STREAM_INDEX;
    }

    /* Allocate object pool */
    user->__object_pool = guac_pool_alloc(0);

    /* Initialize objects */
    user->__objects = guac_mem_alloc(sizeof(guac_object), GUAC_USER_MAX_OBJECTS);
    for (i=0; i<GUAC_USER_MAX_OBJECTS; i++)
        user->__objects[i].index = GUAC_USER_UNDEFINED_OBJECT_INDEX;

    return user;

}

void guac_user_free(guac_user* user) {

    /* Free streams */
    guac_mem_free(user->__input_streams);
    guac_mem_free(user->__output_streams);

    /* Free stream pool */
    guac_pool_free(user->__stream_pool);

    /* Free objects */
    guac_mem_free(user->__objects);

    /* Free object pool */
    guac_pool_free(user->__object_pool);

    /* Clean up user */
    guac_mem_free(user->user_id);
    guac_mem_free(user);

}

guac_stream* guac_user_alloc_stream(guac_user* user) {

    guac_stream* allocd_stream;
    int stream_index;

    /* Allocate stream, but refuse to allocate beyond maximum */
    stream_index = guac_pool_next_int_below(user->__stream_pool, GUAC_USER_MAX_STREAMS);
    if (stream_index < 0)
        return NULL;

    /* Initialize stream with even index (odd indices are client-level) */
    allocd_stream = &(user->__output_streams[stream_index]);
    allocd_stream->index = stream_index * 2;
    allocd_stream->data = NULL;
    allocd_stream->ack_handler = NULL;
    allocd_stream->blob_handler = NULL;
    allocd_stream->end_handler = NULL;

    return allocd_stream;

}

void guac_user_free_stream(guac_user* user, guac_stream* stream) {

    /* Mark stream as closed */
    int freed_index = stream->index;
    stream->index = GUAC_USER_CLOSED_STREAM_INDEX;

    /* Release index to pool */
    guac_pool_free_int(user->__stream_pool, freed_index / 2);

}

guac_object* guac_user_alloc_object(guac_user* user) {

    guac_object* allocd_object;
    int object_index;

    /* Allocate object, but refuse to allocate beyond maximum */
    object_index = guac_pool_next_int_below(user->__object_pool, GUAC_USER_MAX_OBJECTS);
    if (object_index < 0)
        return NULL;

    /* Initialize object */
    allocd_object = &(user->__objects[object_index]);
    allocd_object->index = object_index;
    allocd_object->data = NULL;
    allocd_object->get_handler = NULL;
    allocd_object->put_handler = NULL;

    return allocd_object;

}

void guac_user_free_object(guac_user* user, guac_object* object) {

    /* Mark object as undefined */
    int freed_index = object->index;
    object->index = GUAC_USER_UNDEFINED_OBJECT_INDEX;

    /* Release index to pool */
    guac_pool_free_int(user->__object_pool, freed_index);

}

int guac_user_handle_instruction(guac_user* user, const char* opcode, int argc, char** argv) {

    return __guac_user_call_opcode_handler(__guac_instruction_handler_map,
            user, opcode, argc, argv);

}

void guac_user_stop(guac_user* user) {
    user->active = 0;
}

void vguac_user_abort(guac_user* user, guac_protocol_status status,
        const char* format, va_list ap) {

    /* Only relevant if user is active */
    if (user->active) {

        /* Log detail of error */
        vguac_user_log(user, GUAC_LOG_ERROR, format, ap);

        /* Send error immediately, limit information given */
        guac_protocol_send_error(user->socket, "Aborted. See logs.", status);
        guac_socket_flush(user->socket);

        /* Stop user */
        guac_user_stop(user);

    }

}

void guac_user_abort(guac_user* user, guac_protocol_status status,
        const char* format, ...) {

    va_list args;
    va_start(args, format);

    vguac_user_abort(user, status, format, args);

    va_end(args);

}

void vguac_user_log(guac_user* user, guac_client_log_level level,
        const char* format, va_list ap) {

    vguac_client_log(user->client, level, format, ap);

}

void guac_user_log(guac_user* user, guac_client_log_level level,
        const char* format, ...) {

    va_list args;
    va_start(args, format);

    vguac_client_log(user->client, level, format, args);

    va_end(args);

}

void guac_user_stream_argv(guac_user* user, guac_socket* socket,
        const char* mimetype, const char* name, const char* value) {

    /* Allocate new stream for argument value */
    guac_stream* stream = guac_user_alloc_stream(user);

    /* Declare stream as containing connection parameter data */
    guac_protocol_send_argv(socket, stream, mimetype, name);

    /* Write parameter data */
    guac_protocol_send_blobs(socket, stream, value, strlen(value));

    /* Terminate stream */
    guac_protocol_send_end(socket, stream);

    /* Free allocated stream */
    guac_user_free_stream(user, stream);

}

void guac_user_stream_png(guac_user* user, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface) {

    /* Allocate new stream for image */
    guac_stream* stream = guac_user_alloc_stream(user);

    /* Declare stream as containing image data */
    guac_protocol_send_img(socket, stream, mode, layer, "image/png", x, y);

    /* Write PNG data */
    guac_png_write(socket, stream, surface);

    /* Terminate stream */
    guac_protocol_send_end(socket, stream);

    /* Free allocated stream */
    guac_user_free_stream(user, stream);

}

void guac_user_stream_jpeg(guac_user* user, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface, int quality) {

    /* Allocate new stream for image */
    guac_stream* stream = guac_user_alloc_stream(user);

    /* Declare stream as containing image data */
    guac_protocol_send_img(socket, stream, mode, layer, "image/jpeg", x, y);

    /* Write JPEG data */
    guac_jpeg_write(socket, stream, surface, quality);

    /* Terminate stream */
    guac_protocol_send_end(socket, stream);

    /* Free allocated stream */
    guac_user_free_stream(user, stream);

}

void guac_user_stream_webp(guac_user* user, guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer, int x, int y,
        cairo_surface_t* surface, int quality, int lossless) {

#ifdef ENABLE_WEBP
    /* Allocate new stream for image */
    guac_stream* stream = guac_user_alloc_stream(user);

    /* Declare stream as containing image data */
    guac_protocol_send_img(socket, stream, mode, layer, "image/webp", x, y);

    /* Write WebP data */
    guac_webp_write(socket, stream, surface, quality, lossless);

    /* Terminate stream */
    guac_protocol_send_end(socket, stream);

    /* Free allocated stream */
    guac_user_free_stream(user, stream);
#else
    /* Do nothing if WebP support is not built in */
#endif

}

int guac_user_supports_msg(guac_user* user) {

    if (user == NULL)
        return 0;

    return (user->info.protocol_version >= GUAC_PROTOCOL_VERSION_1_5_0);

}

int guac_user_supports_required(guac_user* user) {
    
    if (user == NULL)
        return 0;
    
    return (user->info.protocol_version >= GUAC_PROTOCOL_VERSION_1_3_0);
    
}

int guac_user_supports_webp(guac_user* user) {

#ifdef ENABLE_WEBP
    const char** mimetype = user->info.image_mimetypes;

    /* Search for WebP mimetype in list of supported image mimetypes */
    while (*mimetype != NULL) {

        /* If WebP mimetype found, no need to search further */
        if (strcmp(*mimetype, "image/webp") == 0)
            return 1;

        /* Next mimetype */
        mimetype++;

    }

    /* User does not support WebP */
    return 0;
#else
    /* Support for WebP is completely absent */
    return 0;
#endif

}

char* guac_user_parse_args_string(guac_user* user, const char** arg_names,
        const char** argv, int index, const char* default_value) {

    /* Pull parameter value from argv */
    const char* value = argv[index];

    /* Use default value if blank */
    if (value[0] == 0) {

        /* NULL is a completely legal default value */
        if (default_value == NULL)
            return NULL;

        /* Log use of default */
        guac_user_log(user, GUAC_LOG_DEBUG, "Parameter \"%s\" omitted. Using "
                "default value of \"%s\".", arg_names[index], default_value);

        return guac_strdup(default_value);

    }

    /* Otherwise use provided value */
    return guac_strdup(value);

}

int guac_user_parse_args_int(guac_user* user, const char** arg_names,
        const char** argv, int index, int default_value) {

    char* parse_end;
    long parsed_value;

    /* Pull parameter value from argv */
    const char* value = argv[index];

    /* Use default value if blank */
    if (value[0] == 0) {

        /* Log use of default */
        guac_user_log(user, GUAC_LOG_DEBUG, "Parameter \"%s\" omitted. Using "
                "default value of %i.", arg_names[index], default_value);

        return default_value;

    }

    /* Parse value, checking for errors */
    errno = 0;
    parsed_value = strtol(value, &parse_end, 10);

    /* Ensure parsed value is within the legal range of an int */
    if (parsed_value < INT_MIN || parsed_value > INT_MAX)
        errno = ERANGE;

    /* Resort to default if input is invalid */
    if (errno != 0 || *parse_end != '\0') {

        /* Log use of default */
        guac_user_log(user, GUAC_LOG_WARNING, "Specified value \"%s\" for "
                "parameter \"%s\" is not a valid integer. Using default value "
                "of %i.", value, arg_names[index], default_value);

        return default_value;

    }

    /* Parsed successfully */
    return parsed_value;

}

int guac_user_parse_args_boolean(guac_user* user, const char** arg_names,
        const char** argv, int index, int default_value) {

    /* Pull parameter value from argv */
    const char* value = argv[index];

    /* Use default value if blank */
    if (value[0] == 0) {

        /* Log use of default */
        guac_user_log(user, GUAC_LOG_DEBUG, "Parameter \"%s\" omitted. Using "
                "default value of %i.", arg_names[index], default_value);

        return default_value;

    }

    /* Parse string "true" as true */
    if (strcmp(value, "true") == 0)
        return 1;

    /* Parse string "false" as false */
    if (strcmp(value, "false") == 0)
        return 0;

    /* All other values are invalid */
    guac_user_log(user, GUAC_LOG_WARNING, "Parameter \"%s\" must be either "
            "\"true\" or \"false\". Using default value.", arg_names[index]);

    return default_value;

}

