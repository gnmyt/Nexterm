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
#include "common/rect.h"
#include "common/surface.h"

#include <cairo/cairo.h>
#include <guacamole/client.h>
#include <guacamole/layer.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/timestamp.h>
#include <guacamole/user.h>

#include <pthread.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>

/**
 * The width of an update which should be considered negible and thus
 * trivial overhead compared ot the cost of two updates.
 */
#define GUAC_SURFACE_NEGLIGIBLE_WIDTH 64

/**
 * The height of an update which should be considered negible and thus
 * trivial overhead compared ot the cost of two updates.
 */
#define GUAC_SURFACE_NEGLIGIBLE_HEIGHT 64

/**
 * The proportional increase in cost contributed by transfer and processing of
 * image data, compared to processing an equivalent amount of client-side
 * data.
 */
#define GUAC_SURFACE_DATA_FACTOR 16

/**
 * The base cost of every update. Each update should be considered to have
 * this starting cost, plus any additional cost estimated from its
 * content.
 */
#define GUAC_SURFACE_BASE_COST 4096

/**
 * An increase in cost is negligible if it is less than
 * 1/GUAC_SURFACE_NEGLIGIBLE_INCREASE of the old cost.
 */
#define GUAC_SURFACE_NEGLIGIBLE_INCREASE 4

/**
 * If combining an update because it appears to be follow a fill pattern,
 * the combined cost must not exceed
 * GUAC_SURFACE_FILL_PATTERN_FACTOR * (total uncombined cost).
 */
#define GUAC_SURFACE_FILL_PATTERN_FACTOR 3

/* Define cairo_format_stride_for_width() if missing */
#ifndef HAVE_CAIRO_FORMAT_STRIDE_FOR_WIDTH
#define cairo_format_stride_for_width(format, width) (width*4)
#endif

/**
 * The framerate which, if exceeded, indicates that JPEG is preferred.
 */
#define GUAC_COMMON_SURFACE_JPEG_FRAMERATE 3

/**
 * Minimum JPEG bitmap size (area). If the bitmap is smaller than this threshold,
 * it should be compressed as a PNG image to avoid the JPEG compression tax.
 */
#define GUAC_SURFACE_JPEG_MIN_BITMAP_SIZE 4096

/**
 * The JPEG compression min block size. This defines the optimal rectangle block
 * size factor for JPEG compression. Usually 8x8 would suffice, but use 16 to
 * reduce the occurrence of ringing artifacts further.
 */
#define GUAC_SURFACE_JPEG_BLOCK_SIZE 16

/**
 * The WebP compression min block size. This defines the optimal rectangle block
 * size factor for WebP compression. WebP does utilize variable block size, but
 * ensuring a block size factor reduces any noise on the image edges.
 */
#define GUAC_SURFACE_WEBP_BLOCK_SIZE 8

void guac_common_surface_set_multitouch(guac_common_surface* surface,
        int touches) {

    pthread_mutex_lock(&surface->_lock);

    surface->touches = touches;
    guac_protocol_send_set_int(surface->socket, surface->layer,
            GUAC_PROTOCOL_LAYER_PARAMETER_MULTI_TOUCH, touches);

    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_set_lossless(guac_common_surface* surface,
        int lossless) {

    pthread_mutex_lock(&surface->_lock);
    surface->lossless = lossless;
    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_move(guac_common_surface* surface, int x, int y) {

    pthread_mutex_lock(&surface->_lock);

    surface->x = x;
    surface->y = y;
    surface->location_dirty = 1;

    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_stack(guac_common_surface* surface, int z) {

    pthread_mutex_lock(&surface->_lock);

    surface->z = z;
    surface->location_dirty = 1;

    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_set_parent(guac_common_surface* surface,
        const guac_layer* parent) {

    pthread_mutex_lock(&surface->_lock);

    surface->parent = parent;
    surface->location_dirty = 1;

    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_set_opacity(guac_common_surface* surface,
        int opacity) {

    pthread_mutex_lock(&surface->_lock);

    surface->opacity = opacity;
    surface->opacity_dirty = 1;

    pthread_mutex_unlock(&surface->_lock);

}

/**
 * Updates the coordinates of the given rectangle to be within the bounds of
 * the given surface.
 *
 * @param surface The surface to use for clipping.
 * @param rect The rectangle to clip.
 * @param sx The X coordinate of the source rectangle, if any.
 * @param sy The Y coordinate of the source rectangle, if any.
 */
static void __guac_common_bound_rect(guac_common_surface* surface,
        guac_common_rect* rect, int* sx, int* sy) {

    guac_common_rect bounds_rect = {
        .x = 0,
        .y = 0,
        .width  = surface->width,
        .height = surface->height
    };

    int orig_x = rect->x;
    int orig_y = rect->y;

    guac_common_rect_constrain(rect, &bounds_rect);

    /* Update source X/Y if given */
    if (sx != NULL) *sx += rect->x - orig_x;
    if (sy != NULL) *sy += rect->y - orig_y;

}

/**
 * Updates the coordinates of the given rectangle to be within the clipping
 * rectangle of the given surface, which must always be within the bounding
 * rectangle of the given surface.
 *
 * @param surface The surface to use for clipping.
 * @param rect The rectangle to clip.
 * @param sx The X coordinate of the source rectangle, if any.
 * @param sy The Y coordinate of the source rectangle, if any.
 */
static void __guac_common_clip_rect(guac_common_surface* surface,
        guac_common_rect* rect, int* sx, int* sy) {

    int orig_x = rect->x;
    int orig_y = rect->y;

    /* Just bound within surface if no clipping rectangle applied */
    if (!surface->clipped) {
        __guac_common_bound_rect(surface, rect, sx, sy);
        return;
    }

    guac_common_rect_constrain(rect, &surface->clip_rect);

    /* Update source X/Y if given */
    if (sx != NULL) *sx += rect->x - orig_x;
    if (sy != NULL) *sy += rect->y - orig_y;

}

/**
 * Returns whether a rectangle within the given surface contains only fully
 * opaque pixels.
 *
 * @param surface
 *     The surface to check.
 *
 * @param rect
 *     The rectangle to check.
 *
 * @return
 *     Non-zero if the rectangle contains only fully opaque pixels, zero
 *     otherwise.
 */
static int __guac_common_surface_is_opaque(guac_common_surface* surface,
        guac_common_rect* rect) {

    int x, y;

    int stride = surface ->stride;
    unsigned char* buffer =
        surface->buffer + (stride * rect->y) + (4 * rect->x);

    /* For each row */
    for (y = 0; y < rect->height; y++) {

        /* Search for a non-opaque pixel */
        uint32_t* current = (uint32_t*) buffer;
        for (x=0; x < rect->width; x++) {

            /* Rectangle is non-opaque if a single non-opaque pixel is found */
            uint32_t color = *(current++);
            if ((color & 0xFF000000) != 0xFF000000)
                return 0;

        }

        /* Next row */
        buffer += stride;

    }

    /* Rectangle is opaque */
    return 1;

}

/**
 * Returns whether the given rectangle should be combined into the existing
 * dirty rectangle, to be eventually flushed as image data, or would be best
 * kept independent of the current rectangle.
 *
 * @param surface
 *     The surface being updated.
 *
 * @param rect
 *     The bounding rectangle of the update being made to the surface.
 *
 * @param rect_only
 *     Non-zero if this update, by its nature, contains only metainformation
 *     about the update's bounding rectangle, zero if the update also contains
 *     image data.
 *
 * @return
 *     Non-zero if the update should be combined with any existing update, zero
 *     otherwise.
 */
static int __guac_common_should_combine(guac_common_surface* surface, const guac_common_rect* rect, int rect_only) {

    /* Always favor combining updates if surface is currently a purely
     * server-side scratch area */
    if (!surface->realized)
        return 1;

    if (surface->dirty) {

        int combined_cost, dirty_cost, update_cost;

        /* Simulate combination */
        guac_common_rect combined = surface->dirty_rect;
        guac_common_rect_extend(&combined, rect);

        /* Combine if result is still small */
        if (combined.width <= GUAC_SURFACE_NEGLIGIBLE_WIDTH && combined.height <= GUAC_SURFACE_NEGLIGIBLE_HEIGHT)
            return 1;

        /* Estimate costs of the existing update, new update, and both combined */
        combined_cost = GUAC_SURFACE_BASE_COST + combined.width * combined.height;
        dirty_cost    = GUAC_SURFACE_BASE_COST + surface->dirty_rect.width * surface->dirty_rect.height;
        update_cost   = GUAC_SURFACE_BASE_COST + rect->width * rect->height;

        /* Reduce cost if no image data */
        if (rect_only)
            update_cost /= GUAC_SURFACE_DATA_FACTOR;

        /* Combine if cost estimate shows benefit */
        if (combined_cost <= update_cost + dirty_cost)
            return 1;

        /* Combine if increase in cost is negligible */
        if (combined_cost - dirty_cost <= dirty_cost / GUAC_SURFACE_NEGLIGIBLE_INCREASE)
            return 1;

        if (combined_cost - update_cost <= update_cost / GUAC_SURFACE_NEGLIGIBLE_INCREASE)
            return 1;

        /* Combine if we anticipate further updates, as this update follows a common fill pattern */
        if (rect->x == surface->dirty_rect.x && rect->y == surface->dirty_rect.y + surface->dirty_rect.height) {
            if (combined_cost <= (dirty_cost + update_cost) * GUAC_SURFACE_FILL_PATTERN_FACTOR)
                return 1;
        }

    }
    
    /* Otherwise, do not combine */
    return 0;

}

/**
 * Expands the dirty rect of the given surface to contain the rect described by the given
 * coordinates.
 *
 * @param surface The surface to mark as dirty.
 * @param rect The rectangle of the update which is dirtying the surface.
 */
static void __guac_common_mark_dirty(guac_common_surface* surface, const guac_common_rect* rect) {

    /* Ignore empty rects */
    if (rect->width <= 0 || rect->height <= 0)
        return;

    /* If already dirty, update existing rect */
    if (surface->dirty)
        guac_common_rect_extend(&surface->dirty_rect, rect);

    /* Otherwise init dirty rect */
    else {
        surface->dirty_rect = *rect;
        surface->dirty = 1;
    }

}

/**
 * Calculate the current average framerate for a given area on the surface.
 *
 * @param surface
 *     The surface on which the framerate will be calculated.
 *
 * @param rect
 *     The rect containing the area for which the average framerate will be
 *     calculated.
 *
 * @return
 *     The average framerate of the given area, in frames per second.
 */
static unsigned int __guac_common_surface_calculate_framerate(
        guac_common_surface* surface, const guac_common_rect* rect) {

    int x, y;

    /* Calculate heat map dimensions */
    size_t heat_width = GUAC_COMMON_SURFACE_HEAT_DIMENSION(surface->width);

    /* Calculate minimum X/Y coordinates intersecting given rect */
    int min_x = rect->x / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE;
    int min_y = rect->y / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE;

    /* Calculate maximum X/Y coordinates intersecting given rect */
    int max_x = min_x + (rect->width  - 1) / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE;
    int max_y = min_y + (rect->height - 1) / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE;

    unsigned int sum_framerate = 0;
    unsigned int count = 0;

    /* Get start of buffer at given coordinates */
    const guac_common_surface_heat_cell* heat_row =
        surface->heat_map + min_y * heat_width + min_x;

    /* Iterate over all the heat map cells for the area
     * and calculate the average framerate */
    for (y = min_y; y < max_y; y++) {

        /* Get current row of heat map */
        const guac_common_surface_heat_cell* heat_cell = heat_row;

        /* For each cell in subset of row */
        for (x = min_x; x < max_x; x++) {

            /* Calculate indicies for latest and oldest history entries */
            int oldest_entry = heat_cell->oldest_entry;
            int latest_entry = oldest_entry - 1;
            if (latest_entry < 0)
                latest_entry = GUAC_COMMON_SURFACE_HEAT_CELL_HISTORY_SIZE - 1;

            /* Calculate elapsed time covering entire history for this cell */
            int elapsed_time = heat_cell->history[latest_entry]
                             - heat_cell->history[oldest_entry];

            /* Calculate and add framerate */
            if (elapsed_time)
                sum_framerate += GUAC_COMMON_SURFACE_HEAT_CELL_HISTORY_SIZE
                    * 1000 / elapsed_time;

            /* Next heat map cell */
            heat_cell++;
            count++;

        }

        /* Next heat map row */
        heat_row += heat_width;

    }

    /* Calculate the average framerate over entire rect */
    if (count)
        return sum_framerate / count;

    return 0;

}

 /**
 * Guesses whether a rectangle within a particular surface would be better
 * compressed as PNG or using a lossy format like JPEG. Positive values
 * indicate PNG is likely to be superior, while negative values indicate the
 * opposite.
 *
 * @param surface
 *     The surface containing the image data to check.
 *
 * @param rect
 *     The rect to check within the given surface.
 *
 * @return
 *     Positive values if PNG compression is likely to perform better than
 *     lossy alternatives, or negative values if PNG is likely to perform
 *     worse.
 */
static int __guac_common_surface_png_optimality(guac_common_surface* surface,
        const guac_common_rect* rect) {

    int x, y;

    int num_same = 0;
    int num_different = 1;

    /* Get image/buffer metrics */
    int width = rect->width;
    int height = rect->height;
    int stride = surface->stride;

    /* Get buffer from surface */
    unsigned char* buffer = surface->buffer + rect->y * stride + rect->x * 4;

    /* Image must be at least 1x1 */
    if (width < 1 || height < 1)
        return 0;

    /* For each row */
    for (y = 0; y < height; y++) {

        uint32_t* row = (uint32_t*) buffer;
        uint32_t last_pixel = *(row++) | 0xFF000000;

        /* For each pixel in current row */
        for (x = 1; x < width; x++) {

            /* Get next pixel */
            uint32_t current_pixel = *(row++) | 0xFF000000;

            /* Update same/different counts according to pixel value */
            if (current_pixel == last_pixel)
                num_same++;
            else
                num_different++;

            last_pixel = current_pixel;

        }

        /* Advance to next row */
        buffer += stride;

    }

    /* Return rough approximation of optimality for PNG compression */
    return 0x100 * num_same / num_different - 0x400;

}

/**
 * Returns whether the given rectangle would be optimally encoded as JPEG
 * rather than PNG.
 *
 * @param surface
 *     The surface to be queried.
 *
 * @param rect
 *     The rectangle to check.
 *
 * @return
 *     Non-zero if the rectangle would be optimally encoded as JPEG, zero
 *     otherwise.
 */
static int __guac_common_surface_should_use_jpeg(guac_common_surface* surface,
        const guac_common_rect* rect) {

    /* Do not use JPEG if lossless quality is required */
    if (surface->lossless)
        return 0;

    /* Calculate the average framerate for the given rect */
    int framerate = __guac_common_surface_calculate_framerate(surface, rect);

    int rect_size = rect->width * rect->height;

    /* JPEG is preferred if:
     * - frame rate is high enough
     * - image size is large enough
     * - PNG is not more optimal based on image contents */
    return framerate >= GUAC_COMMON_SURFACE_JPEG_FRAMERATE
        && rect_size > GUAC_SURFACE_JPEG_MIN_BITMAP_SIZE
        && __guac_common_surface_png_optimality(surface, rect) < 0;

}

/**
 * Returns whether the given rectangle would be optimally encoded as WebP
 * rather than PNG.
 *
 * @param surface
 *     The surface to be queried.
 *
 * @param rect
 *     The rectangle to check.
 *
 * @return
 *     Non-zero if the rectangle would be optimally encoded as WebP, zero
 *     otherwise.
 */
static int __guac_common_surface_should_use_webp(guac_common_surface* surface,
        const guac_common_rect* rect) {

    /* Do not use WebP if not supported */
    if (!guac_client_supports_webp(surface->client))
        return 0;

    /* Calculate the average framerate for the given rect */
    int framerate = __guac_common_surface_calculate_framerate(surface, rect);

    /* WebP is preferred if:
     * - frame rate is high enough
     * - PNG is not more optimal based on image contents */
    return framerate >= GUAC_COMMON_SURFACE_JPEG_FRAMERATE
        && __guac_common_surface_png_optimality(surface, rect) < 0;

}

/**
 * Updates the heat map cells which intersect the given rectangle using the
 * given timestamp. This timestamp, along with timestamps from past updates,
 * is used to calculate the framerate of each heat cell.
 *
 * @param surface
 *     The surface containing the heat map cells to be updated.
 *
 * @param rect
 *     The rectangle containing the heat map cells to be updated.
 *
 * @param time
 *     The timestamp to use when updating the heat map cells which intersect
 *     the given rectangle.
 */
static void __guac_common_surface_touch_rect(guac_common_surface* surface,
        guac_common_rect* rect, guac_timestamp time) {

    int x, y;

    /* Calculate heat map dimensions */
    size_t heat_width = GUAC_COMMON_SURFACE_HEAT_DIMENSION(surface->width);

    /* Calculate minimum X/Y coordinates intersecting given rect */
    int min_x = rect->x / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE;
    int min_y = rect->y / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE;

    /* Calculate maximum X/Y coordinates intersecting given rect */
    int max_x = min_x + (rect->width  - 1) / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE;
    int max_y = min_y + (rect->height - 1) / GUAC_COMMON_SURFACE_HEAT_CELL_SIZE;

    /* Get start of buffer at given coordinates */
    guac_common_surface_heat_cell* heat_row =
        surface->heat_map + min_y * heat_width + min_x;

    /* Update all heat map cells which intersect with rectangle */
    for (y = min_y; y <= max_y; y++) {

        /* Get current row of heat map */
        guac_common_surface_heat_cell* heat_cell = heat_row;

        /* For each cell in subset of row */
        for (x = min_x; x <= max_x; x++) {

            /* Replace oldest entry with new timestamp */
            heat_cell->history[heat_cell->oldest_entry] = time;

            /* Update to next oldest entry */
            heat_cell->oldest_entry++;
            if (heat_cell->oldest_entry >=
                    GUAC_COMMON_SURFACE_HEAT_CELL_HISTORY_SIZE)
                heat_cell->oldest_entry = 0;

            /* Advance to next heat map cell */
            heat_cell++;

        }

        /* Next heat map row */
        heat_row += heat_width;

    }

}

/**
 * Flushes the bitmap update currently described by the dirty rectangle within the
 * given surface to that surface's bitmap queue. There MUST be space within the
 * queue.
 *
 * @param surface The surface to flush.
 */
static void __guac_common_surface_flush_to_queue(guac_common_surface* surface) {

    guac_common_surface_bitmap_rect* rect;

    /* Do not flush if not dirty */
    if (!surface->dirty)
        return;

    /* Add new rect to queue */
    rect = &(surface->bitmap_queue[surface->bitmap_queue_length++]);
    rect->rect = surface->dirty_rect;
    rect->flushed = 0;

    /* Surface now flushed */
    surface->dirty = 0;

}

/**
 * Flushes the given surface, drawing any pending operations on the remote
 * display. Surface properties are not flushed.
 *
 * @param surface
 *     The surface to flush.
 */
static void __guac_common_surface_flush(guac_common_surface* surface);

/**
 * Schedules a deferred flush of the given surface. This will not immediately
 * flush the surface to the client. Instead, the result of the flush is
 * added to a queue which is reinspected and combined (if possible) with other
 * deferred flushes during the call to guac_common_surface_flush().
 *
 * @param surface The surface to flush.
 */
static void __guac_common_surface_flush_deferred(guac_common_surface* surface) {

    /* Do not flush if not dirty */
    if (!surface->dirty)
        return;

    /* Flush if queue size has reached maximum (space is reserved for the final
     * dirty rect, as __guac_common_surface_flush() MAY add an additional rect
     * to the queue */
    if (surface->bitmap_queue_length == GUAC_COMMON_SURFACE_QUEUE_SIZE-1)
        __guac_common_surface_flush(surface);

    /* Append dirty rect to queue */
    __guac_common_surface_flush_to_queue(surface);

}

/**
 * Transfers a single uint32_t using the given transfer function.
 *
 * @param op The transfer function to use.
 * @param src The source of the uint32_t value.
 * @param dst THe destination which will hold the result of the transfer.
 * @return Non-zero if the destination value was changed, zero otherwise.
 */
static int __guac_common_surface_transfer_int(guac_transfer_function op, uint32_t* src, uint32_t* dst) {

    uint32_t orig = *dst;

    switch (op) {

        case GUAC_TRANSFER_BINARY_BLACK:
            *dst = 0xFF000000;
            break;

        case GUAC_TRANSFER_BINARY_WHITE:
            *dst = 0xFFFFFFFF;
            break;

        case GUAC_TRANSFER_BINARY_SRC:
            *dst = *src;
            break;

        case GUAC_TRANSFER_BINARY_DEST:
            /* NOP */
            break;

        case GUAC_TRANSFER_BINARY_NSRC:
            *dst = *src ^ 0x00FFFFFF;
            break;

        case GUAC_TRANSFER_BINARY_NDEST:
            *dst = *dst ^ 0x00FFFFFF;
            break;

        case GUAC_TRANSFER_BINARY_AND:
            *dst = ((*dst) & (0xFF000000 | *src));
            break;

        case GUAC_TRANSFER_BINARY_NAND:
            *dst = ((*dst) & (0xFF000000 | *src)) ^ 0x00FFFFFF;
            break;

        case GUAC_TRANSFER_BINARY_OR:
            *dst = ((*dst) | (0x00FFFFFF & *src));
            break;

        case GUAC_TRANSFER_BINARY_NOR:
            *dst = ((*dst) | (0x00FFFFFF & *src)) ^ 0x00FFFFFF;
            break;

        case GUAC_TRANSFER_BINARY_XOR:
            *dst = ((*dst) ^ (0x00FFFFFF & *src));
            break;

        case GUAC_TRANSFER_BINARY_XNOR:
            *dst = ((*dst) ^ (0x00FFFFFF & *src)) ^ 0x00FFFFFF;
            break;

        case GUAC_TRANSFER_BINARY_NSRC_AND:
            *dst = ((*dst) & (0xFF000000 | (*src ^ 0x00FFFFFF)));
            break;

        case GUAC_TRANSFER_BINARY_NSRC_NAND:
            *dst = ((*dst) & (0xFF000000 | (*src ^ 0x00FFFFFF))) ^ 0x00FFFFFF;
            break;

        case GUAC_TRANSFER_BINARY_NSRC_OR:
            *dst = ((*dst) | (0x00FFFFFF & (*src ^ 0x00FFFFFF)));
            break;

        case GUAC_TRANSFER_BINARY_NSRC_NOR:
            *dst = ((*dst) | (0x00FFFFFF & (*src ^ 0x00FFFFFF))) ^ 0x00FFFFFF;
            break;

    }

    return *dst != orig;

}

/**
 * Assigns the given value to all pixels within a rectangle of the backing
 * surface of the given destination surface. The color of all pixels within the
 * rectangle, including the alpha component, is entirely replaced.
 *
 * @param dst
 *     The destination surface.
 *
 * @param rect
 *     The rectangle to draw.
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
static void __guac_common_surface_set(guac_common_surface* dst,
        guac_common_rect* rect, int red, int green, int blue, int alpha) {

    int x, y;

    int dst_stride;
    unsigned char* dst_buffer;

    uint32_t color = (alpha << 24) | (red << 16) | (green << 8) | blue;

    int min_x = rect->width - 1;
    int min_y = rect->height - 1;
    int max_x = 0;
    int max_y = 0;

    dst_stride = dst->stride;
    dst_buffer = dst->buffer + (dst_stride * rect->y) + (4 * rect->x);

    /* For each row */
    for (y=0; y < rect->height; y++) {

        uint32_t* dst_current = (uint32_t*) dst_buffer;

        /* Set row */
        for (x=0; x < rect->width; x++) {

            uint32_t old_color = *dst_current;

            if (old_color != color) {
                if (x < min_x) min_x = x;
                if (y < min_y) min_y = y;
                if (x > max_x) max_x = x;
                if (y > max_y) max_y = y;
                *dst_current = color;
            }

            dst_current++;
        }

        /* Next row */
        dst_buffer += dst_stride;

    }

    /* Restrict destination rect to only updated pixels */
    if (max_x >= min_x && max_y >= min_y) {
        rect->x += min_x;
        rect->y += min_y;
        rect->width = max_x - min_x + 1;
        rect->height = max_y - min_y + 1;
    }
    else {
        rect->width = 0;
        rect->height = 0;
    }

}

/**
 * Applies the Porter-Duff "over" composite operator, blending the two given
 * color components using the given alpha value.
 *
 * @param dst
 *     The destination color component.
 *
 * @param src
 *     The source color component.
 *
 * @param alpha
 *     The alpha value which applies to the blending operation.
 *
 * @return
 *     The result of applying the Porter-Duff "over" composite operator to the
 *     given source and destination components.
 */
static int guac_common_surface_blend_component(int dst, int src, int alpha) {

    int blended = src + dst * (0xFF - alpha);

    /* Do not exceed maximum component value */
    if (blended > 0xFF)
        return 0xFF;

    return blended;

}

/**
 * Applies the Porter-Duff "over" composite operator, blending each component
 * of the two given ARGB colors.
 *
 * @param dst
 *     The destination ARGB color.
 *
 * @param src
 *     The source ARGB color.
 *
 * @return
 *     The result of applying the Porter-Duff "over" composite operator to the
 *     given source and destination colors.
 */
static uint32_t guac_common_surface_argb_blend(uint32_t dst, uint32_t src) {

    /* Separate destination ARGB color into its components */
    int dst_a = (dst >> 24) & 0xFF;
    int dst_r = (dst >> 16) & 0xFF;
    int dst_g = (dst >>  8) & 0xFF;
    int dst_b =  dst        & 0xFF;

    /* Separate source ARGB color into its components */
    int src_a = (src >> 24) & 0xFF;
    int src_r = (src >> 16) & 0xFF;
    int src_g = (src >>  8) & 0xFF;
    int src_b =  src        & 0xFF;

    /* If source is fully opaque (or destination is fully transparent), the
     * blended result is the source */
    if (src_a == 0xFF || dst_a == 0x00)
        return src;

    /* If source is fully transparent, the blended result is the destination */
    if (src_a == 0x00)
        return dst;

    /* Otherwise, blend each ARGB component, assuming pre-multiplied alpha */
    int r = guac_common_surface_blend_component(dst_r, src_r, src_a);
    int g = guac_common_surface_blend_component(dst_g, src_g, src_a);
    int b = guac_common_surface_blend_component(dst_b, src_b, src_a);
    int a = guac_common_surface_blend_component(dst_a, src_a, src_a);

    /* Recombine blended components */
    return (a << 24) | (r << 16) | (g << 8) | b;

}

/**
 * Copies data from the given buffer to the surface at the given coordinates.
 * The dimensions and location of the destination rectangle will be altered
 * to remove as many unchanged pixels as possible.
 *
 * @param src_buffer The buffer to copy.
 * @param src_stride The number of bytes in each row of the source buffer.
 * @param sx The X coordinate of the source rectangle.
 * @param sy The Y coordinate of the source rectangle.
 * @param dst The destination surface.
 * @param rect The destination rectangle.
 * @param opaque Non-zero if the source surface is opaque (its alpha channel
 *               should be ignored), zero otherwise.
 */
static void __guac_common_surface_put(unsigned char* src_buffer, int src_stride,
                                      int* sx, int* sy,
                                      guac_common_surface* dst, guac_common_rect* rect,
                                      int opaque) {

    unsigned char* dst_buffer = dst->buffer;
    int dst_stride = dst->stride;

    int x, y;

    int min_x = rect->width;
    int min_y = rect->height;
    int max_x = 0;
    int max_y = 0;

    int orig_x = rect->x;
    int orig_y = rect->y;

    src_buffer += src_stride * (*sy) + 4 * (*sx);
    dst_buffer += (dst_stride * rect->y) + (4 * rect->x);

    /* For each row */
    for (y=0; y < rect->height; y++) {

        uint32_t* src_current = (uint32_t*) src_buffer;
        uint32_t* dst_current = (uint32_t*) dst_buffer;

        /* Copy row */
        for (x=0; x < rect->width; x++) {

            uint32_t color;

            /* Get source and destination color values */
            uint32_t src_color = *src_current;
            uint32_t dst_color = *dst_current;

            /* Ignore alpha channel if opaque */
            if (opaque)
                color = src_color | 0xFF000000;

            /* Otherwise, perform alpha blending operation */
            else
                color = guac_common_surface_argb_blend(dst_color, src_color);

            /* If the destination color is changing, update rectangle bounds
             * and store the new color */
            if (dst_color != color) {
                if (x < min_x) min_x = x;
                if (y < min_y) min_y = y;
                if (x > max_x) max_x = x;
                if (y > max_y) max_y = y;
                *dst_current = color;
            }

            /* Advance to next pixel */
            src_current++;
            dst_current++;

        }

        /* Next row */
        src_buffer += src_stride;
        dst_buffer += dst_stride;

    }

    /* Restrict destination rect to only updated pixels */
    if (max_x >= min_x && max_y >= min_y) {
        rect->x += min_x;
        rect->y += min_y;
        rect->width = max_x - min_x + 1;
        rect->height = max_y - min_y + 1;
    }
    else {
        rect->width = 0;
        rect->height = 0;
    }

    /* Update source X/Y */
    *sx += rect->x - orig_x;
    *sy += rect->y - orig_y;

}

/**
 * Fills the given surface with color, using the given buffer as a mask. Color
 * will be added to the given surface iff the corresponding pixel within the
 * buffer is opaque.
 *
 * @param src_buffer The buffer to use as a mask.
 * @param src_stride The number of bytes in each row of the source buffer.
 * @param sx The X coordinate of the source rectangle.
 * @param sy The Y coordinate of the source rectangle.
 * @param dst The destination surface.
 * @param rect The destination rectangle.
 * @param red The red component of the color of the fill.
 * @param green The green component of the color of the fill.
 * @param blue The blue component of the color of the fill.
 */
static void __guac_common_surface_fill_mask(unsigned char* src_buffer, int src_stride,
                                            int sx, int sy,
                                            guac_common_surface* dst, guac_common_rect* rect,
                                            int red, int green, int blue) {

    unsigned char* dst_buffer = dst->buffer;
    int dst_stride = dst->stride;

    uint32_t color = 0xFF000000 | (red << 16) | (green << 8) | blue;
    int x, y;

    src_buffer += src_stride*sy + 4*sx;
    dst_buffer += (dst_stride * rect->y) + (4 * rect->x);

    /* For each row */
    for (y=0; y < rect->height; y++) {

        uint32_t* src_current = (uint32_t*) src_buffer;
        uint32_t* dst_current = (uint32_t*) dst_buffer;

        /* Stencil row */
        for (x=0; x < rect->width; x++) {

            /* Fill with color if opaque */
            if (*src_current & 0xFF000000)
                *dst_current = color;

            src_current++;
            dst_current++;
        }

        /* Next row */
        src_buffer += src_stride;
        dst_buffer += dst_stride;

    }

}

/**
 * Copies data from the given surface to the given destination surface using
 * the specified transfer function.
 *
 * @param src_buffer The buffer to copy.
 * @param src_stride The number of bytes in each row of the source buffer.
 * @param sx The X coordinate of the source rectangle.
 * @param sy The Y coordinate of the source rectangle.
 * @param op The transfer function to use.
 * @param dst The destination surface.
 * @param rect The destination rectangle.
 */
static void __guac_common_surface_transfer(guac_common_surface* src, int* sx, int* sy,
                                           guac_transfer_function op,
                                           guac_common_surface* dst, guac_common_rect* rect) {

    unsigned char* src_buffer = src->buffer;
    unsigned char* dst_buffer = dst->buffer;

    int x, y;
    int src_stride, dst_stride;
    int step = 1;

    int min_x = rect->width - 1;
    int min_y = rect->height - 1;
    int max_x = 0;
    int max_y = 0;

    int orig_x = rect->x;
    int orig_y = rect->y;

    /* Copy forwards only if destination is in a different surface or is before source */
    if (src != dst || rect->y < *sy || (rect->y == *sy && rect->x < *sx)) {
        src_buffer += src->stride * (*sy) + 4 * (*sx);
        dst_buffer += (dst->stride * rect->y) + (4 * rect->x);
        src_stride = src->stride;
        dst_stride = dst->stride;
        step = 1;
    }

    /* Otherwise, copy backwards */
    else {
        src_buffer += src->stride * (*sy + rect->height - 1) + 4 * (*sx + rect->width - 1);
        dst_buffer += dst->stride * (rect->y + rect->height - 1) + 4 * (rect->x + rect->width - 1);
        src_stride = -src->stride;
        dst_stride = -dst->stride;
        step = -1;
    }

    /* For each row */
    for (y=0; y < rect->height; y++) {

        uint32_t* src_current = (uint32_t*) src_buffer;
        uint32_t* dst_current = (uint32_t*) dst_buffer;

        /* Transfer each pixel in row */
        for (x=0; x < rect->width; x++) {

            if (__guac_common_surface_transfer_int(op, src_current, dst_current)) {
                if (x < min_x) min_x = x;
                if (y < min_y) min_y = y;
                if (x > max_x) max_x = x;
                if (y > max_y) max_y = y;
            }

            src_current += step;
            dst_current += step;
        }

        /* Next row */
        src_buffer += src_stride;
        dst_buffer += dst_stride;

    }

    /* Translate X coordinate space of moving backwards */
    if (step < 0) {
        int old_max_x = max_x;
        max_x = rect->width - 1 - min_x;
        min_x = rect->width - 1 - old_max_x;
    }

    /* Translate Y coordinate space of moving backwards */
    if (dst_stride < 0) {
        int old_max_y = max_y;
        max_y = rect->height - 1 - min_y;
        min_y = rect->height - 1 - old_max_y;
    }

    /* Restrict destination rect to only updated pixels */
    if (max_x >= min_x && max_y >= min_y) {
        rect->x += min_x;
        rect->y += min_y;
        rect->width = max_x - min_x + 1;
        rect->height = max_y - min_y + 1;
    }
    else {
        rect->width = 0;
        rect->height = 0;
    }

    /* Update source X/Y */
    *sx += rect->x - orig_x;
    *sy += rect->y - orig_y;

}

guac_common_surface* guac_common_surface_alloc(guac_client* client,
        guac_socket* socket, const guac_layer* layer, int w, int h) {

    /* Calculate heat map dimensions */
    size_t heat_width = GUAC_COMMON_SURFACE_HEAT_DIMENSION(w);
    size_t heat_height = GUAC_COMMON_SURFACE_HEAT_DIMENSION(h);

    /* Init surface */
    guac_common_surface* surface = guac_mem_zalloc(sizeof(guac_common_surface));
    surface->client = client;
    surface->socket = socket;
    surface->layer = layer;
    surface->parent = GUAC_DEFAULT_LAYER;
    surface->opacity = 0xFF;
    surface->width = w;
    surface->height = h;

    pthread_mutex_init(&surface->_lock, NULL);

    /* Create corresponding Cairo surface */
    surface->stride = cairo_format_stride_for_width(CAIRO_FORMAT_ARGB32, w);
    surface->buffer = guac_mem_zalloc(h, surface->stride);

    /* Create corresponding heat map */
    surface->heat_map = guac_mem_zalloc(heat_width, heat_height,
            sizeof(guac_common_surface_heat_cell));

    /* Reset clipping rect */
    guac_common_surface_reset_clip(surface);

    /* Layers must initially exist */
    if (layer->index >= 0) {
        guac_protocol_send_size(socket, layer, w, h);
        surface->realized = 1;
    }

    /* Defer creation of buffers */
    else
        surface->realized = 0;

    return surface;
}

void guac_common_surface_free(guac_common_surface* surface) {

    /* Only dispose of surface if it exists */
    if (surface->realized)
        guac_protocol_send_dispose(surface->socket, surface->layer);

    pthread_mutex_destroy(&surface->_lock);

    guac_mem_free(surface->heat_map);
    guac_mem_free(surface->buffer);
    guac_mem_free(surface);

}

void guac_common_surface_resize(guac_common_surface* surface, int w, int h) {

    pthread_mutex_lock(&surface->_lock);

    /* Ignore if resize will have no effect */
    if (w == surface->width && h == surface->height)
        goto complete;

    guac_socket* socket = surface->socket;
    const guac_layer* layer = surface->layer;

    unsigned char* old_buffer;
    int old_stride;
    guac_common_rect old_rect;

    int sx = 0;
    int sy = 0;

    /* Calculate heat map dimensions */
    size_t heat_width = GUAC_COMMON_SURFACE_HEAT_DIMENSION(w);
    size_t heat_height = GUAC_COMMON_SURFACE_HEAT_DIMENSION(h);

    /* Copy old surface data */
    old_buffer = surface->buffer;
    old_stride = surface->stride;
    guac_common_rect_init(&old_rect, 0, 0, surface->width, surface->height);

    /* Re-initialize at new size */
    surface->width  = w;
    surface->height = h;
    surface->stride = cairo_format_stride_for_width(CAIRO_FORMAT_ARGB32, w);
    surface->buffer = guac_mem_zalloc(h, surface->stride);
    __guac_common_bound_rect(surface, &surface->clip_rect, NULL, NULL);

    /* Copy relevant old data */
    __guac_common_bound_rect(surface, &old_rect, NULL, NULL);
    __guac_common_surface_put(old_buffer, old_stride, &sx, &sy, surface, &old_rect, 1);

    /* Free old data */
    guac_mem_free(old_buffer);

    /* Allocate completely new heat map (can safely discard old stats) */
    guac_mem_free(surface->heat_map);
    surface->heat_map = guac_mem_zalloc(heat_width, heat_height,
            sizeof(guac_common_surface_heat_cell));

    /* Resize dirty rect to fit new surface dimensions */
    if (surface->dirty) {
        __guac_common_bound_rect(surface, &surface->dirty_rect, NULL, NULL);
        if (surface->dirty_rect.width <= 0 || surface->dirty_rect.height <= 0)
            surface->dirty = 0;
    }

    /* Update Guacamole layer */
    if (surface->realized)
        guac_protocol_send_size(socket, layer, w, h);

complete:
    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_draw(guac_common_surface* surface, int x, int y, cairo_surface_t* src) {

    pthread_mutex_lock(&surface->_lock);

    unsigned char* buffer = cairo_image_surface_get_data(src);
    cairo_format_t format = cairo_image_surface_get_format(src);
    int stride = cairo_image_surface_get_stride(src);
    int w = cairo_image_surface_get_width(src);
    int h = cairo_image_surface_get_height(src);

    int sx = 0;
    int sy = 0;

    guac_common_rect rect;
    guac_common_rect_init(&rect, x, y, w, h);

    /* Clip operation */
    __guac_common_clip_rect(surface, &rect, &sx, &sy);
    if (rect.width <= 0 || rect.height <= 0)
        goto complete;

    /* Update backing surface */
    __guac_common_surface_put(buffer, stride, &sx, &sy, surface, &rect, format != CAIRO_FORMAT_ARGB32);
    if (rect.width <= 0 || rect.height <= 0)
        goto complete;

    /* Update the heat map for the update rectangle. */
    guac_timestamp time = guac_timestamp_current();
    __guac_common_surface_touch_rect(surface, &rect, time);

    /* Flush if not combining */
    if (!__guac_common_should_combine(surface, &rect, 0))
        __guac_common_surface_flush_deferred(surface);

    /* Always defer draws */
    __guac_common_mark_dirty(surface, &rect);

complete:
    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_paint(guac_common_surface* surface, int x, int y,
        cairo_surface_t* src, int red, int green, int blue) {

    pthread_mutex_lock(&surface->_lock);

    unsigned char* buffer = cairo_image_surface_get_data(src);
    int stride = cairo_image_surface_get_stride(src);
    int w = cairo_image_surface_get_width(src);
    int h = cairo_image_surface_get_height(src);

    int sx = 0;
    int sy = 0;

    guac_common_rect rect;
    guac_common_rect_init(&rect, x, y, w, h);

    /* Clip operation */
    __guac_common_clip_rect(surface, &rect, &sx, &sy);
    if (rect.width <= 0 || rect.height <= 0)
        goto complete;

    /* Update backing surface */
    __guac_common_surface_fill_mask(buffer, stride, sx, sy, surface, &rect, red, green, blue);

    /* Flush if not combining */
    if (!__guac_common_should_combine(surface, &rect, 0))
        __guac_common_surface_flush_deferred(surface);

    /* Always defer draws */
    __guac_common_mark_dirty(surface, &rect);

complete:
    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_copy(guac_common_surface* src, int sx, int sy,
        int w, int h, guac_common_surface* dst, int dx, int dy) {

    /* Lock both surfaces */
    pthread_mutex_lock(&dst->_lock);
    if (src != dst)
        pthread_mutex_lock(&src->_lock);

    guac_socket* socket = dst->socket;
    const guac_layer* src_layer = src->layer;
    const guac_layer* dst_layer = dst->layer;

    guac_common_rect srect;
    guac_common_rect_init(&srect, sx, sy, w, h);

    /* Clip operation source rect to bounds */
    __guac_common_bound_rect(src, &srect, &dx, &dy);
    if (srect.width <= 0 || srect.height <= 0)
        goto complete;

    guac_common_rect drect;
    guac_common_rect_init(&drect, dx, dy,
            srect.width, srect.height);

    /* Clip operation destination rect */
    __guac_common_clip_rect(dst, &drect, &srect.x, &srect.y);
    if (drect.width <= 0 || drect.height <= 0)
        goto complete;

    /* NOTE: Being the last rectangle to be adjusted, only the width/height of
     * drect is now correct! */

    /* Update backing surface first only if drect cannot intersect srect */
    if (src != dst) {
        __guac_common_surface_transfer(src, &srect.x, &srect.y,
                GUAC_TRANSFER_BINARY_SRC, dst, &drect);
        if (drect.width <= 0 || drect.height <= 0)
            goto complete;
    }

    /* Defer if combining */
    if (__guac_common_should_combine(dst, &drect, 1))
        __guac_common_mark_dirty(dst, &drect);

    /* Otherwise, flush and draw immediately */
    else {
        __guac_common_surface_flush(dst);
        __guac_common_surface_flush(src);
        guac_protocol_send_copy(socket, src_layer, srect.x, srect.y,
                drect.width, drect.height, GUAC_COMP_OVER, dst_layer,
                drect.x, drect.y);
        dst->realized = 1;
    }

    /* Update backing surface last if drect can intersect srect */
    if (src == dst)
        __guac_common_surface_transfer(src, &srect.x, &srect.y,
                GUAC_TRANSFER_BINARY_SRC, dst, &drect);

complete:

    /* Unlock both surfaces */
    pthread_mutex_unlock(&dst->_lock);
    if (src != dst)
        pthread_mutex_unlock(&src->_lock);

}

void guac_common_surface_transfer(guac_common_surface* src, int sx, int sy, int w, int h,
                                  guac_transfer_function op, guac_common_surface* dst, int dx, int dy) {

    /* Lock both surfaces */
    pthread_mutex_lock(&dst->_lock);
    if (src != dst)
        pthread_mutex_lock(&src->_lock);

    guac_socket* socket = dst->socket;
    const guac_layer* src_layer = src->layer;
    const guac_layer* dst_layer = dst->layer;

    guac_common_rect srect;
    guac_common_rect_init(&srect, sx, sy, w, h);

    /* Clip operation source rect to bounds */
    __guac_common_bound_rect(src, &srect, &dx, &dy);
    if (srect.width <= 0 || srect.height <= 0)
        goto complete;

    guac_common_rect drect;
    guac_common_rect_init(&drect, dx, dy,
            srect.width, srect.height);

    /* Clip operation destination rect */
    __guac_common_clip_rect(dst, &drect, &srect.x, &srect.y);
    if (drect.width <= 0 || drect.height <= 0)
        goto complete;

    /* NOTE: Being the last rectangle to be adjusted, only the width/height of
     * drect is now correct! */

    /* Update backing surface first only if drect cannot intersect srect */
    if (src != dst) {
        __guac_common_surface_transfer(src, &srect.x, &srect.y, op, dst, &drect);
        if (drect.width <= 0 || drect.height <= 0)
            goto complete;
    }

    /* Defer if combining */
    if (__guac_common_should_combine(dst, &drect, 1))
        __guac_common_mark_dirty(dst, &drect);

    /* Otherwise, flush and draw immediately */
    else {
        __guac_common_surface_flush(dst);
        __guac_common_surface_flush(src);
        guac_protocol_send_transfer(socket, src_layer, srect.x, srect.y,
                drect.width, drect.height, op, dst_layer, drect.x, drect.y);
        dst->realized = 1;
    }

    /* Update backing surface last if drect can intersect srect */
    if (src == dst)
        __guac_common_surface_transfer(src, &srect.x, &srect.y, op, dst, &drect);

complete:

    /* Unlock both surfaces */
    pthread_mutex_unlock(&dst->_lock);
    if (src != dst)
        pthread_mutex_unlock(&src->_lock);

}

void guac_common_surface_set(guac_common_surface* surface,
        int x, int y, int w, int h, int red, int green, int blue, int alpha) {

    pthread_mutex_lock(&surface->_lock);

    guac_socket* socket = surface->socket;
    const guac_layer* layer = surface->layer;

    guac_common_rect rect;
    guac_common_rect_init(&rect, x, y, w, h);

    /* Clip operation */
    __guac_common_clip_rect(surface, &rect, NULL, NULL);
    if (rect.width <= 0 || rect.height <= 0)
        goto complete;

    /* Update backing surface */
    __guac_common_surface_set(surface, &rect, red, green, blue, alpha);
    if (rect.width <= 0 || rect.height <= 0)
        goto complete;

    /* Handle as normal draw if non-opaque */
    if (alpha != 0xFF) {

        /* Flush if not combining */
        if (!__guac_common_should_combine(surface, &rect, 0))
            __guac_common_surface_flush_deferred(surface);

        /* Always defer draws */
        __guac_common_mark_dirty(surface, &rect);

    }

    /* Defer if combining */
    else if (__guac_common_should_combine(surface, &rect, 1))
        __guac_common_mark_dirty(surface, &rect);

    /* Otherwise, flush and draw immediately */
    else {
        __guac_common_surface_flush(surface);
        guac_protocol_send_rect(socket, layer, rect.x, rect.y, rect.width, rect.height);
        guac_protocol_send_cfill(socket, GUAC_COMP_OVER, layer, red, green, blue, alpha);
        surface->realized = 1;
    }

complete:
    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_clip(guac_common_surface* surface, int x, int y, int w, int h) {

    pthread_mutex_lock(&surface->_lock);

    guac_common_rect clip;

    /* Init clipping rectangle if clipping not already applied */
    if (!surface->clipped) {
        guac_common_rect_init(&surface->clip_rect, 0, 0, surface->width, surface->height);
        surface->clipped = 1;
    }

    guac_common_rect_init(&clip, x, y, w, h);
    guac_common_rect_constrain(&surface->clip_rect, &clip);

    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_reset_clip(guac_common_surface* surface) {
    pthread_mutex_lock(&surface->_lock);
    surface->clipped = 0;
    pthread_mutex_unlock(&surface->_lock);
}

/**
 * Flushes the bitmap update currently described by the dirty rectangle within
 * the given surface directly via an "img" instruction as PNG data. The
 * resulting instructions will be sent over the socket associated with the
 * given surface.
 *
 * @param surface
 *     The surface to flush.
 *
 * @param opaque
 *     Whether the rectangle being flushed contains only fully-opaque pixels.
 */
static void __guac_common_surface_flush_to_png(guac_common_surface* surface,
        int opaque) {

    if (surface->dirty) {

        guac_socket* socket = surface->socket;
        const guac_layer* layer = surface->layer;

        /* Get Cairo surface for specified rect */
        unsigned char* buffer = surface->buffer
                              + surface->dirty_rect.y * surface->stride
                              + surface->dirty_rect.x * 4;

        cairo_surface_t* rect;

        /* Use RGB24 if the image is fully opaque */
        if (opaque)
            rect = cairo_image_surface_create_for_data(buffer,
                    CAIRO_FORMAT_RGB24, surface->dirty_rect.width,
                    surface->dirty_rect.height, surface->stride);

        /* Otherwise ARGB32 is needed */
        else {

            rect = cairo_image_surface_create_for_data(buffer,
                    CAIRO_FORMAT_ARGB32, surface->dirty_rect.width,
                    surface->dirty_rect.height, surface->stride);

            /* Clear destination rect first */
            guac_protocol_send_rect(socket, layer,
                    surface->dirty_rect.x, surface->dirty_rect.y,
                    surface->dirty_rect.width, surface->dirty_rect.height);
            guac_protocol_send_cfill(socket, GUAC_COMP_ROUT, layer,
                    0x00, 0x00, 0x00, 0xFF);

        }

        /* Send PNG for rect */
        guac_client_stream_png(surface->client, socket, GUAC_COMP_OVER,
                layer, surface->dirty_rect.x, surface->dirty_rect.y, rect);

        cairo_surface_destroy(rect);
        surface->realized = 1;

        /* Surface is no longer dirty */
        surface->dirty = 0;

    }

}

/**
 * Returns an appropriate quality between 0 and 100 for lossy encoding
 * depending on the current processing lag calculated for the given client.
 *
 * @param client
 *     The client for which the lossy quality is being calculated.
 *
 * @return
 *     A value between 0 and 100 inclusive which seems appropriate for the
 *     client based on lag measurements.
 */
static int guac_common_surface_suggest_quality(guac_client* client) {

    int lag = guac_client_get_processing_lag(client);

    /* Scale quality linearly from 90 to 30 as lag varies from 20ms to 80ms */
    int quality = 90 - (lag - 20);

    /* Do not exceed 90 for quality */
    if (quality > 90)
        return 90;

    /* Do not go below 30 for quality */
    if (quality < 30)
        return 30;

    return quality;

}

/**
 * Flushes the bitmap update currently described by the dirty rectangle within
 * the given surface directly via an "img" instruction as JPEG data. The
 * resulting instructions will be sent over the socket associated with the
 * given surface.
 *
 * @param surface
 *     The surface to flush.
 */
static void __guac_common_surface_flush_to_jpeg(guac_common_surface* surface) {

    if (surface->dirty) {

        guac_socket* socket = surface->socket;
        const guac_layer* layer = surface->layer;

        guac_common_rect max;
        guac_common_rect_init(&max, 0, 0, surface->width, surface->height);

        /* Expand the dirty rect size to fit in a grid with cells equal to the
         * minimum JPEG block size */
        guac_common_rect_expand_to_grid(GUAC_SURFACE_JPEG_BLOCK_SIZE,
                                        &surface->dirty_rect, &max);

        /* Get Cairo surface for specified rect */
        unsigned char* buffer = surface->buffer
                              + surface->dirty_rect.y * surface->stride
                              + surface->dirty_rect.x * 4;

        cairo_surface_t* rect = cairo_image_surface_create_for_data(buffer,
                CAIRO_FORMAT_RGB24, surface->dirty_rect.width,
                surface->dirty_rect.height, surface->stride);

        /* Send JPEG for rect */
        guac_client_stream_jpeg(surface->client, socket, GUAC_COMP_OVER, layer,
                surface->dirty_rect.x, surface->dirty_rect.y, rect,
                guac_common_surface_suggest_quality(surface->client));

        cairo_surface_destroy(rect);
        surface->realized = 1;

        /* Surface is no longer dirty */
        surface->dirty = 0;

    }

}

/**
 * Flushes the bitmap update currently described by the dirty rectangle within
 * the given surface directly via an "img" instruction as WebP data. The
 * resulting instructions will be sent over the socket associated with the
 * given surface.
 *
 * @param surface
 *     The surface to flush.
 *
 * @param opaque
 *     Whether the rectangle being flushed contains only fully-opaque pixels.
 */
static void __guac_common_surface_flush_to_webp(guac_common_surface* surface,
        int opaque) {

    if (surface->dirty) {

        guac_socket* socket = surface->socket;
        const guac_layer* layer = surface->layer;

        guac_common_rect max;
        guac_common_rect_init(&max, 0, 0, surface->width, surface->height);

        /* Expand the dirty rect size to fit in a grid with cells equal to the
         * minimum WebP block size */
        guac_common_rect_expand_to_grid(GUAC_SURFACE_WEBP_BLOCK_SIZE,
                                        &surface->dirty_rect, &max);

        /* Get Cairo surface for specified rect */
        unsigned char* buffer = surface->buffer
                              + surface->dirty_rect.y * surface->stride
                              + surface->dirty_rect.x * 4;

        cairo_surface_t* rect;

        /* Use RGB24 if the image is fully opaque */
        if (opaque)
            rect = cairo_image_surface_create_for_data(buffer,
                    CAIRO_FORMAT_RGB24, surface->dirty_rect.width,
                    surface->dirty_rect.height, surface->stride);

        /* Otherwise ARGB32 is needed */
        else
            rect = cairo_image_surface_create_for_data(buffer,
                    CAIRO_FORMAT_ARGB32, surface->dirty_rect.width,
                    surface->dirty_rect.height, surface->stride);

        /* Send WebP for rect */
        guac_client_stream_webp(surface->client, socket, GUAC_COMP_OVER, layer,
                surface->dirty_rect.x, surface->dirty_rect.y, rect,
                guac_common_surface_suggest_quality(surface->client),
                surface->lossless ? 1 : 0);

        cairo_surface_destroy(rect);
        surface->realized = 1;

        /* Surface is no longer dirty */
        surface->dirty = 0;

    }

}

/**
 * Comparator for instances of guac_common_surface_bitmap_rect, the elements
 * which make up a surface's bitmap buffer.
 *
 * @see qsort
 */
static int __guac_common_surface_bitmap_rect_compare(const void* a, const void* b) {

    guac_common_surface_bitmap_rect* ra = (guac_common_surface_bitmap_rect*) a;
    guac_common_surface_bitmap_rect* rb = (guac_common_surface_bitmap_rect*) b;

    /* Order roughly top to bottom, left to right */
    if (ra->rect.y != rb->rect.y) return ra->rect.y - rb->rect.y;
    if (ra->rect.x != rb->rect.x) return ra->rect.x - rb->rect.x;

    /* Wider updates should come first (more likely to intersect later) */
    if (ra->rect.width != rb->rect.width) return rb->rect.width - ra->rect.width;

    /* Shorter updates should come first (less likely to increase cost) */
    return ra->rect.height - rb->rect.height;

}

/**
 * Flushes only the properties of the given surface, such as layer location or
 * opacity. Image state is not flushed. If the surface represents a buffer or
 * the default layer, this function has no effect.
 *
 * @param surface
 *     The surface to flush.
 */
static void __guac_common_surface_flush_properties(
        guac_common_surface* surface) {

    guac_socket* socket = surface->socket;

    /* Only applicable to non-default visible layers */
    if (surface->layer->index <= 0)
        return;

    /* Flush opacity */
    if (surface->opacity_dirty) {
        guac_protocol_send_shade(socket, surface->layer, surface->opacity);
        surface->opacity_dirty = 0;
    }

    /* Flush location and hierarchy */
    if (surface->location_dirty) {
        guac_protocol_send_move(socket, surface->layer,
                surface->parent, surface->x, surface->y, surface->z);
        surface->location_dirty = 0;
    }

}

static void __guac_common_surface_flush(guac_common_surface* surface) {

    /* Flush final dirty rectangle to queue. */
    __guac_common_surface_flush_to_queue(surface);

    guac_common_surface_bitmap_rect* current = surface->bitmap_queue;
    int i, j;
    int original_queue_length;
    int flushed = 0;

    original_queue_length = surface->bitmap_queue_length;

    /* Sort updates to make combination less costly */
    qsort(surface->bitmap_queue, surface->bitmap_queue_length, sizeof(guac_common_surface_bitmap_rect),
          __guac_common_surface_bitmap_rect_compare);

    /* Flush all rects in queue */
    for (i=0; i < surface->bitmap_queue_length; i++) {

        /* Get next unflushed candidate */
        guac_common_surface_bitmap_rect* candidate = current;
        if (!candidate->flushed) {

            int combined = 0;

            /* Build up rect as much as possible */
            for (j=i; j < surface->bitmap_queue_length; j++) {

                if (!candidate->flushed) {

                    /* Clip candidate within current bounds */
                    __guac_common_bound_rect(surface, &candidate->rect, NULL, NULL);
                    if (candidate->rect.width <= 0 || candidate->rect.height <= 0)
                        candidate->flushed = 1;

                    /* Combine if reasonable */
                    else if (__guac_common_should_combine(surface, &candidate->rect, 0) || !surface->dirty) {
                        __guac_common_mark_dirty(surface, &candidate->rect);
                        candidate->flushed = 1;
                        combined++;
                    }

                }

                candidate++;

            }

            /* Re-add to queue if there's room and this update was modified or we expect others might be */
            if ((combined > 1 || i < original_queue_length)
                    && surface->bitmap_queue_length < GUAC_COMMON_SURFACE_QUEUE_SIZE)
                __guac_common_surface_flush_to_queue(surface);

            /* Flush as bitmap otherwise */
            else if (surface->dirty) {

                flushed++;

                int opaque = __guac_common_surface_is_opaque(surface,
                            &surface->dirty_rect);

                /* Prefer WebP when reasonable */
                if (__guac_common_surface_should_use_webp(surface,
                            &surface->dirty_rect))
                    __guac_common_surface_flush_to_webp(surface, opaque);

                /* If not WebP, JPEG is the next best (lossy) choice */
                else if (opaque && __guac_common_surface_should_use_jpeg(
                            surface, &surface->dirty_rect))
                    __guac_common_surface_flush_to_jpeg(surface);

                /* Use PNG if no lossy formats are appropriate */
                else
                    __guac_common_surface_flush_to_png(surface, opaque);

            }

        }

        current++;

    }

    /* Flush complete */
    surface->bitmap_queue_length = 0;

}

void guac_common_surface_flush(guac_common_surface* surface) {

    pthread_mutex_lock(&surface->_lock);

    /* Flush any applicable layer properties */
    __guac_common_surface_flush_properties(surface);

    /* Flush surface contents */
    __guac_common_surface_flush(surface);

    pthread_mutex_unlock(&surface->_lock);

}

void guac_common_surface_dup(guac_common_surface* surface,
        guac_client* client, guac_socket* socket) {

    pthread_mutex_lock(&surface->_lock);

    /* Do nothing if not realized */
    if (!surface->realized)
        goto complete;

    /* Synchronize layer-specific properties if applicable */
    if (surface->layer->index > 0) {

        /* Synchronize opacity */
        guac_protocol_send_shade(socket, surface->layer, surface->opacity);

        /* Synchronize location and hierarchy */
        guac_protocol_send_move(socket, surface->layer,
                surface->parent, surface->x, surface->y, surface->z);

    }

    /* Synchronize multi-touch support level */
    else if (surface->layer->index == 0)
        guac_protocol_send_set_int(socket, surface->layer,
                GUAC_PROTOCOL_LAYER_PARAMETER_MULTI_TOUCH,
                    surface->touches);

    /* Sync size to new socket */
    guac_protocol_send_size(socket, surface->layer,
            surface->width, surface->height);

    /* Send contents of layer, if non-empty */
    if (surface->width > 0 && surface->height > 0) {

        /* Get entire surface */
        cairo_surface_t* rect = cairo_image_surface_create_for_data(
                surface->buffer, CAIRO_FORMAT_ARGB32,
                surface->width, surface->height, surface->stride);

        /* Send PNG for rect */
        guac_client_stream_png(client, socket, GUAC_COMP_OVER, surface->layer,
                0, 0, rect);
        cairo_surface_destroy(rect);

    }

complete:
    pthread_mutex_unlock(&surface->_lock);

}
