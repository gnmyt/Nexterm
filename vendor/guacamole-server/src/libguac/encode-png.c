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

#include "encode-png.h"
#include "guacamole/mem.h"
#include "guacamole/error.h"
#include "guacamole/protocol.h"
#include "guacamole/stream.h"
#include "palette.h"

#include <png.h>
#include <cairo/cairo.h>

#ifdef HAVE_PNGSTRUCT_H
#include <pngstruct.h>
#endif

#include <inttypes.h>
#include <setjmp.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/**
 * Data describing the current write state of PNG data.
 */
typedef struct guac_png_write_state {

    /**
     * The socket over which all PNG blobs will be written.
     */
    guac_socket* socket;

    /**
     * The Guacamole stream to associate with each PNG blob.
     */
    guac_stream* stream;

    /**
     * Buffer of pending PNG data.
     */
    char buffer[GUAC_PROTOCOL_BLOB_MAX_LENGTH];

    /**
     * The number of bytes currently stored in the buffer.
     */
    int buffer_size;

} guac_png_write_state;

/**
 * Writes the contents of the PNG write state as a blob to its associated
 * socket.
 *
 * @param write_state
 *     The write state to flush.
 */
static void guac_png_flush_data(guac_png_write_state* write_state) {

    /* Send blob */
    guac_protocol_send_blob(write_state->socket, write_state->stream,
            write_state->buffer, write_state->buffer_size);

    /* Clear buffer */
    write_state->buffer_size = 0;

}

/**
 * Appends the given PNG data to the internal buffer of the given write state,
 * automatically flushing the write state as necessary.
 * socket.
 *
 * @param write_state
 *     The write state to append the given data to.
 *
 * @param data
 *     The PNG data to append.
 *
 * @param length
 *     The size of the given PNG data, in bytes.
 */
static void guac_png_write_data(guac_png_write_state* write_state,
        const void* data, int length) {

    const unsigned char* current = data;

    /* Append all data given */
    while (length > 0) {

        /* Calculate space remaining */
        int remaining = sizeof(write_state->buffer) - write_state->buffer_size;

        /* If no space remains, flush buffer to make room */
        if (remaining == 0) {
            guac_png_flush_data(write_state);
            remaining = sizeof(write_state->buffer);
        }

        /* Calculate size of next block of data to append */
        int block_size = remaining;
        if (block_size > length)
            block_size = length;

        /* Append block */
        memcpy(write_state->buffer + write_state->buffer_size,
                current, block_size);

        /* Next block */
        current += block_size;
        write_state->buffer_size += block_size;
        length -= block_size;

    }

}

/**
 * Writes the given buffer of PNG data to the buffer of the given write state,
 * flushing that buffer to blob instructions if necessary. This handler is
 * called by Cairo when writing PNG data via
 * cairo_surface_write_to_png_stream().
 *
 * @param closure
 *     Pointer to arbitrary data passed to cairo_surface_write_to_png_stream().
 *     In the case of this handler, this data will be the guac_png_write_state.
 *
 * @param data
 *     The buffer of PNG data to write.
 * 
 * @param length
 *     The size of the given buffer, in bytes.
 *
 * @return
 *     A Cairo status code indicating whether the write operation succeeded.
 *     In the case of this handler, this will always be CAIRO_STATUS_SUCCESS.
 */
static cairo_status_t guac_png_cairo_write_handler(void* closure,
        const unsigned char* data, unsigned int length) {

    guac_png_write_state* write_state = (guac_png_write_state*) closure;

    /* Append data to buffer, writing as necessary */
    guac_png_write_data(write_state, data, length);

    return CAIRO_STATUS_SUCCESS;

}

/**
 * Implementation of guac_png_write() which uses Cairo's own PNG encoder to
 * write PNG data, rather than using libpng directly.
 *
 * @param socket
 *     The socket to send PNG blobs over.
 *
 * @param stream
 *     The stream to associate with each blob.
 *
 * @param surface
 *     The Cairo surface to write to the given stream and socket as PNG blobs.
 *
 * @return
 *     Zero if the encoding operation is successful, non-zero otherwise.
 */
static int guac_png_cairo_write(guac_socket* socket, guac_stream* stream,
        cairo_surface_t* surface) {

    guac_png_write_state write_state;

    /* Init write state */
    write_state.socket = socket;
    write_state.stream = stream;
    write_state.buffer_size = 0;

    /* Write surface as PNG */
    if (cairo_surface_write_to_png_stream(surface,
                guac_png_cairo_write_handler,
                &write_state) != CAIRO_STATUS_SUCCESS) {
        guac_error = GUAC_STATUS_INTERNAL_ERROR;
        guac_error_message = "Cairo PNG backend failed";
        return -1;
    }

    /* Flush remaining PNG data */
    guac_png_flush_data(&write_state);
    return 0;

}

/**
 * Writes the given buffer of PNG data to the buffer of the given write state,
 * flushing that buffer to blob instructions if necessary. This handler is
 * called by libpng when writing PNG data via png_write_png().
 *
 * @param png
 *     The PNG compression state structure associated with the write operation.
 *     The pointer to arbitrary data will have been set to the
 *     guac_png_write_state by png_set_write_fn(), and will be accessible via
 *     png->io_ptr or png_get_io_ptr(png), depending on the version of libpng.
 *
 * @param data
 *     The buffer of PNG data to write.
 * 
 * @param length
 *     The size of the given buffer, in bytes.
 */
static void guac_png_write_handler(png_structp png, png_bytep data,
        png_size_t length) {

    /* Get png buffer structure */
    guac_png_write_state* write_state;
#ifdef HAVE_PNG_GET_IO_PTR
    write_state = (guac_png_write_state*) png_get_io_ptr(png);
#else
    write_state = (guac_png_write_state*) png->io_ptr;
#endif

    /* Append data to buffer, writing as necessary */
    guac_png_write_data(write_state, data, length);

}

/**
 * Flushes any PNG data within the buffer of the given write state as a blob
 * instruction. If no data is within the buffer, this function has no effect.
 * This handler is called by libpng when it has finished writing PNG data via
 * png_write_png().
 *
 * @param png
 *     The PNG compression state structure associated with the write operation.
 *     The pointer to arbitrary data will have been set to the
 *     guac_png_write_state by png_set_write_fn(), and will be accessible via
 *     png->io_ptr or png_get_io_ptr(png), depending on the version of libpng.
 */
static void guac_png_flush_handler(png_structp png) {

    /* Get png buffer structure */
    guac_png_write_state* write_state;
#ifdef HAVE_PNG_GET_IO_PTR
    write_state = (guac_png_write_state*) png_get_io_ptr(png);
#else
    write_state = (guac_png_write_state*) png->io_ptr;
#endif

    /* Flush buffer */
    guac_png_flush_data(write_state);

}

int guac_png_write(guac_socket* socket, guac_stream* stream,
        cairo_surface_t* surface) {

    png_structp png;
    png_infop png_info;
    png_byte** png_rows;
    int bpp;

    int x, y;

    guac_png_write_state write_state;

    /* Get image surface properties and data */
    cairo_format_t format = cairo_image_surface_get_format(surface);
    int width = cairo_image_surface_get_width(surface);
    int height = cairo_image_surface_get_height(surface);
    int stride = cairo_image_surface_get_stride(surface);
    unsigned char* data = cairo_image_surface_get_data(surface);

    /* If not RGB24, use Cairo PNG writer */
    if (format != CAIRO_FORMAT_RGB24 || data == NULL)
        return guac_png_cairo_write(socket, stream, surface);

    /* Flush pending operations to surface */
    cairo_surface_flush(surface);

    /* Attempt to build palette */
    guac_palette* palette = guac_palette_alloc(surface);

    /* If not possible, resort to Cairo PNG writer */
    if (palette == NULL)
        return guac_png_cairo_write(socket, stream, surface);

    /* Calculate BPP from palette size */
    if      (palette->size <= 2)  bpp = 1;
    else if (palette->size <= 4)  bpp = 2;
    else if (palette->size <= 16) bpp = 4;
    else                          bpp = 8;

    /* Set up PNG writer */
    png = png_create_write_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);
    if (!png) {
        guac_palette_free(palette);
        guac_error = GUAC_STATUS_INTERNAL_ERROR;
        guac_error_message = "libpng failed to create write structure";
        return -1;
    }

    png_info = png_create_info_struct(png);
    if (!png_info) {
        png_destroy_write_struct(&png, NULL);
        guac_palette_free(palette);
        guac_error = GUAC_STATUS_INTERNAL_ERROR;
        guac_error_message = "libpng failed to create info structure";
        return -1;
    }

    /* Set error handler */
    if (setjmp(png_jmpbuf(png))) {
        png_destroy_write_struct(&png, &png_info);
        guac_palette_free(palette);
        guac_error = GUAC_STATUS_IO_ERROR;
        guac_error_message = "libpng output error";
        return -1;
    }

    /* Init write state */
    write_state.socket = socket;
    write_state.stream = stream;
    write_state.buffer_size = 0;

    /* Set up writer */
    png_set_write_fn(png, &write_state,
            guac_png_write_handler,
            guac_png_flush_handler);

    /* Copy data from surface into PNG data */
    png_rows = (png_byte**) guac_mem_alloc(sizeof(png_byte*), height);
    for (y=0; y<height; y++) {

        /* Allocate new PNG row */
        png_byte* row = (png_byte*) guac_mem_alloc(sizeof(png_byte), width);
        png_rows[y] = row;

        /* Copy data from surface into current row */
        for (x=0; x<width; x++) {

            /* Get pixel color */
            int color = ((uint32_t*) data)[x] & 0xFFFFFF;

            /* Set index in row */
            row[x] = guac_palette_find(palette, color);

        }

        /* Advance to next data row */
        data += stride;

    }

    /* Write image info */
    png_set_IHDR(
        png,
        png_info,
        width,
        height,
        bpp,
        PNG_COLOR_TYPE_PALETTE,
        PNG_INTERLACE_NONE,
        PNG_COMPRESSION_TYPE_DEFAULT,
        PNG_FILTER_TYPE_DEFAULT
    );

    /* Write palette */
    png_set_PLTE(png, png_info, palette->colors, palette->size);

    /* Write image */
    png_set_rows(png, png_info, png_rows);
    png_write_png(png, png_info, PNG_TRANSFORM_PACKING, NULL);

    /* Finish write */
    png_destroy_write_struct(&png, &png_info);

    /* Free palette */
    guac_palette_free(palette);

    /* Free PNG data */
    for (y=0; y<height; y++)
        guac_mem_free(png_rows[y]);
    guac_mem_free(png_rows);

    /* Ensure all data is written */
    guac_png_flush_data(&write_state);
    return 0;

}

