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

#include "color.h"
#include "gdi.h"
#include "pointer.h"
#include "rdp.h"

#include <cairo/cairo.h>
#include <freerdp/codec/color.h>
#include <freerdp/freerdp.h>
#include <freerdp/gdi/gdi.h>
#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/mem.h>
#include <winpr/crt.h>

BOOL guac_rdp_pointer_new(rdpContext* context, rdpPointer* pointer) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Allocate buffer */
    guac_display_layer* buffer = guac_display_alloc_buffer(rdp_client->display, 0);

    guac_display_layer_resize(buffer, pointer->width, pointer->height);
    guac_display_layer_raw_context* dst_context = guac_display_layer_open_raw(buffer);

    guac_rect dst_rect = {
        .left   = 0,
        .top    = 0,
        .right  = pointer->width,
        .bottom = pointer->height
    };

    guac_rect_constrain(&dst_rect, &dst_context->bounds);

    /* Convert to alpha cursor using mask data */
    freerdp_image_copy_from_pointer_data(GUAC_DISPLAY_LAYER_RAW_BUFFER(dst_context, dst_rect),
        guac_rdp_get_native_pixel_format(TRUE), dst_context->stride, 0, 0,
        pointer->width, pointer->height, pointer->xorMaskData,
        pointer->lengthXorMask, pointer->andMaskData,
        pointer->lengthAndMask, pointer->xorBpp,
        &context->gdi->palette);

    guac_rect_extend(&dst_context->dirty, &dst_rect);

    guac_display_layer_close_raw(buffer, dst_context);

    /* Remember buffer */
    ((guac_rdp_pointer*) pointer)->layer = buffer;

    return TRUE;

}

BOOL guac_rdp_pointer_set(rdpContext* context, POINTER_SET_CONST rdpPointer* pointer) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    guac_display_layer* src_layer = ((guac_rdp_pointer*) pointer)->layer;
    guac_display_layer_raw_context* src_context = guac_display_layer_open_raw(src_layer);

    guac_display_layer* cursor_layer = guac_display_cursor(rdp_client->display);

    guac_display_layer_resize(cursor_layer, pointer->width, pointer->height);
    guac_display_layer_raw_context* dst_context = guac_display_layer_open_raw(cursor_layer);

    guac_rect ptr_rect = {
        .left   = 0,
        .top    = 0,
        .right  = pointer->width,
        .bottom = pointer->height
    };

    guac_rect_constrain(&ptr_rect, &src_context->bounds);
    guac_rect_constrain(&ptr_rect, &dst_context->bounds);

    /* Set cursor */
    guac_display_layer_raw_context_put(dst_context, &ptr_rect, src_context->buffer, src_context->stride);
    dst_context->hint_from = src_layer;
    guac_rect_extend(&dst_context->dirty, &ptr_rect);

    guac_display_set_cursor_hotspot(rdp_client->display, pointer->xPos, pointer->yPos);

    guac_display_layer_close_raw(cursor_layer, dst_context);
    guac_display_layer_close_raw(src_layer, src_context);

    guac_display_render_thread_notify_modified(rdp_client->render_thread);
    return TRUE;

}

void guac_rdp_pointer_free(rdpContext* context, rdpPointer* pointer) {

    guac_display_layer* buffer = ((guac_rdp_pointer*) pointer)->layer;

    /* Free buffer */
    guac_display_free_layer(buffer);

    /* NOTE: FreeRDP-allocated memory for the rdpPointer will be automatically
     * released after this free handler is invoked */

}

BOOL guac_rdp_pointer_set_null(rdpContext* context) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Set cursor to empty/blank graphic */
    guac_display_set_cursor(rdp_client->display, GUAC_DISPLAY_CURSOR_NONE);

    guac_display_render_thread_notify_modified(rdp_client->render_thread);
    return TRUE;

}

BOOL guac_rdp_pointer_set_default(rdpContext* context) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Set cursor to embedded pointer */
    guac_display_set_cursor(rdp_client->display, GUAC_DISPLAY_CURSOR_POINTER);

    guac_display_render_thread_notify_modified(rdp_client->render_thread);
    return TRUE;
}
