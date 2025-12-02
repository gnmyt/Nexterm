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
#include "log.h"

#include <guacamole/client.h>

#include <stdlib.h>

int guacenc_display_create_image_stream(guacenc_display* display, int index,
        int mask, int layer_index, const char* mimetype, int x, int y) {

    /* Do not lookup / allocate if index is invalid */
    if (index < 0 || index >= GUACENC_DISPLAY_MAX_STREAMS) {
        guacenc_log(GUAC_LOG_WARNING, "Stream index out of bounds: %i", index);
        return 1;
    }

    /* Free existing stream (if any) */
    guacenc_image_stream_free(display->image_streams[index]);

    /* Associate new stream */
    guacenc_image_stream* stream = display->image_streams[index] =
        guacenc_image_stream_alloc(mask, layer_index, mimetype, x, y);

    /* Return zero only if stream is not NULL */
    return stream == NULL;

}

guacenc_image_stream* guacenc_display_get_image_stream(
        guacenc_display* display, int index) {

    /* Do not lookup / allocate if index is invalid */
    if (index < 0 || index >= GUACENC_DISPLAY_MAX_STREAMS) {
        guacenc_log(GUAC_LOG_WARNING, "Stream index out of bounds: %i", index);
        return NULL;
    }

    /* Return existing stream (if any) */
    return display->image_streams[index];

}

int guacenc_display_free_image_stream(guacenc_display* display, int index) {

    /* Do not lookup / allocate if index is invalid */
    if (index < 0 || index >= GUACENC_DISPLAY_MAX_STREAMS) {
        guacenc_log(GUAC_LOG_WARNING, "Stream index out of bounds: %i", index);
        return 1;
    }

    /* Free stream (if allocated) */
    guacenc_image_stream_free(display->image_streams[index]);

    /* Mark stream as freed */
    display->image_streams[index] = NULL;

    return 0;

}

