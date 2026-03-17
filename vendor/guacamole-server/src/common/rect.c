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

void guac_common_rect_init(guac_common_rect* rect, int x, int y, int width, int height) {
    rect->x      = x;
    rect->y      = y;
    rect->width  = width;
    rect->height = height;
}

void guac_common_rect_extend(guac_common_rect* rect, const guac_common_rect* min) {

    /* Calculate extents of existing dirty rect */
    int left   = rect->x;
    int top    = rect->y;
    int right  = left + rect->width;
    int bottom = top  + rect->height;

    /* Calculate missing extents of given new rect */
    int min_left   = min->x;
    int min_top    = min->y;
    int min_right  = min_left + min->width;
    int min_bottom = min_top  + min->height;

    /* Update minimums */
    if (min_left   < left)   left   = min_left;
    if (min_top    < top)    top    = min_top;
    if (min_right  > right)  right  = min_right;
    if (min_bottom > bottom) bottom = min_bottom;

    /* Commit rect */
    guac_common_rect_init(rect, left, top, right - left, bottom - top);

}

void guac_common_rect_constrain(guac_common_rect* rect, const guac_common_rect* max) {

    /* Calculate extents of existing dirty rect */
    int left   = rect->x;
    int top    = rect->y;
    int right  = left + rect->width;
    int bottom = top  + rect->height;

    /* Calculate missing extents of given new rect */
    int max_left   = max->x;
    int max_top    = max->y;
    int max_right  = max_left + max->width;
    int max_bottom = max_top  + max->height;

    /* Update maximums */
    if (max_left   > left)   left   = max_left;
    if (max_top    > top)    top    = max_top;
    if (max_right  < right)  right  = max_right;
    if (max_bottom < bottom) bottom = max_bottom;

    /* Commit rect */
    guac_common_rect_init(rect, left, top, right - left, bottom - top);

}

int guac_common_rect_expand_to_grid(int cell_size, guac_common_rect* rect,
                                    const guac_common_rect* max_rect) {

    /* Invalid cell_size received */
    if (cell_size <= 0)
        return -1;

    /* Nothing to do */
    if (cell_size == 1)
        return 0;

    /* Calculate how much the rectangle must be adjusted to fit within the
     * given cell size. */
    int dw = cell_size - rect->width % cell_size;
    int dh = cell_size - rect->height % cell_size;

    int dx = dw / 2;
    int dy = dh / 2;

    /* Set initial extents of adjusted rectangle. */
    int top = rect->y - dy;
    int left = rect->x - dx;
    int bottom = top + rect->height + dh;
    int right = left + rect->width + dw;

    /* The max rectangle */
    int max_left   = max_rect->x;
    int max_top    = max_rect->y;
    int max_right  = max_left + max_rect->width;
    int max_bottom = max_top  + max_rect->height;

    /* If the adjusted rectangle has sides beyond the max rectangle, or is larger
     * in any direction; shift or adjust the rectangle while trying to fit in
     * the grid */

    /* Adjust left/right */
    if (right > max_right) {

        /* shift to left */
        dw = right - max_right;
        right -= dw;
        left -= dw;

        /* clamp left if too far */
        if (left < max_left) {
            left = max_left;
        }
    }
    else if (left < max_left) {

        /* shift to right */
        dw = max_left - left;
        left += dw;
        right += dw;

        /* clamp right if too far */
        if (right > max_right) {
            right = max_right;
        }
    }

    /* Adjust top/bottom */
    if (bottom > max_bottom) {

        /* shift up */
        dh = bottom - max_bottom;
        bottom -= dh;
        top -= dh;

        /* clamp top if too far */
        if (top < max_top) {
            top = max_top;
        }
    }
    else if (top < max_top) {

        /* shift down */
        dh = max_top - top;
        top += dh;
        bottom += dh;

        /* clamp bottom if too far */
        if (bottom > max_bottom) {
            bottom = max_bottom;
        }
    }

    /* Commit rect */
    guac_common_rect_init(rect, left, top, right - left, bottom - top);

    return 0;

}

int guac_common_rect_intersects(const guac_common_rect* rect,
                                const guac_common_rect* other) {

    /* Empty (no intersection) */
    if (other->x + other->width < rect->x || rect->x + rect->width < other->x ||
        other->y + other->height < rect->y || rect->y + rect->height < other->y) {
        return 0;
    }
    /* Complete */
    else if (other->x <= rect->x && (other->x + other->width) >= (rect->x + rect->width) &&
        other->y <= rect->y && (other->y + other->height) >= (rect->y + rect->height)) {
        return 2;
    }
    /* Partial intersection */
    return 1;

}

int guac_common_rect_clip_and_split(guac_common_rect* rect,
        const guac_common_rect* hole, guac_common_rect* split_rect) {

    /* Only continue if the rectangles intersects */
    if (!guac_common_rect_intersects(rect, hole))
        return 0;

    int top, left, bottom, right;

    /* Clip and split top */
    if (rect->y < hole->y) {
        top = rect->y;
        left = rect->x;
        bottom = hole->y;
        right = rect->x + rect->width;
        guac_common_rect_init(split_rect, left, top, right - left, bottom - top);

        /* Re-initialize original rect */
        top = hole->y;
        bottom = rect->y + rect->height;
        guac_common_rect_init(rect, left, top, right - left, bottom - top);

        return 1;
    }

    /* Clip and split left */
    else if (rect->x < hole->x) {
        top = rect->y;
        left = rect->x;
        bottom = rect->y + rect->height;
        right = hole->x;
        guac_common_rect_init(split_rect, left, top, right - left, bottom - top);

        /* Re-initialize original rect */
        left = hole->x;
        right = rect->x + rect->width;
        guac_common_rect_init(rect, left, top, right - left, bottom - top);

        return 1;
    }

    /* Clip and split bottom */
    else if (rect->y + rect->height > hole->y + hole->height) {
        top = hole->y + hole->height;
        left = rect->x;
        bottom = rect->y + rect->height;
        right = rect->x + rect->width;
        guac_common_rect_init(split_rect, left, top, right - left, bottom - top);

        /* Re-initialize original rect */
        top = rect->y;
        bottom = hole->y + hole->height;
        guac_common_rect_init(rect, left, top, right - left, bottom - top);

        return 1;
    }

    /* Clip and split right */
    else if (rect->x + rect->width > hole->x + hole->width) {
        top = rect->y;
        left = hole->x + hole->width;
        bottom = rect->y + rect->height;
        right = rect->x + rect->width;
        guac_common_rect_init(split_rect, left, top, right - left, bottom - top);

        /* Re-initialize original rect */
        left = rect->x;
        right = hole->x + hole->width;
        guac_common_rect_init(rect, left, top, right - left, bottom - top);

        return 1;
    }

    return 0;
}
