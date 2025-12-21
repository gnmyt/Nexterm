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
#include "layer.h"

#include <guacamole/mem.h>

#include <stdlib.h>

guacenc_layer* guacenc_layer_alloc() {

    /* Allocate new layer */
    guacenc_layer* layer = (guacenc_layer*) guac_mem_zalloc(sizeof(guacenc_layer));
    if (layer == NULL)
        return NULL;

    /* Allocate associated buffer (width, height, and image storage) */
    layer->buffer = guacenc_buffer_alloc();
    if (layer->buffer == NULL) {
        guac_mem_free(layer);
        return NULL;
    }

    /* Allocate buffer for frame rendering */
    layer->frame = guacenc_buffer_alloc();
    if (layer->frame== NULL) {
        guacenc_buffer_free(layer->buffer);
        guac_mem_free(layer);
        return NULL;
    }

    /* Layers default to fully opaque */
    layer->opacity = 0xFF;

    /* Default parented to default layer */
    layer->parent_index = 0;

    return layer;

}

void guacenc_layer_free(guacenc_layer* layer) {

    /* Ignore NULL layers */
    if (layer == NULL)
        return;

    /* Free internal frame buffer */
    guacenc_buffer_free(layer->frame);

    /* Free underlying buffer */
    guacenc_buffer_free(layer->buffer);

    guac_mem_free(layer);

}

