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

#ifndef GUACENC_DISPLAY_H
#define GUACENC_DISPLAY_H

#include "config.h"
#include "buffer.h"
#include "cursor.h"
#include "image-stream.h"
#include "layer.h"
#include "video.h"

#include <cairo/cairo.h>
#include <guacamole/protocol.h>
#include <guacamole/timestamp.h>

/**
 * The maximum number of buffers that the Guacamole video encoder will handle
 * within a single Guacamole protocol dump.
 */
#define GUACENC_DISPLAY_MAX_BUFFERS 4096

/**
 * The maximum number of layers that the Guacamole video encoder will handle
 * within a single Guacamole protocol dump.
 */
#define GUACENC_DISPLAY_MAX_LAYERS 64

/**
 * The maximum number of streams that the Guacamole video encoder will handle
 * within a single Guacamole protocol dump.
 */
#define GUACENC_DISPLAY_MAX_STREAMS 64

/**
 * The current state of the Guacamole video encoder's internal display.
 */
typedef struct guacenc_display {

    /**
     * The current mouse cursor state.
     */
    guacenc_cursor* cursor;

    /**
     * All currently-allocated buffers. The index of the buffer corresponds to
     * its position within this array, where -1 is the 0th entry. If a buffer
     * has not yet been allocated, or a buffer has been freed (due to a
     * "dispose" instruction), its entry here will be NULL.
     */
    guacenc_buffer* buffers[GUACENC_DISPLAY_MAX_BUFFERS];

    /**
     * All currently-allocated layers. The index of the layer corresponds to
     * its position within this array. If a layer has not yet been allocated,
     * or a layer has been freed (due to a "dispose" instruction), its entry
     * here will be NULL.
     */
    guacenc_layer* layers[GUACENC_DISPLAY_MAX_LAYERS];

    /**
     * All currently-allocated image streams. The index of the stream
     * corresponds to its position within this array. If a stream has not yet
     * been allocated, or a stream has been freed (due to an "end"
     * instruction), its entry here will be NULL.
     */
    guacenc_image_stream* image_streams[GUACENC_DISPLAY_MAX_STREAMS];

    /**
     * The timestamp of the last sync instruction handled, or 0 if no sync has
     * yet been read.
     */
    guac_timestamp last_sync;

    /**
     * The video that this display is recording to.
     */
    guacenc_video* output;

} guacenc_display;

/**
 * Handles a received "sync" instruction having the given timestamp, flushing
 * the current display to the in-progress video encoding.
 *
 * @param display
 *     The display to flush to the video encoding as a new frame.
 *
 * @param timestamp
 *     The timestamp of the new frame, as dictated by the "sync" instruction
 *     sent at the end of the frame.
 *
 * @return
 *     Zero if the frame was successfully written, non-zero if an error occurs.
 */
int guacenc_display_sync(guacenc_display* display, guac_timestamp timestamp);

/**
 * Flattens the given display, rendering all child layers to the frame buffers
 * of their parent layers. The frame buffer of the default layer of the display
 * will thus contain the flattened, composited rendering of the entire display
 * state after this function succeeds. The contents of the frame buffers of
 * each layer are replaced by this function.
 *
 * @param display
 *     The display to flatten.
 *
 * @return
 *     Zero if the flatten operation succeeds, non-zero if an error occurs
 *     preventing proper rendering.
 */
int guacenc_display_flatten(guacenc_display* display);

/**
 * Allocates a new Guacamole video encoder display. This display serves as the
 * representation of encoding state, as well as the state of the Guacamole
 * display as instructions are read and handled.
 *
 * @param path
 *     The full path to the file in which encoded video should be written.
 *
 * @param codec
 *     The name of the codec to use for the video encoding, as defined by
 *     ffmpeg / libavcodec.
 *
 * @param width
 *     The width of the desired video, in pixels.
 *
 * @param height
 *     The height of the desired video, in pixels.
 *
 * @param bitrate
 *     The desired overall bitrate of the resulting encoded video, in bits per
 *     second.
 *
 * @return
 *     The newly-allocated Guacamole video encoder display, or NULL if the
 *     display could not be allocated.
 */
guacenc_display* guacenc_display_alloc(const char* path, const char* codec,
        int width, int height, int bitrate);

/**
 * Frees all memory associated with the given Guacamole video encoder display,
 * and finishes any underlying encoding process. If the given display is NULL,
 * this function has no effect.
 *
 * @param display
 *     The Guacamole video encoder display to free, which may be NULL.
 *
 * @return
 *     Zero if the encoding process completed successfully, non-zero otherwise.
 */
int guacenc_display_free(guacenc_display* display);

/**
 * Returns the layer having the given index. A new layer will be allocated if
 * necessary. If the layer having the given index already exists, it will be
 * returned.
 *
 * @param display
 *     The Guacamole video encoder display to retrieve the layer from.
 *
 * @param index
 *     The index of the layer to retrieve. All valid layer indices are
 *     non-negative.
 *
 * @return
 *     The layer having the given index, or NULL if the index is invalid or
 *     a new layer cannot be allocated.
 */
guacenc_layer* guacenc_display_get_layer(guacenc_display* display,
        int index);

/**
 * Returns the depth of a given layer in terms of parent layers. The layer
 * depth is the number of layers above the given layer in hierarchy, where a
 * layer without any parent (such as the default layer) has a depth of 0.
 *
 * @param layer
 *     The layer to check.
 *
 * @return
 *     The depth of the layer.
 */
int guacenc_display_get_depth(guacenc_display* display, guacenc_layer* layer);

/**
 * Frees all resources associated with the layer having the given index. If
 * the layer has not been allocated, this function has no effect.
 *
 * @param display
 *     The Guacamole video encoder display associated with the layer being
 *     freed.
 *
 * @param index
 *     The index of the layer to free. All valid layer indices are
 *     non-negative.
 *
 * @return
 *     Zero if the layer was successfully freed or was not allocated, non-zero
 *     if the layer could not be freed as the index was invalid.
 */
int guacenc_display_free_layer(guacenc_display* display, int index);

/**
 * Returns the buffer having the given index. A new buffer will be allocated if
 * necessary. If the buffer having the given index already exists, it will be
 * returned.
 *
 * @param display
 *     The Guacamole video encoder display to retrieve the buffer from.
 *
 * @param index
 *     The index of the buffer to retrieve. All valid buffer indices are
 *     negative.
 *
 * @return
 *     The buffer having the given index, or NULL if the index is invalid or
 *     a new buffer cannot be allocated.
 */
guacenc_buffer* guacenc_display_get_buffer(guacenc_display* display,
        int index);

/**
 * Frees all resources associated with the buffer having the given index. If
 * the buffer has not been allocated, this function has no effect.
 *
 * @param display
 *     The Guacamole video encoder display associated with the buffer being
 *     freed.
 *
 * @param index
 *     The index of the buffer to free. All valid buffer indices are negative.
 *
 * @return
 *     Zero if the buffer was successfully freed or was not allocated, non-zero
 *     if the buffer could not be freed as the index was invalid.
 */
int guacenc_display_free_buffer(guacenc_display* display, int index);

/**
 * Returns the buffer associated with the layer or buffer having the given
 * index. A new buffer or layer will be allocated if necessary. If the given
 * index refers to a layer (is non-negative), the buffer underlying that layer
 * will be returned. If the given index refers to a buffer (is negative), that
 * buffer will be returned directly.
 *
 * @param display
 *     The Guacamole video encoder display to retrieve the buffer from.
 *
 * @param index
 *     The index of the buffer or layer whose associated buffer should be
 *     retrieved.
 *
 * @return
 *     The buffer associated with the buffer or layer having the given index,
 *     or NULL if the index is invalid.
 */
guacenc_buffer* guacenc_display_get_related_buffer(guacenc_display* display,
        int index);

/**
 * Creates a new image stream having the given index. If the stream having the
 * given index already exists, it will be freed and replaced. If the mimetype
 * specified is not supported, the image stream will still be allocated but
 * will have no associated decoder (blobs send to that stream will have no
 * effect).
 *
 * @param display
 *     The Guacamole video encoder display to associate with the
 *     newly-created image stream.
 *
 * @param index
 *     The index of the stream to create. All valid stream indices are
 *     non-negative.
 *
 * @param mask
 *     The Guacamole protocol compositing operation (channel mask) to apply
 *     when drawing the image.
 *
 * @param layer_index
 *     The index of the layer or buffer that the image should be drawn to.
 *
 * @param mimetype
 *     The mimetype of the image data that will be received along this stream.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the rectangle within the
 *     destination layer or buffer that the image should be drawn to.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the rectangle within the
 *     destination layer or buffer that the image should be drawn to.
 *
 * @return
 *     Zero if the image stream was successfully created, non-zero otherwise.
 */
int guacenc_display_create_image_stream(guacenc_display* display, int index,
        int mask, int layer_index, const char* mimetype, int x, int y);

/**
 * Returns the stream having the given index. If no such stream exists, NULL
 * will be returned.
 *
 * @param display
 *     The Guacamole video encoder display to retrieve the image stream from.
 *
 * @param index
 *     The index of the stream to retrieve. All valid stream indices are
 *     non-negative.
 *
 * @return
 *     The stream having the given index, or NULL if the index is invalid or
 *     a no such stream exists.
 */
guacenc_image_stream* guacenc_display_get_image_stream(
        guacenc_display* display, int index);

/**
 * Frees all resources associated with the stream having the given index. If
 * the stream has not been allocated, this function has no effect.
 *
 * @param display
 *     The Guacamole video encoder display associated with the image stream
 *     being freed.
 *
 * @param index
 *     The index of the stream to free. All valid stream indices are
 *     non-negative.
 *
 * @return
 *     Zero if the stream was successfully freed or was not allocated, non-zero
 *     if the stream could not be freed as the index was invalid.
 */
int guacenc_display_free_image_stream(guacenc_display* display, int index);

/**
 * Translates the given Guacamole protocol compositing mode (channel mask) to
 * the corresponding Cairo composition operator. If no such operator exists,
 * CAIRO_OPERATOR_OVER will be returned by default.
 *
 * @param mask
 *     The Guacamole protocol compositing mode (channel mask) to translate.
 *
 * @return
 *     The cairo_operator_t that corresponds to the given compositing mode
 *     (channel mask). CAIRO_OPERATOR_OVER will be returned by default if no
 *     such operator exists.
 */
cairo_operator_t guacenc_display_cairo_operator(guac_composite_mode mask);

#endif

