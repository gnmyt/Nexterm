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

#include "guacamole/rect.h"

/**
 * Given a bitmask that is one less than a power of two (ie: 0xF, 0x1F, etc.),
 * rounds the given value in the negative direction to the nearest multiple of
 * that power of two. Positive values are rounded down towards zero while
 * negative values are rounded up toward negative values of greater magnitude.
 *
 * @param value
 *     The value to round.
 *
 * @param mask
 *     A bitmask whose integer value is one less than a power of two.
 *
 * @return
 *     The given value, rounded to the nearest multiple of the power of two
 *     represented by the given mask, where that rounding is performed in the
 *     negative direction.
 */
#define GUAC_RECT_ROUND_NEG(value, mask) (value & ~mask)

/**
 * Given a bitmask that is one less than a power of two (ie: 0xF, 0x1F, etc.),
 * rounds the given value in the positive direction to the nearest multiple of
 * that power of two. Negative values are rounded down towards zero while
 * positive values are rounded up toward positive values of greater magnitude.
 *
 * @param value
 *     The value to round.
 *
 * @param mask
 *     A bitmask whose integer value is one less than a power of two.
 *
 * @return
 *     The given value, rounded to the nearest multiple of the power of two
 *     represented by the given mask, where that rounding is performed in the
 *     positive direction.
 */
#define GUAC_RECT_ROUND_POS(value, mask) ((value + mask) & ~mask)

void guac_rect_init(guac_rect* rect, int x, int y, int width, int height) {
    *rect = (guac_rect) {
        .left   = x,
        .top    = y,
        .right  = width  > 0 ? x + width  : x,
        .bottom = height > 0 ? y + height : y
    };
}

void guac_rect_extend(guac_rect* rect, const guac_rect* min) {

    /* The union of an empty rect and the provided rect should be that provided
     * rect. Considering the garbage coordinates that may be present in an
     * empty rect can otherwise produce incorrect results. */
    if (guac_rect_is_empty(rect)) {
        *rect = *min;
        return;
    }

    /* Extend edges of rectangle such that it contains the provided minimum
     * rectangle */
    if (min->left   < rect->left)   rect->left   = min->left;
    if (min->top    < rect->top)    rect->top    = min->top;
    if (min->right  > rect->right)  rect->right  = min->right;
    if (min->bottom > rect->bottom) rect->bottom = min->bottom;

}

void guac_rect_constrain(guac_rect* rect, const guac_rect* max) {

    /* Shrink edges of rectangle such that it is contained by the provided
     * maximum rectangle */
    if (max->left   > rect->left)   rect->left   = max->left;
    if (max->top    > rect->top)    rect->top    = max->top;
    if (max->right  < rect->right)  rect->right  = max->right;
    if (max->bottom < rect->bottom) rect->bottom = max->bottom;

}

void guac_rect_shrink(guac_rect* rect, int max_width, int max_height) {

    int original_width = guac_rect_width(rect);
    int original_height = guac_rect_height(rect);

    /* Shrink only; do not _expand_ to reach the max width/height */
    if (original_width < max_width) max_width = original_width;
    if (original_height < max_height) max_height = original_height;

    /* BOTH the width and height must be adjusted by the same factor in
     * order to preserve aspect ratio. Choosing the smallest adjustment
     * factor guarantees that the rectangle will be within bounds while
     * preserving aspect ratio to the greatest degree possible (there
     * is unavoidable integer rounding error). */

    int scale_numerator, scale_denominator;

    /* NOTE: The following test is mathematically equivalent to:
     *
     *     if (max_width / original_width < max_height / original_height) {
     *        ...
     *     }
     *
     * but does not require floating point arithmetic. */
    if (max_width * original_height < max_height * original_width) {
        scale_numerator = max_width;
        scale_denominator = original_width;
    }
    else {
        scale_numerator = max_height;
        scale_denominator = original_height;
    }

    rect->right = rect->left + original_width * scale_numerator / scale_denominator;
    rect->bottom = rect->top + original_height * scale_numerator / scale_denominator;

}


void guac_rect_align(guac_rect* rect, unsigned int bits) {

    if (bits == 0)
        return;

    int factor = 1 << bits;
    int mask = factor - 1;

    /* Expand and shift rectangle as necessary for its edges to be aligned
     * along multiples of the given power of two */
    rect->left   = GUAC_RECT_ROUND_NEG(rect->left,   mask);
    rect->top    = GUAC_RECT_ROUND_NEG(rect->top,    mask);
    rect->right  = GUAC_RECT_ROUND_POS(rect->right,  mask);
    rect->bottom = GUAC_RECT_ROUND_POS(rect->bottom, mask);

}

int guac_rect_intersects(const guac_rect* a, const guac_rect* b) {

    /* Two rectangles intersect if neither rectangle is wholly outside the
     * other */
    return !(
            b->right  <= a->left || a->right  <= b->left
         || b->bottom <= a->top  || a->bottom <= b->top
    );

}

int guac_rect_is_empty(const guac_rect* rect) {
    return rect->right <= rect->left || rect->bottom <= rect->top;
}

int guac_rect_width(const guac_rect* rect) {
    int width = rect->right - rect->left;
    return width > 0 ? width : 0;
}

int guac_rect_height(const guac_rect* rect) {
    int height = rect->bottom - rect->top;
    return height > 0 ? height : 0;
}
