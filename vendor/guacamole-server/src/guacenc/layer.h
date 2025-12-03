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

#ifndef GUACENC_LAYER_H
#define GUACENC_LAYER_H

#include "config.h"
#include "buffer.h"

/**
 * The value assigned to the parent_index property of a guacenc_layer if it has
 * no parent.
 */
#define GUACENC_LAYER_NO_PARENT -1

/**
 * A visible Guacamole layer.
 */
typedef struct guacenc_layer {

    /**
     * The actual image contents of this layer, as well as this layer's size
     * (width and height).
     */
    guacenc_buffer* buffer;

    /**
     * The index of the layer that contains this layer. If this layer is the
     * default layer (and thus has no parent), this will be
     * GUACENC_LAYER_NO_PARENT.
     */
    int parent_index;

    /**
     * The X coordinate of the upper-left corner of this layer within the
     * Guacamole display.
     */
    int x;

    /**
     * The Y coordinate of the upper-left corner of this layer within the
     * Guacamole display.
     */
    int y;

    /**
     * The relative stacking order of this layer with respect to other sibling
     * layers.
     */
    int z;

    /**
     * The opacity of this layer, where 0 is completely transparent and 255 is
     * completely opaque.
     */
    int opacity;

    /**
     * The internal buffer used by to record the state of this layer in the
     * previous frame and to render additional frames.
     */
    guacenc_buffer* frame;

} guacenc_layer;

/**
 * Allocates and initializes a new layer object. This allocation is independent
 * of the Guacamole video encoder display; the allocated guacenc_layer will not
 * automatically be associated with the active display.
 *
 * @return
 *     A newly-allocated and initialized guacenc_layer, or NULL if allocation
 *     fails.
 */
guacenc_layer* guacenc_layer_alloc();

/**
 * Frees all memory associated with the given layer object. If the layer
 * provided is NULL, this function has no effect.
 *
 * @param layer
 *     The layer to free, which may be NULL.
 */
void guacenc_layer_free(guacenc_layer* layer);

#endif

