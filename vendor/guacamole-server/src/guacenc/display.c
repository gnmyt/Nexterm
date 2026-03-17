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
#include "cursor.h"
#include "display.h"
#include "video.h"

#include <cairo/cairo.h>
#include <guacamole/mem.h>

#include <stdlib.h>

cairo_operator_t guacenc_display_cairo_operator(guac_composite_mode mask) {

    /* Translate Guacamole channel mask into Cairo operator */
    switch (mask) {

        /* Source */
        case GUAC_COMP_SRC:
            return CAIRO_OPERATOR_SOURCE;

        /* Over */
        case GUAC_COMP_OVER:
            return CAIRO_OPERATOR_OVER;

        /* In */
        case GUAC_COMP_IN:
            return CAIRO_OPERATOR_IN;

        /* Out */
        case GUAC_COMP_OUT:
            return CAIRO_OPERATOR_OUT;

        /* Atop */
        case GUAC_COMP_ATOP:
            return CAIRO_OPERATOR_ATOP;

        /* Over (source/destination reversed) */
        case GUAC_COMP_ROVER:
            return CAIRO_OPERATOR_DEST_OVER;

        /* In (source/destination reversed) */
        case GUAC_COMP_RIN:
            return CAIRO_OPERATOR_DEST_IN;

        /* Out (source/destination reversed) */
        case GUAC_COMP_ROUT:
            return CAIRO_OPERATOR_DEST_OUT;

        /* Atop (source/destination reversed) */
        case GUAC_COMP_RATOP:
            return CAIRO_OPERATOR_DEST_ATOP;

        /* XOR */
        case GUAC_COMP_XOR:
            return CAIRO_OPERATOR_XOR;

        /* Additive */
        case GUAC_COMP_PLUS:
            return CAIRO_OPERATOR_ADD;

        /* If unrecognized, just default to CAIRO_OPERATOR_OVER */
        default:
            return CAIRO_OPERATOR_OVER;

    }

}

guacenc_display* guacenc_display_alloc(const char* path, const char* codec,
        int width, int height, int bitrate) {

    /* Prepare video encoding */
    guacenc_video* video = guacenc_video_alloc(path, codec, width, height, bitrate);
    if (video == NULL)
        return NULL;

    /* Allocate display */
    guacenc_display* display =
        (guacenc_display*) guac_mem_zalloc(sizeof(guacenc_display));

    /* Associate display with video output */
    display->output = video;

    /* Allocate special-purpose cursor layer */
    display->cursor = guacenc_cursor_alloc();

    return display;

}

int guacenc_display_free(guacenc_display* display) {

    int i;

    /* Ignore NULL display */
    if (display == NULL)
        return 0;

    /* Finalize video */
    int retval = guacenc_video_free(display->output);

    /* Free all buffers */
    for (i = 0; i < GUACENC_DISPLAY_MAX_BUFFERS; i++)
        guacenc_buffer_free(display->buffers[i]);

    /* Free all layers */
    for (i = 0; i < GUACENC_DISPLAY_MAX_LAYERS; i++)
        guacenc_layer_free(display->layers[i]);

    /* Free all streams */
    for (i = 0; i < GUACENC_DISPLAY_MAX_STREAMS; i++)
        guacenc_image_stream_free(display->image_streams[i]);

    /* Free cursor */
    guacenc_cursor_free(display->cursor);

    guac_mem_free(display);
    return retval;

}

