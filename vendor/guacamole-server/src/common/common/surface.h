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

#ifndef __GUAC_COMMON_SURFACE_H
#define __GUAC_COMMON_SURFACE_H

#include "config.h"
#include "rect.h"

#include <cairo/cairo.h>
#include <guacamole/client.h>
#include <guacamole/layer.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>

#include <pthread.h>

/**
 * The maximum number of updates to allow within the bitmap queue.
 */
#define GUAC_COMMON_SURFACE_QUEUE_SIZE 256

/**
 * Heat map cell size in pixels. Each side of each heat map cell will consist
 * of this many pixels.
 */
#define GUAC_COMMON_SURFACE_HEAT_CELL_SIZE 64

/**
 * The width or height of the heat map (in cells) given the width or height of
 * the image (in pixels).
 */
#define GUAC_COMMON_SURFACE_HEAT_DIMENSION(x) (       \
        (x + GUAC_COMMON_SURFACE_HEAT_CELL_SIZE - 1)  \
            / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE      \
)

/**
 * The number of entries to collect within each heat map cell. Collected
 * history entries are used to determine the framerate of the region associated
 * with that cell.
 */
#define GUAC_COMMON_SURFACE_HEAT_CELL_HISTORY_SIZE 5

/**
 * Representation of a cell in the refresh heat map. This cell is used to keep
 * track of how often an area on a surface is refreshed.
 */
typedef struct guac_common_surface_heat_cell {

    /**
     * Timestamps of each of the last N updates covering the location
     * associated with this heat map cell. This is used to calculate the
     * framerate. This array is structured as a ring buffer containing history
     * entries in chronologically-ascending order, starting at the entry
     * pointed to by oldest_entry and proceeding through all other entries,
     * wrapping around if the end of the array is reached.
     */
    guac_timestamp history[GUAC_COMMON_SURFACE_HEAT_CELL_HISTORY_SIZE];

    /**
     * Index of the oldest entry within the history.
     */
    int oldest_entry;

} guac_common_surface_heat_cell;

/**
 * Representation of a bitmap update, having a rectangle of image data (stored
 * elsewhere) and a flushed/not-flushed state.
 */
typedef struct guac_common_surface_bitmap_rect {

    /**
     * Whether this rectangle has been flushed.
     */
    int flushed;

    /**
     * The rectangle containing the bitmap update.
     */
    guac_common_rect rect;

} guac_common_surface_bitmap_rect;

/**
 * Surface which backs a Guacamole buffer or layer, automatically
 * combining updates when possible.
 */
typedef struct guac_common_surface {

    /**
     * The layer this surface will draw to.
     */
    const guac_layer* layer;

    /**
     * The client associated with this surface.
     */
    guac_client* client;

    /**
     * The socket to send instructions on when flushing.
     */
    guac_socket* socket;

    /**
     * The number of simultaneous touches that this surface can accept, where 0
     * indicates that the surface does not support touch events at all.
     */
    int touches;

    /**
     * Non-zero if all graphical updates for this surface should use lossless
     * compression, 0 otherwise. By default, newly-created surfaces will use
     * lossy compression when heuristics determine it is appropriate.
     */
    int lossless;

    /**
     * The X coordinate of the upper-left corner of this layer, in pixels,
     * relative to its parent layer. This is only applicable to visible
     * (non-buffer) layers which are not the default layer.
     */
    int x;

    /**
     * The Y coordinate of the upper-left corner of this layer, in pixels,
     * relative to its parent layer. This is only applicable to visible
     * (non-buffer) layers which are not the default layer.
     */
    int y;

    /**
     * The Z-order of this layer, relative to sibling layers. This is only
     * applicable to visible (non-buffer) layers which are not the default
     * layer.
     */
    int z;

    /**
     * The level of opacity applied to this layer. Fully opaque is 255, while
     * fully transparent is 0. This is only applicable to visible (non-buffer)
     * layers which are not the default layer.
     */
    int opacity;

    /**
     * The layer which contains this layer. This is only applicable to visible
     * (non-buffer) layers which are not the default layer.
     */
    const guac_layer* parent;

    /**
     * The width of this layer, in pixels.
     */
    int width;

    /**
     * The height of this layer, in pixels.
     */
    int height;

    /**
     * The size of each image row, in bytes.
     */
    int stride;

    /**
     * The underlying buffer of the Cairo surface.
     */
    unsigned char* buffer;

    /**
     * Non-zero if the location or parent layer of this surface has been
     * changed and needs to be flushed, 0 otherwise.
     */
    int location_dirty;

    /**
     * Non-zero if the opacity of this surface has been changed and needs to be
     * flushed, 0 otherwise.
     */
    int opacity_dirty;

    /**
     * Non-zero if this surface is dirty and needs to be flushed, 0 otherwise.
     */
    int dirty;

    /**
     * The dirty rectangle.
     */
    guac_common_rect dirty_rect;

    /**
     * Whether the surface actually exists on the client.
     */
    int realized;

    /**
     * Whether drawing operations are currently clipped by the clipping
     * rectangle.
     */
    int clipped;

    /**
     * The clipping rectangle.
     */
    guac_common_rect clip_rect;

    /**
     * The number of updates in the bitmap queue.
     */
    int bitmap_queue_length;

    /**
     * All queued bitmap updates.
     */
    guac_common_surface_bitmap_rect bitmap_queue[GUAC_COMMON_SURFACE_QUEUE_SIZE];

    /**
     * A heat map keeping track of the refresh frequency of
     * the areas of the screen.
     */
    guac_common_surface_heat_cell* heat_map;

    /**
     * Mutex which is locked internally when access to the surface must be
     * synchronized. All public functions of guac_common_surface should be
     * considered threadsafe.
     */
    pthread_mutex_t _lock;

} guac_common_surface;

/**
 * Allocates a new guac_common_surface, assigning it to the given layer.
 *
 * @param client
 *     The client associated with the given layer.
 *
 * @param socket
 *     The socket to send instructions on when flushing.
 *
 * @param layer
 *     The layer to associate with the new surface.
 *
 * @param w
 *     The width of the surface.
 *
 * @param h
 *     The height of the surface.
 *
 * @return
 *     A newly-allocated guac_common_surface.
 */
guac_common_surface* guac_common_surface_alloc(guac_client* client,
        guac_socket* socket, const guac_layer* layer, int w, int h);

/**
 * Frees the given guac_common_surface. Beware that this will NOT free any
 * associated layers, which must be freed manually.
 *
 * @param surface The surface to free.
 */
void guac_common_surface_free(guac_common_surface* surface);

 /**
 * Resizes the given surface to the given size.
 *
 * @param surface The surface to resize.
 * @param w The width of the surface.
 * @param h The height of the surface.
 */
void guac_common_surface_resize(guac_common_surface* surface, int w, int h);

/**
 * Draws the given data to the given guac_common_surface. If the source surface
 * is ARGB, the draw operation will be performed using the Porter-Duff "over"
 * composite operator. If the source surface is RGB (no alpha channel), no
 * compositing is performed and destination pixels are ignored.
 *
 * @param surface
 *     The surface to draw to.
 *
 * @param x
 *     The X coordinate of the draw location.
 *
 * @param y
 *     The Y coordinate of the draw location.
 *
 * @param src
 *     The Cairo surface to retrieve data from.
 */
void guac_common_surface_draw(guac_common_surface* surface, int x, int y,
        cairo_surface_t* src);

/**
 * Paints to the given guac_common_surface using the given data as a stencil,
 * filling opaque regions with the specified color, and leaving transparent
 * regions untouched.
 *
 * @param surface The surface to draw to.
 * @param x The X coordinate of the draw location.
 * @param y The Y coordinate of the draw location.
 * @param src The Cairo surface to retrieve data from.
 * @param red The red component of the fill color.
 * @param green The green component of the fill color.
 * @param blue The blue component of the fill color.
 */
void guac_common_surface_paint(guac_common_surface* surface, int x, int y, cairo_surface_t* src,
                              int red, int green, int blue);

/**
 * Copies a rectangle of data between two surfaces.
 *
 * @param src The source surface.
 * @param sx The X coordinate of the upper-left corner of the source rect.
 * @param sy The Y coordinate of the upper-left corner of the source rect.
 * @param w The width of the source rect.
 * @param h The height of the source rect.
 * @param dst The destination surface.
 * @param dx The X coordinate of the upper-left corner of the destination rect.
 * @param dy The Y coordinate of the upper-left corner of the destination rect.
 */
void guac_common_surface_copy(guac_common_surface* src, int sx, int sy, int w, int h,
                              guac_common_surface* dst, int dx, int dy);

/**
 * Transfers a rectangle of data between two surfaces.
 *
 * @param src The source surface.
 * @param sx The X coordinate of the upper-left corner of the source rect.
 * @param sy The Y coordinate of the upper-left corner of the source rect.
 * @param w The width of the source rect.
 * @param h The height of the source rect.
 * @param op The transfer function.
 * @param dst The destination surface.
 * @param dx The X coordinate of the upper-left corner of the destination rect.
 * @param dy The Y coordinate of the upper-left corner of the destination rect.
 */
void guac_common_surface_transfer(guac_common_surface* src, int sx, int sy, int w, int h,
                                  guac_transfer_function op, guac_common_surface* dst, int dx, int dy);

/**
 * Assigns the given value to all pixels within a rectangle of the given
 * surface. The color of all pixels within the rectangle, including the alpha
 * component, is entirely replaced.
 *
 * @param surface
 *     The surface to draw upon.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the rectangle.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the rectangle.
 *
 * @param w
 *     The width of the rectangle.
 *
 * @param h
 *     The height of the rectangle.
 *
 * @param red
 *     The red component of the color value to assign to all pixels within the
 *     rectangle.
 *
 * @param green
 *     The green component of the color value to assign to all pixels within
 *     the rectangle.
 *
 * @param blue 
 *     The blue component of the color value to assign to all pixels within the
 *     rectangle.
 *
 * @param alpha 
 *     The alpha component of the color value to assign to all pixels within
 *     the rectangle.
 */
void guac_common_surface_set(guac_common_surface* surface, int x, int y,
        int w, int h, int red, int green, int blue, int alpha);

/**
 * Given the coordinates and dimensions of a rectangle, clips all future
 * operations within that rectangle.
 *
 * @param surface The surface whose clipping rectangle should be changed.
 * @param x The X coordinate of the upper-left corner of the bounding rectangle.
 * @param y The Y coordinate of the upper-left corner of the bounding rectangle.
 * @param w The width of the bounding rectangle.
 * @param h The height of the bounding rectangle.
 */
void guac_common_surface_clip(guac_common_surface* surface, int x, int y, int w, int h);

/**
 * Resets the clipping rectangle, allowing drawing operations throughout the
 * entire surface.
 *
 * @param surface The surface whose clipping rectangle should be reset.
 */
void guac_common_surface_reset_clip(guac_common_surface* surface);

/**
 * Changes the location of the surface relative to its parent layer. If the
 * surface does not represent a non-default visible layer, then this function
 * has no effect.
 *
 * @param surface
 *     The surface to move relative to its parent layer.
 *
 * @param x
 *     The new X coordinate for the upper-left corner of the layer, in pixels.
 *
 * @param y
 *     The new Y coordinate for the upper-left corner of the layer, in pixels.
 */
void guac_common_surface_move(guac_common_surface* surface, int x, int y);

/**
 * Changes the stacking order of the surface relative to other surfaces within
 * the same parent layer. If the surface does not represent a non-default
 * visible layer, then this function has no effect.
 *
 * @param surface
 *     The surface to reorder relative to sibling layers.
 *
 * @param z
 *     The new Z-order for this layer, relative to sibling layers.
 */
void guac_common_surface_stack(guac_common_surface* surface, int z);

/**
 * Changes the parent layer of ths given surface. By default, layers will be
 * children of the default layer. If the surface does not represent a
 * non-default visible layer, then this function has no effect.
 *
 * @param surface
 *     The surface whose parent layer should be changed.
 *
 * @param parent
 *     The layer which should be set as the new parent of the given surface.
 */
void guac_common_surface_set_parent(guac_common_surface* surface,
        const guac_layer* parent);

/**
 * Sets the opacity of the surface. If the surface does not represent a
 * non-default visible layer, then this function has no effect.
 *
 * @param surface
 *     The surface whose opacity should be changed.
 *
 * @param opacity
 *     The level of opacity applied to this surface, where fully opaque is 255,
 *     and fully transparent is 0.
 */
void guac_common_surface_set_opacity(guac_common_surface* surface, int opacity);

/**
 * Flushes the given surface, including any applicable properties, drawing any
 * pending operations on the remote display.
 *
 * @param surface
 *     The surface to flush.
 */
void guac_common_surface_flush(guac_common_surface* surface);

/**
 * Duplicates the contents of the current surface to the given socket. Pending
 * changes are not flushed.
 *
 * @param surface
 *     The surface to duplicate.
 *
 * @param client
 *     The client whose users are receiving the surface.
 *
 * @param socket
 *     The socket over which the surface contents should be sent.
 */
void guac_common_surface_dup(guac_common_surface* surface,
        guac_client* client, guac_socket* socket);

/**
 * Declares that the given surface should receive touch events. By default,
 * surfaces are assumed to not expect touch events. This value is advisory, and
 * the client is not required to honor the declared level of touch support.
 * Implementations are expected to safely handle or ignore any received touch
 * events, regardless of the level of touch support declared.  regardless of
 * the level of touch support declared.
 *
 * @param surface
 *     The surface to modify.
 *
 * @param touches
 *     The number of simultaneous touches that this surface can accept, where 0
 *     indicates that the surface does not support touch events at all.
 */
void guac_common_surface_set_multitouch(guac_common_surface* surface,
        int touches);

/**
 * Sets the lossless compression policy of the given surface to the given
 * value. By default, newly-created surfaces will use lossy compression for
 * graphical updates when heuristics determine that doing so is appropriate.
 * Specifying a non-zero value here will force all graphical updates to always
 * use lossless compression, whereas specifying zero will restore the default
 * policy.
 *
 * @param surface
 *     The surface to modify.
 *
 * @param lossless
 *     Non-zero if all graphical updates for this surface should use lossless
 *     compression, 0 otherwise.
 */
void guac_common_surface_set_lossless(guac_common_surface* surface,
        int lossless);

#endif

