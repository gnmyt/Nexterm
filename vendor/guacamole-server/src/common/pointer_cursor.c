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

#include <cairo/cairo.h>
#include <guacamole/client.h>
#include <guacamole/layer.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/user.h>

/* Macros for prettying up the embedded image. */
#define X 0x00,0x00,0x00,0xFF
#define O 0xFF,0xFF,0xFF,0xFF
#define _ 0x00,0x00,0x00,0x00

/* Dimensions */
const int guac_common_pointer_cursor_width  = 11;
const int guac_common_pointer_cursor_height = 16;

/* Format */
const cairo_format_t guac_common_pointer_cursor_format = CAIRO_FORMAT_ARGB32;
const int guac_common_pointer_cursor_stride = 44;

/* Embedded pointer graphic */
unsigned char guac_common_pointer_cursor[] = {

        O,_,_,_,_,_,_,_,_,_,_,
        O,O,_,_,_,_,_,_,_,_,_,
        O,X,O,_,_,_,_,_,_,_,_,
        O,X,X,O,_,_,_,_,_,_,_,
        O,X,X,X,O,_,_,_,_,_,_,
        O,X,X,X,X,O,_,_,_,_,_,
        O,X,X,X,X,X,O,_,_,_,_,
        O,X,X,X,X,X,X,O,_,_,_,
        O,X,X,X,X,X,X,X,O,_,_,
        O,X,X,X,X,X,X,X,X,O,_,
        O,X,X,X,X,X,O,O,O,O,O,
        O,X,X,O,X,X,O,_,_,_,_,
        O,X,O,_,O,X,X,O,_,_,_,
        O,O,_,_,O,X,X,O,_,_,_,
        O,_,_,_,_,O,X,X,O,_,_,
        _,_,_,_,_,O,O,O,O,_,_

};

void guac_common_set_pointer_cursor(guac_user* user) {

    guac_client* client = user->client;
    guac_socket* socket = user->socket;

    /* Draw to buffer */
    guac_layer* cursor = guac_client_alloc_buffer(client);

    cairo_surface_t* graphic = cairo_image_surface_create_for_data(
            guac_common_pointer_cursor,
            guac_common_pointer_cursor_format,
            guac_common_pointer_cursor_width,
            guac_common_pointer_cursor_height,
            guac_common_pointer_cursor_stride);

    guac_user_stream_png(user, socket, GUAC_COMP_SRC, cursor,
            0, 0, graphic);
    cairo_surface_destroy(graphic);

    /* Set cursor */
    guac_protocol_send_cursor(socket, 0, 0, cursor,
            0, 0,
            guac_common_pointer_cursor_width,
            guac_common_pointer_cursor_height);

    /* Free buffer */
    guac_client_free_buffer(client, cursor);

    guac_client_log(client, GUAC_LOG_DEBUG,
            "Client cursor image set to generic built-in pointer.");

}

