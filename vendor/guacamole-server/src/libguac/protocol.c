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

#include "guacamole/error.h"
#include "guacamole/layer.h"
#include "guacamole/object.h"
#include "guacamole/protocol.h"
#include "guacamole/protocol-types.h"
#include "guacamole/socket.h"
#include "guacamole/stream.h"
#include "guacamole/unicode.h"
#include "palette.h"

#include <cairo/cairo.h>

#include <inttypes.h>
#include <setjmp.h>
#include <stdarg.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>

/**
 * A structure mapping the enum value of a Guacamole protocol version to the
 * string representation of the version.
 */
typedef struct guac_protocol_version_mapping {
    
    /**
     * The enum value of the protocol version.
     */
    guac_protocol_version version;
    
    /**
     * The string value representing the protocol version.
     */
    char* version_string;
    
} guac_protocol_version_mapping;

/**
 * The map of known protocol versions to the corresponding string value.
 */
guac_protocol_version_mapping guac_protocol_version_table[] = {
    { GUAC_PROTOCOL_VERSION_1_0_0,   "VERSION_1_0_0" },
    { GUAC_PROTOCOL_VERSION_1_1_0,   "VERSION_1_1_0" },
    { GUAC_PROTOCOL_VERSION_1_3_0,   "VERSION_1_3_0" },
    { GUAC_PROTOCOL_VERSION_1_5_0,   "VERSION_1_5_0" },
    { GUAC_PROTOCOL_VERSION_UNKNOWN, NULL }
};

/* Output formatting functions */

ssize_t __guac_socket_write_length_string(guac_socket* socket, const char* str) {

    return
           guac_socket_write_int(socket, guac_utf8_strlen(str))
        || guac_socket_write_string(socket, ".")
        || guac_socket_write_string(socket, str);

}

ssize_t __guac_socket_write_length_int(guac_socket* socket, int64_t i) {

    char buffer[128];
    snprintf(buffer, sizeof(buffer), "%"PRIi64, i);
    return __guac_socket_write_length_string(socket, buffer);

}

ssize_t __guac_socket_write_length_double(guac_socket* socket, double d) {

    char buffer[128];
    snprintf(buffer, sizeof(buffer), "%.16g", d);
    return __guac_socket_write_length_string(socket, buffer);

}

/**
 * Loop through the provided NULL-terminated array, writing the values in the
 * array to the given socket. Values are written as a series of Guacamole
 * protocol elements, including the leading comma and the value length in
 * addition to the value itself. Returns zero on success, non-zero on error.
 *
 * @param socket
 *     The socket to which the data should be written.
 *
 * @param array
 *     The NULL-terminated array of values to write.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
static int guac_socket_write_array(guac_socket* socket, const char** array) {

    /* Loop through array, writing provided values to the socket. */
    for (int i=0; array[i] != NULL; i++) {

        if (guac_socket_write_string(socket, ","))
            return -1;

        if (__guac_socket_write_length_string(socket, array[i]))
            return -1;

    }

    return 0;

}

/* Protocol functions */

int guac_protocol_send_ack(guac_socket* socket, guac_stream* stream,
        const char* error, guac_protocol_status status) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.ack,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, error)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, status)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

static int __guac_protocol_send_args(guac_socket* socket, const char** args) {

    if (guac_socket_write_string(socket, "4.args")) return -1;
    
    /* Send protocol version ahead of other args. */
    if (guac_socket_write_string(socket, ",")
            || __guac_socket_write_length_string(socket, GUACAMOLE_PROTOCOL_VERSION))
        return -1;

    if (guac_socket_write_array(socket, args))
        return -1;

    return guac_socket_write_string(socket, ";");

}

int guac_protocol_send_args(guac_socket* socket, const char** args) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = __guac_protocol_send_args(socket, args);
    guac_socket_instruction_end(socket);

    return ret_val;

}

int guac_protocol_send_argv(guac_socket* socket, guac_stream* stream,
        const char* mimetype, const char* name) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.argv,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, mimetype)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, name)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_arc(guac_socket* socket, const guac_layer* layer,
        int x, int y, int radius, double startAngle, double endAngle,
        int negative) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.arc,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, radius)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, startAngle)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, endAngle)
        || guac_socket_write_string(socket, ",")
        || guac_socket_write_string(socket, negative ? "1.1" : "1.0")
        || guac_socket_write_string(socket, ";");
    guac_socket_instruction_end(socket);

    return ret_val;

}

int guac_protocol_send_audio(guac_socket* socket, const guac_stream* stream,
        const char* mimetype) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = 
           guac_socket_write_string(socket, "5.audio,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, mimetype)
        || guac_socket_write_string(socket, ";");
    guac_socket_instruction_end(socket);

    return ret_val;

}

int guac_protocol_send_blob(guac_socket* socket, const guac_stream* stream,
        const void* data, int count) {

    int base64_length = (count + 2) / 3 * 4;

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.blob,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || guac_socket_write_int(socket, base64_length)
        || guac_socket_write_string(socket, ".")
        || guac_socket_write_base64(socket, data, count)
        || guac_socket_flush_base64(socket)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_blobs(guac_socket* socket, const guac_stream* stream,
        const void* data, int count) {

    int ret_val = 0;

    /* Send blob instructions while data remains and instructions are being
     * sent successfully */
    while (count > 0 && ret_val == 0) {

        /* Limit blob size to maximum allowed */
        int blob_size = count;
        if (blob_size > GUAC_PROTOCOL_BLOB_MAX_LENGTH)
            blob_size = GUAC_PROTOCOL_BLOB_MAX_LENGTH;

        /* Send next blob of data */
        ret_val = guac_protocol_send_blob(socket, stream, data, blob_size);

        /* Advance to next blob */
        data = (const char*) data + blob_size;
        count -= blob_size;

    }

    return ret_val;

}

int guac_protocol_send_body(guac_socket* socket, const guac_object* object,
        const guac_stream* stream, const char* mimetype, const char* name) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.body,")
        || __guac_socket_write_length_int(socket, object->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, mimetype)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, name)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_cfill(guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer,
        int r, int g, int b, int a) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.cfill,")
        || __guac_socket_write_length_int(socket, mode)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, r)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, g)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, b)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, a)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_close(guac_socket* socket, const guac_layer* layer) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.close,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

static int __guac_protocol_send_connect(guac_socket* socket, const char** args) {

    if (guac_socket_write_string(socket, "7.connect"))
        return -1;

    if (guac_socket_write_array(socket, args))
        return -1;

    return guac_socket_write_string(socket, ";");

}

int guac_protocol_send_connect(guac_socket* socket, const char** args) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = __guac_protocol_send_connect(socket, args);
    guac_socket_instruction_end(socket);

    return ret_val;

}

int guac_protocol_send_clip(guac_socket* socket, const guac_layer* layer) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.clip,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_clipboard(guac_socket* socket, const guac_stream* stream,
        const char* mimetype) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "9.clipboard,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, mimetype)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_copy(guac_socket* socket,
        const guac_layer* srcl, int srcx, int srcy, int w, int h,
        guac_composite_mode mode, const guac_layer* dstl, int dstx, int dsty) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.copy,")
        || __guac_socket_write_length_int(socket, srcl->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcx)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcy)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, w)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, h)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, mode)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, dstl->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, dstx)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, dsty)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_cstroke(guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer,
        guac_line_cap_style cap, guac_line_join_style join, int thickness,
        int r, int g, int b, int a) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "7.cstroke,")
        || __guac_socket_write_length_int(socket, mode)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, cap)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, join)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, thickness)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, r)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, g)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, b)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, a)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_cursor(guac_socket* socket, int x, int y,
        const guac_layer* srcl, int srcx, int srcy, int w, int h) {
    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "6.cursor,")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcl->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcx)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcy)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, w)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, h)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_curve(guac_socket* socket, const guac_layer* layer,
        int cp1x, int cp1y, int cp2x, int cp2y, int x, int y) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.curve,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, cp1x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, cp1y)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, cp2x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, cp2y)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_disconnect(guac_socket* socket) {
    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = guac_socket_write_string(socket, "10.disconnect;");
    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_dispose(guac_socket* socket, const guac_layer* layer) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "7.dispose,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_distort(guac_socket* socket, const guac_layer* layer,
        double a, double b, double c,
        double d, double e, double f) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = 
           guac_socket_write_string(socket, "7.distort,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, a)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, b)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, c)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, d)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, e)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, f)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_end(guac_socket* socket, const guac_stream* stream) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.end,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_error(guac_socket* socket, const char* error,
        guac_protocol_status status) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.error,")
        || __guac_socket_write_length_string(socket, error)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, status)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int vguac_protocol_send_log(guac_socket* socket, const char* format,
        va_list args) {

    int ret_val;

    /* Copy log message into buffer */
    char message[4096];
    vsnprintf(message, sizeof(message), format, args);

    /* Log to instruction */
    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.log,")
        || __guac_socket_write_length_string(socket, message)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_log(guac_socket* socket, const char* format, ...) {

    int ret_val;

    va_list args;
    va_start(args, format);
    ret_val = vguac_protocol_send_log(socket, format, args);
    va_end(args);

    return ret_val;

}

int guac_protocol_send_msg(guac_socket* socket, guac_message_type msg,
        const char** args) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.msg,")
        || __guac_socket_write_length_int(socket, msg)
        || guac_socket_write_array(socket, args)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_file(guac_socket* socket, const guac_stream* stream,
        const char* mimetype, const char* name) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.file,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, mimetype)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, name)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_filesystem(guac_socket* socket,
        const guac_object* object, const char* name) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "10.filesystem,")
        || __guac_socket_write_length_int(socket, object->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, name)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_identity(guac_socket* socket, const guac_layer* layer) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "8.identity,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_key(guac_socket* socket, int keysym, int pressed,
        guac_timestamp timestamp) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.key,")
        || __guac_socket_write_length_int(socket, keysym)
        || guac_socket_write_string(socket, pressed ? ",1.1," : ",1.0,")
        || __guac_socket_write_length_int(socket, timestamp)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_lfill(guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer,
        const guac_layer* srcl) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.lfill,")
        || __guac_socket_write_length_int(socket, mode)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcl->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_line(guac_socket* socket, const guac_layer* layer,
        int x, int y) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.line,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_lstroke(guac_socket* socket,
        guac_composite_mode mode, const guac_layer* layer,
        guac_line_cap_style cap, guac_line_join_style join, int thickness,
        const guac_layer* srcl) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "7.lstroke,")
        || __guac_socket_write_length_int(socket, mode)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, cap)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, join)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, thickness)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcl->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_mouse(guac_socket* socket, int x, int y,
        int button_mask, guac_timestamp timestamp) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.mouse,")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, button_mask)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, timestamp)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_touch(guac_socket* socket, int id, int x, int y,
        int x_radius, int y_radius, double angle, double force,
        guac_timestamp timestamp) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.touch,")
        || __guac_socket_write_length_int(socket, id)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x_radius)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y_radius)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, angle)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, force)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, timestamp)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_move(guac_socket* socket, const guac_layer* layer,
        const guac_layer* parent, int x, int y, int z) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.move,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, parent->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, z)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_name(guac_socket* socket, const char* name) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.name,")
        || __guac_socket_write_length_string(socket, name)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_nest(guac_socket* socket, int index,
        const char* data) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.nest,")
        || __guac_socket_write_length_int(socket, index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, data)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_nop(guac_socket* socket) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = guac_socket_write_string(socket, "3.nop;");
    guac_socket_instruction_end(socket);

    return ret_val;

}

int guac_protocol_send_pipe(guac_socket* socket, const guac_stream* stream,
        const char* mimetype, const char* name) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.pipe,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, mimetype)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, name)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_img(guac_socket* socket, const guac_stream* stream,
        guac_composite_mode mode, const guac_layer* layer,
        const char* mimetype, int x, int y) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.img,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, mode)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, mimetype)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_pop(guac_socket* socket, const guac_layer* layer) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.pop,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_push(guac_socket* socket, const guac_layer* layer) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.push,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_ready(guac_socket* socket, const char* id) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.ready,")
        || __guac_socket_write_length_string(socket, id)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_rect(guac_socket* socket,
        const guac_layer* layer, int x, int y, int width, int height) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.rect,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, width)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, height)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_required(guac_socket* socket, const char** required) {
    
    int ret_val;
    
    guac_socket_instruction_begin(socket);

    ret_val = guac_socket_write_string(socket, "8.required")
        || guac_socket_write_array(socket, required)
        || guac_socket_write_string(socket, ";")
        || guac_socket_flush(socket);
    
    guac_socket_instruction_end(socket);

    return ret_val;
    
}

int guac_protocol_send_reset(guac_socket* socket, const guac_layer* layer) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.reset,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_set(guac_socket* socket, const guac_layer* layer,
        const char* name, const char* value) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.set,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, name)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, value)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_set_int(guac_socket* socket, const guac_layer* layer,
        const char* name, int value) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "3.set,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, name)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, value)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_select(guac_socket* socket, const char* protocol) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "6.select,")
        || __guac_socket_write_length_string(socket, protocol)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_shade(guac_socket* socket, const guac_layer* layer,
        int a) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.shade,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, a)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_size(guac_socket* socket, const guac_layer* layer,
        int w, int h) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "4.size,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, w)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, h)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_start(guac_socket* socket, const guac_layer* layer,
        int x, int y) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "5.start,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, x)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, y)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_sync(guac_socket* socket, guac_timestamp timestamp,
        int frames) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = 
           guac_socket_write_string(socket, "4.sync,")
        || __guac_socket_write_length_int(socket, timestamp)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, frames)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_transfer(guac_socket* socket,
        const guac_layer* srcl, int srcx, int srcy, int w, int h,
        guac_transfer_function fn, const guac_layer* dstl, int dstx, int dsty) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "8.transfer,")
        || __guac_socket_write_length_int(socket, srcl->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcx)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, srcy)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, w)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, h)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, fn)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, dstl->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, dstx)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, dsty)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_transform(guac_socket* socket, const guac_layer* layer,
        double a, double b, double c,
        double d, double e, double f) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = 
           guac_socket_write_string(socket, "9.transform,")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, a)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, b)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, c)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, d)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, e)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_double(socket, f)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_undefine(guac_socket* socket,
        const guac_object* object) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val =
           guac_socket_write_string(socket, "8.undefine,")
        || __guac_socket_write_length_int(socket, object->index)
        || guac_socket_write_string(socket, ";");

    guac_socket_instruction_end(socket);
    return ret_val;

}

int guac_protocol_send_video(guac_socket* socket, const guac_stream* stream,
        const guac_layer* layer, const char* mimetype) {

    int ret_val;

    guac_socket_instruction_begin(socket);
    ret_val = 
           guac_socket_write_string(socket, "5.video,")
        || __guac_socket_write_length_int(socket, stream->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_int(socket, layer->index)
        || guac_socket_write_string(socket, ",")
        || __guac_socket_write_length_string(socket, mimetype)
        || guac_socket_write_string(socket, ";");
    guac_socket_instruction_end(socket);

    return ret_val;

}

/**
 * Returns the value of a single base64 character.
 */
static int __guac_base64_value(char c) {

    if (c >= 'A' && c <= 'Z')
        return c - 'A';

    if (c >= 'a' && c <= 'z')
        return c - 'a' + 26;

    if (c >= '0' && c <= '9')
        return c - '0' + 52;

    if (c == '+')
        return 62;

    if (c == '/')
        return 63;

    return 0;

}

int guac_protocol_decode_base64(char* base64) {

    char* input = base64;
    char* output = base64;

    int length = 0;
    int bits_read = 0;
    int value = 0;
    char current;

    /* For all characters in string */
    while ((current = *(input++)) != 0) {

        /* If we've reached padding, then we're done */
        if (current == '=')
            break;

        /* Otherwise, shift on the latest 6 bits */
        value = (value << 6) | __guac_base64_value(current);
        bits_read += 6;

        /* If we have at least one byte, write out the latest whole byte */
        if (bits_read >= 8) {
            *(output++) = (value >> (bits_read % 8)) & 0xFF;
            bits_read -= 8;
            length++;
        }

    }

    /* Return number of bytes written */
    return length;

}

guac_protocol_version guac_protocol_string_to_version(const char* version_string) {
    
    guac_protocol_version_mapping* current = guac_protocol_version_table;
    while (current->version != GUAC_PROTOCOL_VERSION_UNKNOWN) {
        
        if (strcmp(current->version_string, version_string) == 0)
            return current->version;
        
        current++;
        
    }
    
    return GUAC_PROTOCOL_VERSION_UNKNOWN;
    
}

const char* guac_protocol_version_to_string(guac_protocol_version version) {
    
    guac_protocol_version_mapping* current = guac_protocol_version_table;
    while (current->version != GUAC_PROTOCOL_VERSION_UNKNOWN) {
        
        if (current->version == version)
            return (const char*) current->version_string;
        
        current++;
        
    }
    
    return NULL;
    
}

