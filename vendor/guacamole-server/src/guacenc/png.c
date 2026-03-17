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
#include "log.h"
#include "png.h"

#include <cairo/cairo.h>

#include <stdlib.h>
#include <string.h>

/**
 * The current state of the PNG decoder.
 */
typedef struct guacenc_png_read_state {

    /**
     * The buffer of unread image data. This pointer will be updated to point
     * to the next unread byte when data is read.
     */
    unsigned char* data;

    /**
     * The number of bytes remaining to be read within the buffer.
     */
    unsigned int length;

} guacenc_png_read_state;

/**
 * Attempts to fill the given buffer with read image data. The behavior of
 * this function is dictated by cairo_read_t.
 *
 * @param closure
 *     The current state of the PNG decoding process (an instance of
 *     guacenc_png_read_state).
 *
 * @param data
 *     The data buffer to fill.
 *
 * @param length
 *     The number of bytes to fill within the data buffer.
 *
 * @return
 *     CAIRO_STATUS_SUCCESS if all data was read successfully (the entire
 *     buffer was filled), CAIRO_STATUS_READ_ERROR otherwise.
 */
static cairo_status_t guacenc_png_read(void* closure, unsigned char* data,
        unsigned int length) {

    guacenc_png_read_state* state = (guacenc_png_read_state*) closure;

    /* If more data is requested than is available in buffer, fail */
    if (length > state->length)
        return CAIRO_STATUS_READ_ERROR;

    /* Read chunk into buffer */
    memcpy(data, state->data, length);

    /* Advance to next chunk */
    state->length -= length;
    state->data += length;

    /* Read was successful */
    return CAIRO_STATUS_SUCCESS;

}

cairo_surface_t* guacenc_png_decoder(unsigned char* data, int length) {

    guacenc_png_read_state state = {
        .data = data,
        .length = length
    };

    /* Read PNG from data */
    cairo_surface_t* surface =
        cairo_image_surface_create_from_png_stream(guacenc_png_read, &state);

    /* If surface returned with an error, just return NULL */
    if (surface != NULL &&
            cairo_surface_status(surface) != CAIRO_STATUS_SUCCESS) {
        guacenc_log(GUAC_LOG_WARNING, "Invalid PNG data");
        cairo_surface_destroy(surface);
        return NULL;
    }

    /* PNG was read successfully */
    return surface;

}

