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
#include "webp.h"

#include <cairo/cairo.h>
#include <guacamole/client.h>
#include <webp/decode.h>

#include <stdint.h>
#include <stdlib.h>

cairo_surface_t* guacenc_webp_decoder(unsigned char* data, int length) {

    int width, height;

    /* Validate WebP and pull dimensions */
    if (!WebPGetInfo((uint8_t*) data, length, &width, &height)) {
        guacenc_log(GUAC_LOG_WARNING, "Invalid WebP data");
        return NULL;
    }

    /* Create blank Cairo surface */
    cairo_surface_t* surface = cairo_image_surface_create(CAIRO_FORMAT_ARGB32,
            width, height);

    /* Fill surface with opaque black */
    cairo_t* cairo = cairo_create(surface);
    cairo_set_operator(cairo, CAIRO_OPERATOR_SOURCE);
    cairo_set_source_rgba(cairo, 0.0, 0.0, 0.0, 1.0);
    cairo_paint(cairo);
    cairo_destroy(cairo);

    /* Finish any pending draws */
    cairo_surface_flush(surface);

    /* Pull underlying buffer and its stride */
    int stride = cairo_image_surface_get_stride(surface);
    unsigned char* image = cairo_image_surface_get_data(surface);

    /* Read WebP into surface */
    uint8_t* result = WebPDecodeBGRAInto((uint8_t*) data, length,
            (uint8_t*) image, stride * height, stride);

    /* Verify WebP was successfully decoded */
    if (result == NULL) {
        guacenc_log(GUAC_LOG_WARNING, "Invalid WebP data");
        cairo_surface_destroy(surface);
        return NULL;
    }

    /* WebP was read successfully */
    return surface;

}

