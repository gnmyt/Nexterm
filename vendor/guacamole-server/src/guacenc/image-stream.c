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
#include "display.h"
#include "image-stream.h"
#include "jpeg.h"
#include "log.h"
#include "png.h"

#ifdef ENABLE_WEBP
#include "webp.h"
#endif

#include <cairo/cairo.h>
#include <guacamole/mem.h>

#include <stdlib.h>
#include <string.h>

guacenc_decoder_mapping guacenc_decoder_map[] = {
    {"image/png",  guacenc_png_decoder},
    {"image/jpeg", guacenc_jpeg_decoder},
#ifdef ENABLE_WEBP
    {"image/webp", guacenc_webp_decoder},
#endif
    {NULL,         NULL}
};

guacenc_decoder* guacenc_get_decoder(const char* mimetype) {

    /* Search through mapping for the decoder having given mimetype */
    guacenc_decoder_mapping* current = guacenc_decoder_map;
    while (current->mimetype != NULL) {

        /* Return decoder if mimetype matches */
        if (strcmp(current->mimetype, mimetype) == 0)
            return current->decoder;

        /* Next candidate decoder */
        current++;

    }

    /* No such decoder */
    guacenc_log(GUAC_LOG_WARNING, "Support for \"%s\" not present", mimetype);
    return NULL;

}

guacenc_image_stream* guacenc_image_stream_alloc(int mask, int index,
        const char* mimetype, int x, int y) {

    /* Allocate stream */
    guacenc_image_stream* stream = guac_mem_alloc(sizeof(guacenc_image_stream));
    if (stream == NULL)
        return NULL;

    /* Init properties */
    stream->index = index;
    stream->mask = mask;
    stream->x = x;
    stream->y = y;

    /* Associate with corresponding decoder */
    stream->decoder = guacenc_get_decoder(mimetype);

    /* Allocate initial buffer */
    stream->length = 0;
    stream->max_length = GUACENC_IMAGE_STREAM_INITIAL_LENGTH;
    stream->buffer = (unsigned char*) guac_mem_alloc(stream->max_length);

    return stream;

}

int guacenc_image_stream_receive(guacenc_image_stream* stream,
        unsigned char* data, int length) {

    /* Allocate more space if necessary */
    if (stream->max_length - stream->length < length) {

        /* Calculate a reasonable new max length guaranteed to fit buffer */
        size_t new_max_length = guac_mem_ckd_add_or_die(
                guac_mem_ckd_mul_or_die(stream->max_length, 2), length);

        /* Attempt to resize buffer */
        unsigned char* new_buffer =
            (unsigned char*) guac_mem_realloc(stream->buffer, new_max_length);
        if (new_buffer == NULL)
            return 1;

        /* Store updated buffer and size */
        stream->buffer = new_buffer;
        stream->max_length = new_max_length;

    }

    /* Append data */
    memcpy(stream->buffer + stream->length, data, length);
    stream->length += length;
    return 0;

}

int guacenc_image_stream_end(guacenc_image_stream* stream,
        guacenc_buffer* buffer) {

    /* If there is no decoder, simply return success */
    guacenc_decoder* decoder = stream->decoder;
    if (decoder == NULL)
        return 0;

    /* Decode received data to a Cairo surface */
    cairo_surface_t* surface = stream->decoder(stream->buffer, stream->length);
    if (surface == NULL)
        return 1;

    /* Get surface dimensions */
    int width = cairo_image_surface_get_width(surface);
    int height = cairo_image_surface_get_height(surface);

    /* Expand the buffer as necessary to fit the draw operation */
    if (buffer->autosize)
        guacenc_buffer_fit(buffer, stream->x + width, stream->y + height);

    /* Draw surface to buffer */
    if (buffer->cairo != NULL) {
        cairo_set_operator(buffer->cairo, guacenc_display_cairo_operator(stream->mask));
        cairo_set_source_surface(buffer->cairo, surface, stream->x, stream->y);
        cairo_rectangle(buffer->cairo, stream->x, stream->y, width, height);
        cairo_fill(buffer->cairo);
    }

    cairo_surface_destroy(surface);
    return 0;

}

int guacenc_image_stream_free(guacenc_image_stream* stream) {

    /* Ignore NULL streams */
    if (stream == NULL)
        return 0;

    /* Free image buffer */
    guac_mem_free(stream->buffer);

    /* Free actual stream */
    guac_mem_free(stream);
    return 0;

}

