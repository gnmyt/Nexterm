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

#ifndef GUAC_DISPLAY_TYPES_H
#define GUAC_DISPLAY_TYPES_H

/**
 * @addtogroup display
 * @{
 */

/**
 * Provides type definitions related to the abstract display implementation
 * (guac_display).
 *
 * @file display-types.h
 */

/**
 * Opaque representation of the remote (client-side) display of a Guacamole
 * connection (guac_client).
 */
typedef struct guac_display guac_display;

/**
 * Opaque representation of a thread that continuously renders updated
 * graphical data to the remote display.
 */
typedef struct guac_display_render_thread guac_display_render_thread;

/**
 * Opaque representation of a layer within a guac_display. This may be a
 * visible layer or an off-screen buffer, and is effectively the guac_display
 * equivalent of a guac_layer.
 */
typedef struct guac_display_layer guac_display_layer;

/**
 * The current Cairo drawing context of a guac_display_layer, including a Cairo
 * image surface wrapping the underlying drawing buffer of the
 * guac_display_layer. After making graphical changes, the dirty rectangle of
 * this context must be updated such that it includes the regions modified by
 * those changes.
 */
typedef struct guac_display_layer_cairo_context guac_display_layer_cairo_context;

/**
 * The current raw drawing context of a guac_display_layer, including the
 * underlying drawing buffer of the guac_display_layer and memory layout
 * information. After making graphical changes, the dirty rectangle of this
 * context must be updated such that it includes the regions modified by those
 * changes.
 */
typedef struct guac_display_layer_raw_context guac_display_layer_raw_context;

/**
 * Pre-defined mouse cursor graphics.
 */
typedef enum guac_display_cursor_type {

    /**
     * An empty (invisible/hidden) mouse cursor.
     */
    GUAC_DISPLAY_CURSOR_NONE,

    /**
     * A small dot. This is typically used in situations where cursor
     * information for the remote desktop is not available, thus all cursor
     * rendering must happen remotely, but it's still important that the user
     * be able to see the current location of their local mouse pointer.
     */
    GUAC_DISPLAY_CURSOR_DOT,

    /**
     * A vertical, I-shaped bar indicating text input or selection.
     */
    GUAC_DISPLAY_CURSOR_IBAR,

    /**
     * A standard, general-purpose pointer.
     */
    GUAC_DISPLAY_CURSOR_POINTER

} guac_display_cursor_type;

/**
 * @}
 */

#endif
