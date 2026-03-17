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
#include "layer.h"
#include "log.h"

#include <guacamole/client.h>

#include <stdlib.h>

guacenc_layer* guacenc_display_get_layer(guacenc_display* display,
        int index) {

    /* Do not lookup / allocate if index is invalid */
    if (index < 0 || index >= GUACENC_DISPLAY_MAX_LAYERS) {
        guacenc_log(GUAC_LOG_WARNING, "Layer index out of bounds: %i", index);
        return NULL;
    }

    /* Lookup layer, allocating a new layer if necessary */
    guacenc_layer* layer = display->layers[index];
    if (layer == NULL) {

        /* Attempt to allocate layer */
        layer = guacenc_layer_alloc();
        if (layer == NULL) {
            guacenc_log(GUAC_LOG_WARNING, "Layer allocation failed");
            return NULL;
        }

        /* The default layer has no parent */
        if (index == 0)
            layer->parent_index = GUACENC_LAYER_NO_PARENT;

        /* Store layer within display for future retrieval / management */
        display->layers[index] = layer;

    }

    return layer;

}

int guacenc_display_get_depth(guacenc_display* display, guacenc_layer* layer) {

    /* Non-existent layers have a depth of 0 */
    if (layer == NULL)
        return 0;

    /* Layers with no parent have a depth of 0 */
    if (layer->parent_index == GUACENC_LAYER_NO_PARENT)
        return 0;

    /* Retrieve parent layer */
    guacenc_layer* parent =
        guacenc_display_get_layer(display, layer->parent_index);

    /* Current layer depth is the depth of the parent + 1 */
    return guacenc_display_get_depth(display, parent) + 1;

}

int guacenc_display_free_layer(guacenc_display* display,
        int index) {

    /* Do not lookup / free if index is invalid */
    if (index < 0 || index >= GUACENC_DISPLAY_MAX_LAYERS) {
        guacenc_log(GUAC_LOG_WARNING, "Layer index out of bounds: %i", index);
        return 1;
    }

    /* Free layer (if allocated) */
    guacenc_layer_free(display->layers[index]);

    /* Mark layer as freed */
    display->layers[index] = NULL;

    return 0;

}

