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

#ifndef GUACENC_IMAGE_STREAM_H
#define GUACENC_IMAGE_STREAM_H

#include "config.h"
#include "buffer.h"

#include <cairo/cairo.h>

#include <stddef.h>

/**
 * The initial number of bytes to allocate for the image data buffer. If this
 * buffer is not sufficiently large, it will be dynamically reallocated as it
 * grows.
 */
#define GUACENC_IMAGE_STREAM_INITIAL_LENGTH 4096

/**
 * Callback function which is provided raw, encoded image data of the given
 * length. The function is expected to return a new Cairo surface which will
 * later (by guacenc) be freed via cairo_surface_destroy().
 *
 * @param data
 *     The raw encoded image data that this function must decode.
 *
 * @param length
 *     The length of the image data, in bytes.
 *
 * @return
 *     A newly-allocated Cairo surface containing the decoded image, or NULL
 *     or decoding fails.
 */
typedef cairo_surface_t* guacenc_decoder(unsigned char* data, int length);

/**
 * The current state of an allocated Guacamole image stream.
 */
typedef struct guacenc_image_stream {

    /**
     * The index of the destination layer or buffer.
     */
    int index;

    /**
     * The Guacamole protocol compositing operation (channel mask) to apply
     * when drawing the image.
     */
    int mask;

    /**
     * The X coordinate of the upper-left corner of the rectangle within the
     * destination layer or buffer that the decoded image should be drawn to.
     */
    int x;

    /**
     * The Y coordinate of the upper-left corner of the rectangle within the
     * destination layer or buffer that the decoded image should be drawn to.
     */
    int y;

    /**
     * Buffer of image data which will be built up over time as chunks are
     * received via "blob" instructions. This will ultimately be passed in its
     * entirety to the decoder function.
     */
    unsigned char* buffer;

    /**
     * The number of bytes currently stored in the buffer.
     */
    size_t length;

    /**
     * The maximum number of bytes that can be stored in the current buffer
     * before it must be reallocated.
     */
    size_t max_length;

    /**
     * The decoder to use when decoding the raw data received along this
     * stream, or NULL if no such decoder exists.
     */
    guacenc_decoder* decoder;

} guacenc_image_stream;

/**
 * Mapping of image mimetype to corresponding decoder function.
 */
typedef struct guacenc_decoder_mapping {

    /**
     * The mimetype of the image that the associated decoder can read.
     */
    const char* mimetype;

    /**
     * The decoder function to use when an image stream of the associated
     * mimetype is received.
     */
    guacenc_decoder* decoder;

} guacenc_decoder_mapping;

/**
 * Array of all mimetype/decoder mappings for all supported image types,
 * terminated by an entry with a NULL mimetype.
 */
extern guacenc_decoder_mapping guacenc_decoder_map[];

/**
 * Returns the decoder associated with the given mimetype. If no such decoder
 * exists, NULL is returned.
 *
 * @param mimetype
 *     The image mimetype to return the associated decoder of.
 *
 * @return
 *     The decoder associated with the given mimetype, or NULL if no such
 *     decoder exists.
 */
guacenc_decoder* guacenc_get_decoder(const char* mimetype);

/**
 * Allocates and initializes a new image stream. This allocation is independent
 * of the Guacamole video encoder display; the allocated guacenc_image_stream
 * will not automatically be associated with the active display, nor will the
 * provided layer/buffer index be validated.
 *
 * @param mask
 *     The Guacamole protocol compositing operation (channel mask) to apply
 *     when drawing the image.
 *
 * @param index
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
 *     A newly-allocated and initialized guacenc_image_stream, or NULL if
 *     allocation fails.
 */
guacenc_image_stream* guacenc_image_stream_alloc(int mask, int index,
        const char* mimetype, int x, int y);

/**
 * Appends newly-received data to the internal buffer of the given image
 * stream, such that the entire received image can be fed to the decoder as one
 * buffer once the stream ends.
 *
 * @param stream
 *     The image stream that received the data.
 *
 * @param data
 *     The chunk of data received along the image stream.
 *
 * @param length
 *     The length of the chunk of data received, in bytes.
 *
 * @return
 *     Zero if the given data was successfully appended to the in-progress
 *     image, non-zero if an error occurs.
 */
int guacenc_image_stream_receive(guacenc_image_stream* stream,
        unsigned char* data, int length);

/**
 * Marks the end of the given image stream (no more data will be received) and
 * invokes the associated decoder. The decoded image will be written to the
 * given buffer as-is. If no decoder is associated with the given image stream,
 * this function has no effect. Meta-information describing the image draw
 * operation itself is pulled from the guacenc_image_stream, having been stored
 * there when the image stream was created.
 *
 * @param stream
 *     The image stream that has ended.
 *
 * @param buffer
 *     The buffer that the decoded image should be written to.
 *
 * @return
 *     Zero if the image is written successfully, or non-zero if an error
 *     occurs.
 */
int guacenc_image_stream_end(guacenc_image_stream* stream,
        guacenc_buffer* buffer);

/**
 * Frees the given image stream and all associated data. If the image stream
 * has not yet ended (reached end-of-stream), no image will be drawn to the
 * associated buffer or layer.
 *
 * @param stream
 *     The stream to free.
 *
 * @return
 *     Zero if freeing the stream succeeded, or non-zero if freeing the stream
 *     failed (for example, due to an error in the free handler of the
 *     decoder).
 */
int guacenc_image_stream_free(guacenc_image_stream* stream);

#endif

