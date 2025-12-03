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
#include "display.h"
#include "common/iconv.h"
#include "vnc.h"

#include <cairo/cairo.h>
#include <guacamole/client.h>
#include <guacamole/layer.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/timestamp.h>
#include <rfb/rfbclient.h>
#include <rfb/rfbproto.h>

/* Define cairo_format_stride_for_width() if missing */
#ifndef HAVE_CAIRO_FORMAT_STRIDE_FOR_WIDTH
#define cairo_format_stride_for_width(format, width) (width*4)
#endif

#include <stdarg.h>
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <syslog.h>

void guac_vnc_update(rfbClient* client, int x, int y, int w, int h) {

    guac_client* gc = rfbClientGetClientData(client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = (guac_vnc_client*) gc->data;
    guac_display_layer* default_layer = guac_display_default_layer(vnc_client->display);

    guac_display_layer_raw_context* context = vnc_client->current_context;
    unsigned int vnc_bpp = client->format.bitsPerPixel / 8;
    size_t vnc_stride = guac_mem_ckd_mul_or_die(vnc_bpp, client->width);

    /* Convert operation coordinates to guac_rect for easier manipulation */
    guac_rect op_bounds;
    guac_rect_init(&op_bounds, x, y, w, h);

    /* Ensure operation bounds are within possibly updated bounds of the
     * pending frame (now the RFB client framebuffer) */
    guac_rect_constrain(&op_bounds, &context->bounds);

    /* NOTE: The guac_display will be pointed directly at the libvncclient
     * framebuffer if the pixel format used is identical to that expected by
     * guac_display. No need to manually copy anything around in that case. */

    /* All framebuffer formats must be manually converted if not identical to
     * the format used by guac_display */
    if (vnc_bpp != GUAC_DISPLAY_LAYER_RAW_BPP || vnc_client->settings->swap_red_blue) {

        /* Ensure draw is within current bounds of the pending frame */
        guac_rect_constrain(&op_bounds, &context->bounds);

        const unsigned char* vnc_current_row = GUAC_RECT_CONST_BUFFER(op_bounds, client->frameBuffer, vnc_stride, vnc_bpp);
        unsigned char* layer_current_row = GUAC_RECT_MUTABLE_BUFFER(op_bounds, context->buffer, context->stride, GUAC_DISPLAY_LAYER_RAW_BPP);
        for (int dy = op_bounds.top; dy < op_bounds.bottom; dy++) {

            /* Get current Guacamole buffer row, advance to next */
            uint32_t* layer_current_pixel = (uint32_t*) layer_current_row;
            layer_current_row += context->stride;

            /* Get current VNC framebuffer row, advance to next */
            const unsigned char* vnc_current_pixel = vnc_current_row;
            vnc_current_row += vnc_stride;

            for (int dx = op_bounds.left; dx < op_bounds.right; dx++) {

                /* Read current VNC pixel value */
                uint32_t v;
                switch (vnc_bpp) {

                    case 2:
                        v = *((uint16_t*) vnc_current_pixel);
                        break;

                    default:
                        v = *((uint8_t*) vnc_current_pixel);

                }

                /* Translate value to 32-bit RGB */
                uint8_t red   = (v >> client->format.redShift)   * 0x100 / (client->format.redMax   + 1);
                uint8_t green = (v >> client->format.greenShift) * 0x100 / (client->format.greenMax + 1);
                uint8_t blue  = (v >> client->format.blueShift)  * 0x100 / (client->format.blueMax  + 1);

                /* Output RGB */
                if (vnc_client->settings->swap_red_blue)
                    *(layer_current_pixel++) = 0xFF000000 | (blue << 16) | (green << 8) | red;
                else
                    *(layer_current_pixel++) = 0xFF000000 | (red  << 16) | (green << 8) | blue;

                /* Advance to next pixel in VNC framebuffer */
                vnc_current_pixel += vnc_bpp;

            }
        }

    } /* end manual convert */

    /* Mark modified region as dirty */
    guac_rect_extend(&context->dirty, &op_bounds);

    /* Hint at source of copied data if this update involved CopyRect */
    if (vnc_client->copy_rect_used) {
        context->hint_from = default_layer;
        vnc_client->copy_rect_used = 0;
    }

    guac_display_render_thread_notify_modified(vnc_client->render_thread);

}

void guac_vnc_copyrect(rfbClient* client, int src_x, int src_y, int w, int h, int dest_x, int dest_y) {

    guac_client* gc = rfbClientGetClientData(client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = (guac_vnc_client*) gc->data;

    vnc_client->copy_rect_used = 1;

    /* Use original, wrapped proc to perform actual copy between regions of
     * libvncclient's display buffer */
    vnc_client->rfb_GotCopyRect(client, src_x, src_y, w, h, dest_x, dest_y);

}

#ifdef LIBVNC_HAS_RESIZE_SUPPORT
/**
 * This function does the actual work of sending the message to the RFB/VNC
 * server to request the resize, and then makes sure that the client frame
 * buffer is updated, as well.
 *
 * @param client
 *     The remote frame buffer client that is triggering the resize
 *     request.
 *
 * @param width
 *     The updated width of the screen.
 *
 * @param height
 *     The updated height of the screen.
 *
 * @return
 *     TRUE if the screen update was sent to the server, otherwise false. Note
 *     that a successful send of the resize message to the server does NOT mean
 *     that the server has any obligation to resize the display - it only
 *     indicates that the VNC library has successfully sent the request.
 */
static rfbBool guac_vnc_send_desktop_size(rfbClient* client, int width, int height) {

    /* Get the Guacamole client data */
    guac_client* gc = rfbClientGetClientData(client, GUAC_VNC_CLIENT_KEY);

    if (client->screen.width == 0 || client->screen.height == 0) {
        guac_client_log(gc, GUAC_LOG_DEBUG, "Screen data has not been initialized, yet.");
        return FALSE;
    }

    guac_client_log(gc, GUAC_LOG_TRACE,
            "Current screen size is %ix%i; setting new size %ix%i\n",
            rfbClientSwap16IfLE(client->screen.width),
            rfbClientSwap16IfLE(client->screen.height),
            width, height);

    /* Don't send an update if the requested dimensions are identical to current dimensions. */
    if (client->screen.width == rfbClientSwap16IfLE(width) && client->screen.height == rfbClientSwap16IfLE(height)) {
        guac_client_log(gc, GUAC_LOG_DEBUG, "Screen size has not changed, not sending update.");
        return FALSE;
    }

    /**
     * Note: The RFB protocol requires two message types to be sent during a
     * resize request - the first for the desktop size (total size of all
     * monitors), and then a message for each screen that is attached to the 
     * remote server. Both libvncclient and Guacamole only support a single
     * screen, so we send the desktop resize and screen resize with (nearly)
     * identical data, but if one or both of these components is updated in the
     * future to support multiple screens, this will need to be re-worked.
     */

    /* Set up the messages. */
    rfbSetDesktopSizeMsg size_msg = { 0 };
    rfbExtDesktopScreen new_screen = { 0 };

    /* Configure the desktop size update message. */
    size_msg.type = rfbSetDesktopSize;
    size_msg.width = rfbClientSwap16IfLE(width);
    size_msg.height = rfbClientSwap16IfLE(height);
    size_msg.numberOfScreens = 1;

    /* Configure the screen update message. */
    new_screen.id = GUAC_VNC_SCREEN_ID;
    new_screen.x = client->screen.x;
    new_screen.y = client->screen.y;
    new_screen.flags = client->screen.flags;

    new_screen.width = rfbClientSwap16IfLE(width);
    new_screen.height = rfbClientSwap16IfLE(height);

    /* Send the resize messages to the remote server. */
    if (!WriteToRFBServer(client, (char *)&size_msg, sz_rfbSetDesktopSizeMsg)
        || !WriteToRFBServer(client, (char *)&new_screen, sz_rfbExtDesktopScreen)) {

        guac_client_log(gc, GUAC_LOG_WARNING,
                "Failed to send new desktop and screen size to the VNC server.");
        return FALSE;

    }

    /* Update the client frame buffer with the requested size. */
    client->screen.width = rfbClientSwap16IfLE(width);
    client->screen.height = rfbClientSwap16IfLE(height);

#ifdef LIBVNC_CLIENT_HAS_REQUESTED_RESIZE
    client->requestedResize = FALSE;
#endif // LIBVNC_HAS_REQUESTED_RESIZE

    if (!SendFramebufferUpdateRequest(client, 0, 0, width, height, FALSE)) {
        guac_client_log(gc, GUAC_LOG_WARNING, "Failed to request a full screen update.");
    }

#ifdef LIBVNC_CLIENT_HAS_REQUESTED_RESIZE
    client->requestedResize = TRUE;
#endif // LIBVNC_HAS_REQUESTED_RESIZE

    /* Update should be successful. */
    return TRUE;

}

void* guac_vnc_display_set_owner_size(guac_user* owner, void* data) {

    /* Pull RFB clients from provided data. */
    rfbClient* rfb_client = (rfbClient*) data;

    guac_user_log(owner, GUAC_LOG_DEBUG, "Sending VNC display size for owner's display.");

    /* Set the display size. */
    guac_vnc_display_set_size(rfb_client, owner->info.optimal_width, owner->info.optimal_height);

    /* Always return NULL. */
    return NULL;

}

void guac_vnc_display_set_size(rfbClient* client, int requested_width, int requested_height) {

    /* Get the VNC client */
    guac_client* gc = rfbClientGetClientData(client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = (guac_vnc_client*) gc->data;

    guac_rect resize = {
        .left = 0,
        .top = 0,
        .right = requested_width,
        .bottom = requested_height
    };

    /* Fit width and height within bounds, maintaining aspect ratio */
    guac_rect_shrink(&resize, GUAC_DISPLAY_MAX_WIDTH, GUAC_DISPLAY_MAX_HEIGHT);
    int width = guac_rect_width(&resize);
    int height = guac_rect_height(&resize);

    if (width <= 0 || height <= 0) {
        guac_client_log(gc, GUAC_LOG_WARNING, "Ignoring request to resize "
                "desktop to %ix%i as the resulting display would be completely "
                "empty", requested_width, requested_height);
        return;
    }

    /* Acquire the lock for sending messages to server. */
    pthread_mutex_lock(&(vnc_client->message_lock));

    /* Send the display size update. */
    guac_client_log(gc, GUAC_LOG_TRACE, "Setting VNC display size.");
    if (guac_vnc_send_desktop_size(client, width, height))
        guac_client_log(gc, GUAC_LOG_TRACE, "Successfully sent desktop size message.");

    else
        guac_client_log(gc, GUAC_LOG_TRACE, "Failed to send desktop size message.");
    
    /* Release the lock. */
    pthread_mutex_unlock(&(vnc_client->message_lock));

}
#endif // LIBVNC_HAS_RESIZE_SUPPORT

void guac_vnc_set_pixel_format(rfbClient* client, int color_depth) {
    client->format.trueColour = 1;
    switch(color_depth) {
        case 8:
            client->format.depth        = 8;
            client->format.bitsPerPixel = 8;
            client->format.blueShift    = 6;
            client->format.redShift     = 0;
            client->format.greenShift   = 3;
            client->format.blueMax      = 3;
            client->format.redMax       = 7;
            client->format.greenMax     = 7;
            break;

        case 16:
            client->format.depth        = 16;
            client->format.bitsPerPixel = 16;
            client->format.blueShift    = 0;
            client->format.redShift     = 11;
            client->format.greenShift   = 5;
            client->format.blueMax      = 0x1f;
            client->format.redMax       = 0x1f;
            client->format.greenMax     = 0x3f;
            break;

        case 24:
        case 32:
        default:
            client->format.depth        = 24;
            client->format.bitsPerPixel = 32;
            client->format.blueShift    = 0;
            client->format.redShift     = 16;
            client->format.greenShift   = 8;
            client->format.blueMax      = 0xff;
            client->format.redMax       = 0xff;
            client->format.greenMax     = 0xff;
    }
}

rfbBool guac_vnc_malloc_framebuffer(rfbClient* rfb_client) {

    guac_client* gc = rfbClientGetClientData(rfb_client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = (guac_vnc_client*) gc->data;

    /* Use original, wrapped proc to resize the buffer maintained by
     * libvncclient */
    return vnc_client->rfb_MallocFrameBuffer(rfb_client);

}
