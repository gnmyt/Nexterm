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

#include "display-priv.h"
#include "guacamole/assert.h"
#include "guacamole/display.h"
#include "guacamole/rect.h"
#include "guacamole/rwlock.h"

#include <cairo/cairo.h>
#include <stdint.h>
#include <string.h>

/**
 * Notifies the display associated with the given layer that the given layer
 * has been modified in some way for the current pending frame. If the layer is
 * not the cursor layer, the pending_frame_dirty_excluding_mouse flag of the
 * display is updated accordingly.
 *
 * @param layer
 *     The layer that was modified.
 */
static void PFW_guac_display_layer_touch(guac_display_layer* layer) {

    guac_display* display = layer->display;

    if (layer != display->cursor_buffer)
        display->pending_frame_dirty_excluding_mouse = 1;

}

void guac_display_layer_get_bounds(guac_display_layer* layer, guac_rect* bounds) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_read_lock(&display->pending_frame.lock);

    *bounds = (guac_rect) {
        .left   = 0,
        .top    = 0,
        .right  = layer->pending_frame.width,
        .bottom = layer->pending_frame.height
    };

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_layer_move(guac_display_layer* layer, int x, int y) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    layer->pending_frame.x = x;
    layer->pending_frame.y = y;
    PFW_guac_display_layer_touch(layer);

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_layer_stack(guac_display_layer* layer, int z) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    layer->pending_frame.z = z;
    PFW_guac_display_layer_touch(layer);

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_layer_set_parent(guac_display_layer* layer, const guac_display_layer* parent) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    layer->pending_frame.parent = parent->layer;
    PFW_guac_display_layer_touch(layer);

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_layer_set_opacity(guac_display_layer* layer, int opacity) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    layer->pending_frame.opacity = opacity;
    PFW_guac_display_layer_touch(layer);

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_layer_set_lossless(guac_display_layer* layer, int lossless) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    layer->pending_frame.lossless = lossless;
    PFW_guac_display_layer_touch(layer);

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_layer_set_multitouch(guac_display_layer* layer, int touches) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    layer->pending_frame.touches = touches;
    PFW_guac_display_layer_touch(layer);

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_layer_resize(guac_display_layer* layer, int width, int height) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    PFW_guac_display_layer_resize(layer, width, height);
    PFW_guac_display_layer_touch(layer);

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_layer_raw_context_set(guac_display_layer_raw_context* context,
        const guac_rect* dst, uint32_t color) {

    size_t dst_stride = context->stride;
    unsigned char* restrict dst_buffer = GUAC_DISPLAY_LAYER_RAW_BUFFER(context, *dst);

    for (int dy = dst->top; dy < dst->bottom; dy++) {

        uint32_t* dst_pixel = (uint32_t*) dst_buffer;
        dst_buffer += dst_stride;

        for (int dx = dst->left; dx < dst->right; dx++)
            *(dst_pixel++) = color;

    }

    guac_rect_extend(&(context->dirty), dst);

}

void guac_display_layer_raw_context_put(guac_display_layer_raw_context* context,
        const guac_rect* dst, const void* restrict buffer, size_t stride) {

    size_t dst_stride = context->stride;
    unsigned char* restrict dst_buffer = GUAC_DISPLAY_LAYER_RAW_BUFFER(context, *dst);
    const unsigned char* restrict src_buffer = (const unsigned char*) buffer;

    size_t copy_length = guac_mem_ckd_mul_or_die(guac_rect_width(dst),
            GUAC_DISPLAY_LAYER_RAW_BPP);

    for (int dy = dst->top; dy < dst->bottom; dy++) {
        memcpy(dst_buffer, src_buffer, copy_length);
        dst_buffer += dst_stride;
        src_buffer += stride;
    }

    guac_rect_extend(&(context->dirty), dst);

}

guac_display_layer_raw_context* guac_display_layer_open_raw(guac_display_layer* layer) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    /* Flush any outstanding Cairo operations before directly accessing buffer */
    guac_display_layer_cairo_context* cairo_context = &(layer->pending_frame_cairo_context);
    if (cairo_context->surface != NULL)
        cairo_surface_flush(cairo_context->surface);

    layer->pending_frame_raw_context = (guac_display_layer_raw_context) {
        .buffer = layer->pending_frame.buffer,
        .stride = layer->pending_frame.buffer_stride,
        .dirty = { 0 },
        .hint_from = layer,
        .bounds = {
            .left   = 0,
            .top    = 0,
            .right  = layer->pending_frame.buffer_width,
            .bottom = layer->pending_frame.buffer_height
        }
    };

    return &layer->pending_frame_raw_context;

}

void guac_display_layer_close_raw(guac_display_layer* layer, guac_display_layer_raw_context* context) {

    guac_display* display = layer->display;

    /* Replace buffer if requested with an external buffer. This intentionally
     * falls through to the following buffer_is_external check to update the
     * buffer details. */
    if (context->buffer != layer->pending_frame.buffer
            && !layer->pending_frame.buffer_is_external) {
        guac_mem_free(layer->pending_frame.buffer);
        layer->pending_frame.buffer_is_external = 1;
    }

    /* The details covering the structure of the buffer and the dimensions of
     * the layer must be copied from the context if the buffer is external
     * (there is no other way to resize a layer with an external buffer) */
    if (layer->pending_frame.buffer_is_external) {

        int width = guac_rect_width(&context->bounds);
        if (width > GUAC_DISPLAY_MAX_WIDTH)
            width = GUAC_DISPLAY_MAX_WIDTH;

        int height = guac_rect_height(&context->bounds);
        if (height > GUAC_DISPLAY_MAX_HEIGHT)
            height = GUAC_DISPLAY_MAX_HEIGHT;

        /* Release any Cairo surface that was created around the external
         * buffer, in case the details of the buffer have now changed */
        guac_display_layer_cairo_context* cairo_context = &(layer->pending_frame_cairo_context);
        if (cairo_context->surface != NULL) {
            cairo_surface_destroy(cairo_context->surface);
            cairo_context->surface = NULL;
        }

        layer->pending_frame.buffer = context->buffer;
        layer->pending_frame.buffer_width = width;
        layer->pending_frame.buffer_height = height;
        layer->pending_frame.buffer_stride = context->stride;

        layer->pending_frame.width = layer->pending_frame.buffer_width;
        layer->pending_frame.height = layer->pending_frame.buffer_height;

    }

    guac_rect_extend(&layer->pending_frame.dirty, &context->dirty);
    PFW_guac_display_layer_touch(layer);

    /* Apply any hinting regarding scroll/copy optimization */
    if (context->hint_from != NULL)
        context->hint_from->pending_frame.search_for_copies = 1;

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

guac_display_layer_cairo_context* guac_display_layer_open_cairo(guac_display_layer* layer) {

    guac_display* display = layer->display;
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    /* It is intentionally allowed that the pending frame buffer can be
     * replaced with NULL to ensure that references to external buffers can be
     * removed prior to guac_display being freed. If the buffer has been
     * manually replaced with NULL, further use of that buffer via Cairo
     * contexts is not safe nor allowed. */
    GUAC_ASSERT(layer->pending_frame.buffer != NULL);

    guac_display_layer_cairo_context* context = &(layer->pending_frame_cairo_context);

    context->dirty = (guac_rect) { 0 };
    context->hint_from = layer;
    context->bounds = (guac_rect) {
        .left   = 0,
        .top    = 0,
        .right  = layer->pending_frame.buffer_width,
        .bottom = layer->pending_frame.buffer_height
    };

    if (context->surface == NULL) {

        context->surface = cairo_image_surface_create_for_data(
                layer->pending_frame.buffer,
                layer->opaque ? CAIRO_FORMAT_RGB24 : CAIRO_FORMAT_ARGB32,
                layer->pending_frame.buffer_width,
                layer->pending_frame.buffer_height,
                layer->pending_frame.buffer_stride);

        context->cairo = cairo_create(context->surface);

    }

    return context;

}

void guac_display_layer_close_cairo(guac_display_layer* layer, guac_display_layer_cairo_context* context) {

    guac_display* display = layer->display;

    guac_rect_extend(&layer->pending_frame.dirty, &context->dirty);
    PFW_guac_display_layer_touch(layer);

    /* Apply any hinting regarding scroll/copy optimization */
    if (context->hint_from != NULL)
        context->hint_from->pending_frame.search_for_copies = 1;

    guac_rwlock_release_lock(&display->pending_frame.lock);

}
