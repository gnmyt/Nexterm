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

#include "client.h"
#include "vnc.h"

#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/layer.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <rfb/rfbclient.h>
#include <rfb/rfbproto.h>

#include <stdarg.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <syslog.h>

void guac_vnc_cursor(rfbClient* client, int x, int y, int w, int h, int vnc_bpp) {

    guac_client* gc = rfbClientGetClientData(client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = (guac_vnc_client*) gc->data;

    /* Begin drawing operation directly to cursor layer */
    guac_display_layer* cursor_layer = guac_display_cursor(vnc_client->display);
    guac_display_layer_resize(cursor_layer, w, h);
    guac_display_set_cursor_hotspot(vnc_client->display, x, y);
    guac_display_layer_raw_context* context = guac_display_layer_open_raw(cursor_layer);

    /* Convert operation coordinates to guac_rect for easier manipulation */
    guac_rect op_bounds;
    guac_rect_init(&op_bounds, 0, 0, w, h);

    /* Ensure draw is within current bounds of the pending frame */
    guac_rect_constrain(&op_bounds, &context->bounds);

    /* VNC image buffer */
    unsigned char* vnc_current_row = client->rcSource;
    unsigned char* vnc_mask        = client->rcMask;
    size_t         vnc_stride      = guac_mem_ckd_mul_or_die(vnc_bpp, w);

    /* Copy image data from VNC client to RGBA buffer */
    unsigned char* layer_current_row = GUAC_RECT_MUTABLE_BUFFER(op_bounds, context->buffer, context->stride, GUAC_DISPLAY_LAYER_RAW_BPP);
    for (int dy = 0; dy < h; dy++) {

        /* Get current Guacamole buffer row, advance to next */
        uint32_t* layer_current_pixel = (uint32_t*) layer_current_row;
        layer_current_row += context->stride;

        /* Get current VNC framebuffer row, advance to next */
        const unsigned char* vnc_current_pixel = vnc_current_row;
        vnc_current_row += vnc_stride;

        for (int dx = 0; dx < w; dx++) {

            /* Read current pixel value */
            uint32_t v;
            switch (vnc_bpp) {
                case 4:
                    v = *((uint32_t*) vnc_current_pixel);
                    break;

                case 2:
                    v = *((uint16_t*) vnc_current_pixel);
                    break;

                default:
                    v = *((uint8_t*)  vnc_current_pixel);
            }

            /* Translate mask to alpha */
            uint8_t alpha = *(vnc_mask++) ? 0xFF : 0x00;

            /* Translate value to RGB */
            uint8_t red   = (v >> client->format.redShift)   * 0x100 / (client->format.redMax   + 1);
            uint8_t green = (v >> client->format.greenShift) * 0x100 / (client->format.greenMax + 1);
            uint8_t blue  = (v >> client->format.blueShift)  * 0x100 / (client->format.blueMax  + 1);

            /* Output ARGB */
            if (vnc_client->settings->swap_red_blue)
                *(layer_current_pixel++) = (alpha << 24) | (blue << 16) | (green << 8) | red;
            else
                *(layer_current_pixel++) = (alpha << 24) | (red  << 16) | (green << 8) | blue;

            /* Advance to next pixel in VNC framebuffer */
            vnc_current_pixel += vnc_bpp;

        }
    }

    /* Mark modified region as dirty */
    guac_rect_extend(&context->dirty, &op_bounds);

    /* Draw operation is now complete */
    guac_display_layer_close_raw(cursor_layer, context);
    guac_display_render_thread_notify_modified(vnc_client->render_thread);

    /* libvncclient does not free rcMask as it does rcSource */
    if (client->rcMask != NULL) {
        free(client->rcMask);
        client->rcMask = NULL;
    }

}

