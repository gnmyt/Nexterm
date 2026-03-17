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

#ifndef GUACENC_CURSOR_H
#define GUACENC_CURSOR_H

#include "config.h"
#include "buffer.h"

#include <guacamole/protocol.h>
#include <guacamole/timestamp.h>

/**
 * A mouse cursor, having a current location, hotspot, and associated cursor
 * image.
 */
typedef struct guacenc_cursor {

    /**
     * The current X coordinate of the mouse cursor, in pixels. Valid values
     * are non-negative. Negative values indicate that the cursor should not
     * be rendered.
     */
    int x;

    /**
     * The current Y coordinate of the mouse cursor, in pixels. Valid values
     * are non-negative. Negative values indicate that the cursor should not
     * be rendered.
     */
    int y;

    /**
     * The X coordinate of the mouse cursor hotspot within the cursor image,
     * in pixels.
     */
    int hotspot_x;

    /**
     * The Y coordinate of the mouse cursor hotspot within the cursor image,
     * in pixels.
     */
    int hotspot_y;

    /**
     * The current mouse cursor image.
     */
    guacenc_buffer* buffer;

} guacenc_cursor;

/**
 * Allocates and initializes a new cursor object.
 *
 * @return
 *     A newly-allocated and initialized guacenc_cursor, or NULL if allocation
 *     fails.
 */
guacenc_cursor* guacenc_cursor_alloc();

/**
 * Frees all memory associated with the given cursor object. If the cursor
 * provided is NULL, this function has no effect.
 *
 * @param cursor
 *     The cursor to free, which may be NULL.
 */
void guacenc_cursor_free(guacenc_cursor* cursor);

#endif

