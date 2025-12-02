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
#include "buffer.h"

#include <cairo/cairo.h>
#include <guacamole/mem.h>

#include <assert.h>
#include <stdlib.h>

guacenc_buffer* guacenc_buffer_alloc() {
    return guac_mem_zalloc(sizeof(guacenc_buffer));
}

/**
 * Frees the underlying image data, surface, and graphics context of the given
 * buffer, marking each as unallocated.
 *
 * @param buffer
 *     The guacenc_buffer whose image data, surface, and graphics context
 *     should be freed.
 */
static void guacenc_buffer_free_image(guacenc_buffer* buffer) {

    /* Free graphics context */
    if (buffer->cairo != NULL) {
        cairo_destroy(buffer->cairo);
        buffer->cairo = NULL;
    }

    /* Free Cairo surface */
    if (buffer->surface != NULL) {
        cairo_surface_destroy(buffer->surface);
        buffer->surface = NULL;
    }

    /* Free image data (previously wrapped by Cairo surface */
    guac_mem_free(buffer->image);
    buffer->image = NULL;

}

void guacenc_buffer_free(guacenc_buffer* buffer) {

    /* Ignore NULL buffer */
    if (buffer == NULL)
        return;

    /* Free buffer and underlying image */
    guacenc_buffer_free_image(buffer);
    guac_mem_free(buffer);

}

int guacenc_buffer_resize(guacenc_buffer* buffer, int width, int height) {

    /* Ignore requests which do not change the size */
    if (buffer->width == width && buffer->height == height)
        return 0;

    /* Simply deallocate if new image has absolutely no pixels */
    if (width == 0 || height == 0) {
        guacenc_buffer_free_image(buffer);
        buffer->width = width;
        buffer->height = height;
        buffer->stride = 0;
        return 0;
    }

    /* Allocate data for new image */
    int stride = cairo_format_stride_for_width(CAIRO_FORMAT_ARGB32, width);
    unsigned char* image = guac_mem_zalloc(stride, height);

    /* Wrap data in surface */
    cairo_surface_t* surface = cairo_image_surface_create_for_data(image,
            CAIRO_FORMAT_ARGB32, width, height, stride);

    /* Obtain graphics context of new surface */
    cairo_t* cairo = cairo_create(surface);

    /* Copy old surface, if defined */
    if (buffer->surface != NULL) {
        cairo_set_operator(cairo, CAIRO_OPERATOR_SOURCE);
        cairo_set_source_surface(cairo, buffer->surface, 0, 0);
        cairo_set_operator(cairo, CAIRO_OPERATOR_OVER);
        cairo_paint(cairo);
    }

    /* Update properties */
    buffer->width = width;
    buffer->height = height;
    buffer->stride = stride;

    /* Replace old image */
    guacenc_buffer_free_image(buffer);
    buffer->image = image;
    buffer->surface = surface;
    buffer->cairo = cairo;

    return 0;

}

int guacenc_buffer_fit(guacenc_buffer* buffer, int x, int y) {

    /* Increase width to fit X (if necessary) */
    int new_width = buffer->width;
    if (new_width < x+1)
        new_width = x+1;

    /* Increase height to fit Y (if necessary) */
    int new_height = buffer->height;
    if (new_height < y+1)
        new_height = y+1;

    /* Resize buffer if size needs to change to fit X/Y coordinate */
    if (new_width != buffer->width || new_height != buffer->height)
        return guacenc_buffer_resize(buffer, new_width, new_height);

    /* No change necessary */
    return 0;

}

int guacenc_buffer_copy(guacenc_buffer* dst, guacenc_buffer* src) {

    /* Resize destination to exactly fit source */
    if (guacenc_buffer_resize(dst, src->width, src->height))
        return 1;

    /* Copy surface contents identically */
    if (src->surface != NULL) {

        /* Destination must be non-NULL as its size is that of the source */
        assert(dst->cairo != NULL);

        /* Reset state of destination */
        cairo_t* cairo = dst->cairo;
        cairo_reset_clip(cairo);

        /* Overwrite destination with contents of source */
        cairo_set_operator(cairo, CAIRO_OPERATOR_SOURCE);
        cairo_set_source_surface(cairo, src->surface, 0, 0);
        cairo_paint(cairo);

        /* Reset operator of destination to default */
        cairo_set_operator(cairo, CAIRO_OPERATOR_OVER);

    }

    return 0;

}

