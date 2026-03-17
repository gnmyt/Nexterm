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
#include "guacamole/client.h"
#include "guacamole/display.h"
#include "guacamole/layer.h"
#include "guacamole/mem.h"
#include "guacamole/rwlock.h"

#include <cairo/cairo.h>
#include <stdlib.h>
#include <string.h>

/**
 * Performs a bulk copy of image data from a source buffer to a destination
 * buffer. The two buffers need not match in size and stride. If the
 * destination is smaller than the desired source, the source dimensions will
 * be adjusted to fit the available space.
 *
 * @param dst
 *     A pointer to the first byte of image data in the destination buffer.
 *
 * @param dst_stride
 *     The number of bytes in each row of image data in the destination buffer.
 *
 * @param dst_width
 *     The width of the destination buffer relative to the provided first byte,
 *     in pixels.
 *
 * @param dst_height
 *     The height of the destination buffer relative to the provided first byte,
 *     in pixels.
 *
 * @param src
 *     A pointer to the first byte of image data in the source buffer.
 *
 * @param src_stride
 *     The number of bytes in each row of image data in the source buffer.
 *
 * @param src_width
 *     The width of the source buffer relative to the provided first byte, in
 *     pixels. If this value is larger than dst_width, it will be adjusted to
 *     fit the available space.
 *
 * @param src_height
 *     The height of the source buffer relative to the provided first byte, in
 *     pixels. If this value is larger than dst_height, it will be adjusted to
 *     fit the available space.
 *
 * @param pixel_size
 *     The size of each pixel of image data, in bytes. The size of each pixel
 *     in both the destination and source buffers must be identical.
 */
static void guac_imgcpy(void* dst, size_t dst_stride, int dst_width, int dst_height,
        void* src, size_t src_stride, int src_width, int src_height,
        size_t pixel_size) {

    int width = dst_width;
    int height = dst_height;

    if (src_width  < width)  width  = src_width;
    if (src_height < height) height = src_height;

    GUAC_ASSERT(width >= 0);
    GUAC_ASSERT(height >= 0);

    size_t length = guac_mem_ckd_mul_or_die(width, pixel_size);

    for (size_t i = 0; i < height; i++) {
        memcpy(dst, src, length);
        dst = ((char*) dst) + dst_stride;
        src = ((char*) src) + src_stride;
    }

}

/**
 * Resizes the layer represented by the given pair of layer states to the given
 * dimensions, allocating a larger underlying image buffer if necessary. If no
 * image buffer has yet been allocated, an image buffer large enough to hold
 * the given dimensions will be automatically allocated.
 *
 * This function DOES NOT resize the pending cells array, which is not stored
 * on the guac_display_layer_state. When resizing a layer, the pending cells
 * array must be separately resized with a call to
 * PFW_guac_display_layer_pending_frame_cells_resize().
 *
 * @param last_frame
 *     The guac_display_layer_state representing the state of the layer at the
 *     end of the last frame sent to connected clients.
 *
 * @param pending_frame
 *     The guac_display_layer_state representing the current pending state of
 *     the layer for the upcoming frame to be eventually sent to connected
 *     clients.
 *
 * @param width
 *     The new width, in pixels.
 *
 * @param height
 *     The new height, in pixels.
 */
static void XFW_guac_display_layer_buffer_resize(guac_display_layer_state* frame_state,
        int width, int height) {

    /* We should never be trying to resize an externally-maintained buffer */
    GUAC_ASSERT(!frame_state->buffer_is_external);

    /* Round up to nearest multiple of resize factor */
    width  = ((width  + GUAC_DISPLAY_RESIZE_FACTOR - 1) / GUAC_DISPLAY_RESIZE_FACTOR) * GUAC_DISPLAY_RESIZE_FACTOR;
    height = ((height + GUAC_DISPLAY_RESIZE_FACTOR - 1) / GUAC_DISPLAY_RESIZE_FACTOR) * GUAC_DISPLAY_RESIZE_FACTOR;

    /* Do nothing if size isn't actually changing */
    if (width == frame_state->buffer_width
            && height == frame_state->buffer_height)
        return;

    int stride = cairo_format_stride_for_width(CAIRO_FORMAT_ARGB32, width);
    unsigned char* buffer = guac_mem_zalloc(height, stride);

    /* Copy over data from old shared buffer, if that data exists and is
     * relevant */

    if (frame_state->buffer != NULL) {

        guac_imgcpy(

                /* Copy to newly-allocated frame buffer ... */
                buffer, stride,
                width, height,

                /* ... from old frame buffer. */
                frame_state->buffer, frame_state->buffer_stride,
                frame_state->buffer_width, frame_state->buffer_height,

                /* All pixels are 32-bit */
                GUAC_DISPLAY_LAYER_RAW_BPP);

        guac_mem_free(frame_state->buffer);

    }

    frame_state->buffer = buffer;
    frame_state->buffer_width = width;
    frame_state->buffer_height = height;
    frame_state->buffer_stride = stride;

}

/**
 * Fully initializes the last and pending frame states for a newly-allocated
 * layer, including its underlying image buffers.
 *
 * @param last_frame
 *     The guac_display_layer_state representing the state of the layer at the
 *     end of the last frame sent to connected clients.
 *
 * @param pending_frame
 *     The guac_display_layer_state representing the current pending state of
 *     the layer for the upcoming frame to be eventually sent to connected
 *     clients.
 */
static void PFW_LFW_guac_display_layer_state_init(guac_display_layer_state* last_frame,
        guac_display_layer_state* pending_frame) {

    last_frame->width = pending_frame->width = GUAC_DISPLAY_RESIZE_FACTOR;
    last_frame->height = pending_frame->height = GUAC_DISPLAY_RESIZE_FACTOR;
    last_frame->opacity = pending_frame->opacity = 0xFF;
    last_frame->parent = pending_frame->parent = GUAC_DEFAULT_LAYER;

    XFW_guac_display_layer_buffer_resize(last_frame,
            last_frame->width, last_frame->height);

    XFW_guac_display_layer_buffer_resize(pending_frame,
            pending_frame->width, pending_frame->height);

}

/**
 * Resizes the pending_frame_cells array of the given layer to the given
 * dimensions.
 *
 * @param layer
 *     The layer whose pending_frame_cells array should be resized.
 *
 * @param width
 *     The new width, in pixels.
 *
 * @param height
 *     The new height, in pixels.
 */
static void PFW_guac_display_layer_pending_frame_cells_resize(guac_display_layer* layer,
        int width, int height) {

    int new_pending_frame_cells_width = GUAC_DISPLAY_CELL_DIMENSION(width);
    int new_pending_frame_cells_height = GUAC_DISPLAY_CELL_DIMENSION(height);

    /* Do nothing if size isn't actually changing */
    if (new_pending_frame_cells_width == layer->pending_frame_cells_width
            && new_pending_frame_cells_height == layer->pending_frame_cells_height)
        return;

    guac_display_layer_cell* new_pending_frame_cells = guac_mem_zalloc(sizeof(guac_display_layer_cell),
            new_pending_frame_cells_width, new_pending_frame_cells_height);

    /* Copy existing cells over to new memory if present */
    if (layer->pending_frame_cells != NULL) {

        size_t new_stride = guac_mem_ckd_mul_or_die(new_pending_frame_cells_width, sizeof(guac_display_layer_cell));
        size_t old_stride = guac_mem_ckd_mul_or_die(layer->pending_frame_cells_width, sizeof(guac_display_layer_cell));

        guac_imgcpy(

                /* Copy to newly-allocated pending frame cells ... */
                new_pending_frame_cells, new_stride,
                new_pending_frame_cells_width, new_pending_frame_cells_height,

                /* ... from old pending frame cells. */
                layer->pending_frame_cells, old_stride,
                layer->pending_frame_cells_width, layer->pending_frame_cells_height,

                /* All "pixels" are guac_display_layer_cell structures */
                sizeof(guac_display_layer_cell));

    }

    guac_mem_free(layer->pending_frame_cells);
    layer->pending_frame_cells = new_pending_frame_cells;
    layer->pending_frame_cells_width = new_pending_frame_cells_width;
    layer->pending_frame_cells_height = new_pending_frame_cells_height;

}

guac_display_layer* guac_display_add_layer(guac_display* display, guac_layer* layer, int opaque) {

    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    /* Init core layer members */
    guac_display_layer* display_layer = guac_mem_zalloc(sizeof(guac_display_layer));
    display_layer->display = display;
    display_layer->layer = layer;
    display_layer->opaque = opaque;

    /* Init tracking of pending and last frames (NOTE: We need not acquire the
     * display-wide last_frame.lock here as this new layer will not actually be
     * part of the last frame layer list until the pending frame is flushed) */
    PFW_LFW_guac_display_layer_state_init(&display_layer->last_frame, &display_layer->pending_frame);
    display_layer->last_frame_buffer = guac_client_alloc_buffer(display->client);
    PFW_guac_display_layer_pending_frame_cells_resize(display_layer,
            display_layer->pending_frame.width,
            display_layer->pending_frame.height);

    /* Insert list element as the new head */
    guac_display_layer* old_head = display->pending_frame.layers;
    display_layer->pending_frame.prev = NULL;
    display_layer->pending_frame.next = old_head;
    display->pending_frame.layers = display_layer;

    /* Update old head to point to new element, if it existed */
    if (old_head != NULL)
        old_head->pending_frame.prev = display_layer;

    guac_rwlock_release_lock(&display->pending_frame.lock);

    return display_layer;

}

void guac_display_remove_layer(guac_display_layer* display_layer) {

    guac_display* display = display_layer->display;

    /*
     * Remove layer from pending frame
     */

    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    /* Update previous element, if it exists */
    if (display_layer->pending_frame.prev != NULL)
        display_layer->pending_frame.prev->pending_frame.next = display_layer->pending_frame.next;

    /* If there is no previous element, then this element is the list head if
     * the list has any elements at all. Update the list head accordingly. */
    else if (display->pending_frame.layers != NULL) {
        GUAC_ASSERT(display->pending_frame.layers == display_layer);
        display->pending_frame.layers = display_layer->pending_frame.next;
    }

    /* Update next element, if it exists */
    if (display_layer->pending_frame.next != NULL)
        display_layer->pending_frame.next->pending_frame.prev = display_layer->pending_frame.prev;

    guac_rwlock_release_lock(&display->pending_frame.lock);

    /*
     * Remove layer from last frame
     */

    guac_rwlock_acquire_write_lock(&display->last_frame.lock);

    /* Update previous element, if it exists */
    if (display_layer->last_frame.prev != NULL)
        display_layer->last_frame.prev->last_frame.next = display_layer->last_frame.next;

    /* If there is no previous element, then this element is the list head if
     * the list has any elements at all. Update the list head accordingly. */
    else if (display->last_frame.layers != NULL) {
        GUAC_ASSERT(display->last_frame.layers == display_layer);
        display->last_frame.layers = display_layer->last_frame.next;
    }

    /* Update next element, if it exists */
    if (display_layer->last_frame.next != NULL)
        display_layer->last_frame.next->last_frame.prev = display_layer->last_frame.prev;

    guac_rwlock_release_lock(&display->last_frame.lock);

    /*
     * Layer has now been removed from both pending and last frame lists and
     * can be safely freed
     */

    guac_client* client = display->client;
    guac_client_free_buffer(client, display_layer->last_frame_buffer);

    /* Release any Cairo resources */
    guac_display_layer_cairo_context* cairo_context = &(display_layer->pending_frame_cairo_context);
    if (cairo_context->surface != NULL) {

        cairo_surface_destroy(cairo_context->surface);
        cairo_context->surface = NULL;

        cairo_destroy(cairo_context->cairo);
        cairo_context->cairo = NULL;

    }

    /* Free memory for underlying image surface and change tracking cells. Note
     * that we do NOT free the associated memory for the pending frame if it
     * was replaced with an external buffer. */

    if (!display_layer->pending_frame.buffer_is_external)
        guac_mem_free(display_layer->pending_frame.buffer);

    guac_mem_free(display_layer->last_frame.buffer);
    guac_mem_free(display_layer->pending_frame_cells);

    guac_mem_free(display_layer);

}

void PFW_guac_display_layer_resize(guac_display_layer* layer, int width, int height) {

    /* Flush and destroy any cached Cairo context */
    guac_display_layer_cairo_context* cairo_context = &(layer->pending_frame_cairo_context);
    if (cairo_context->surface != NULL) {

        cairo_surface_flush(cairo_context->surface);
        cairo_surface_destroy(cairo_context->surface);
        cairo_destroy(cairo_context->cairo);

        cairo_context->surface = NULL;
        cairo_context->cairo = NULL;

    }

    /* Skip resizing underlying buffer if it's the caller that's responsible
     * for resizing the buffer */
    if (!layer->pending_frame.buffer_is_external)
        XFW_guac_display_layer_buffer_resize(&layer->pending_frame, width, height);

    PFW_guac_display_layer_pending_frame_cells_resize(layer, width, height);

    layer->pending_frame.width = width;
    layer->pending_frame.height = height;

}
