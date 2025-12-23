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

#ifndef GUAC_DISPLAY_BUILTIN_CURSORS_H
#define GUAC_DISPLAY_BUILTIN_CURSORS_H

#include <unistd.h>

/**
 * Mouse cursor image that is built into libguac. Each actual instance of this
 * structure will correspond to a value within the guac_display_cursor_type
 * enum.
 */
typedef struct guac_display_builtin_cursor {

    /**
     * The raw, 32-bit ARGB image for this mouse cursor.
     */
    const unsigned char* const buffer;

    /**
     * The width of this mouse cursor image, in pixels.
     */
    const unsigned int width;

    /**
     * The height of this mouse cursor image, in pixels.
     */
    const unsigned int height;

    /**
     * The size of each row of image data, in bytes.
     */
    const size_t stride;

    /**
     * The X coordinate of the relative position of the pointer hotspot within
     * the cursor image. The hotspot is the location that the mouse pointer is
     * actually reported, with the cursor image visibly positioned relative to
     * that location.
     */
    int hotspot_x;

    /**
     * The Y coordinate of the relative position of the pointer hotspot within
     * the cursor image. The hotspot is the location that the mouse pointer is
     * actually reported, with the cursor image visibly positioned relative to
     * that location.
     */
    int hotspot_y;

} guac_display_builtin_cursor;

/**
 * An empty (invisible/hidden) mouse cursor.
 */
extern const guac_display_builtin_cursor guac_display_cursor_none;

/**
 * A small dot. This is typically used in situations where cursor information
 * for the remote desktop is not available, thus all cursor rendering must
 * happen remotely, but it's still important that the user be able to see the
 * current location of their local mouse pointer.
 */
extern const guac_display_builtin_cursor guac_display_cursor_dot;

/**
 * A vertical, I-shaped bar indicating text input or selection.
 */
extern const guac_display_builtin_cursor guac_display_cursor_ibar;

/**
 * A standard, general-purpose pointer.
 */
extern const guac_display_builtin_cursor guac_display_cursor_pointer;

#endif
