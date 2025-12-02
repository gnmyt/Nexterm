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
#include "buffer.h"
#include "layer.h"
#include "log.h"

#include <guacamole/client.h>

#include <stdlib.h>

guacenc_buffer* guacenc_display_get_buffer(guacenc_display* display,
        int index) {

    /* Transform index to buffer space */
    int internal_index = -index - 1;

    /* Do not lookup / allocate if index is invalid */
    if (internal_index < 0 || internal_index >= GUACENC_DISPLAY_MAX_BUFFERS) {
        guacenc_log(GUAC_LOG_WARNING, "Buffer index out of bounds: %i", index);
        return NULL;
    }

    /* Lookup buffer, allocating a new buffer if necessary */
    guacenc_buffer* buffer = display->buffers[internal_index];
    if (buffer == NULL) {

        /* Attempt to allocate buffer */
        buffer = guacenc_buffer_alloc();
        if (buffer == NULL) {
            guacenc_log(GUAC_LOG_WARNING, "Buffer allocation failed");
            return NULL;
        }

        /* All non-layer buffers must autosize */
        buffer->autosize = true;

        /* Store buffer within display for future retrieval / management */
        display->buffers[internal_index] = buffer;

    }

    return buffer;

}

int guacenc_display_free_buffer(guacenc_display* display,
        int index) {

    /* Transform index to buffer space */
    int internal_index = -index - 1;

    /* Do not lookup / free if index is invalid */
    if (internal_index < 0 || internal_index >= GUACENC_DISPLAY_MAX_BUFFERS) {
        guacenc_log(GUAC_LOG_WARNING, "Buffer index out of bounds: %i", index);
        return 1;
    }

    /* Free buffer (if allocated) */
    guacenc_buffer_free(display->buffers[internal_index]);

    /* Mark buffer as freed */
    display->buffers[internal_index] = NULL;

    return 0;

}

guacenc_buffer* guacenc_display_get_related_buffer(guacenc_display* display,
        int index) {

    /* Retrieve underlying buffer of layer if a layer is requested */
    if (index >= 0) {

        /* Retrieve / allocate layer (if possible */
        guacenc_layer* layer = guacenc_display_get_layer(display, index);
        if (layer == NULL)
            return NULL;

        /* Return underlying buffer */
        return layer->buffer;

    }

    /* Otherwise retrieve buffer directly */
    return guacenc_display_get_buffer(display, index);

}

