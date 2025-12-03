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

#ifndef GUAC_RECT_H
#define GUAC_RECT_H

#include "mem.h"
#include "rect-types.h"

/**
 * Returns the memory address of the given rectangle within the given mutable
 * buffer, where the upper-left corner of the given buffer is (0, 0). If the
 * memory address cannot be calculated because doing so would overflow the
 * maximum value of a size_t, execution of the current process is automatically
 * aborted.
 *
 * IMPORTANT: No checks are performed on whether the rectangle extends beyond
 * the bounds of the buffer, including considering whether the left/top
 * position of the rectangle is negative. If the rectangle has not already been
 * contrained to be within the bounds of the buffer, such checks must be
 * performed before dereferencing the value returned by this macro.
 *
 * @param rect
 *     The rectangle to determine the offset of.
 *
 * @param buffer
 *     The mutable buffer within which the address of the given rectangle
 *     should be determined.
 *
 * @param stride
 *     The number of bytes in each row of image data within the buffer.
 *
 * @param bpp
 *     The number of bytes in each pixel of image data.
 *
 * @return
 *     The memory address of the given rectangle within the given buffer.
 */
#define GUAC_RECT_MUTABLE_BUFFER(rect, buffer, stride, bpp) ((void*) (        \
            ((unsigned char*) (buffer))                                       \
                + guac_mem_ckd_mul_or_die((rect).top, stride)                 \
                + guac_mem_ckd_mul_or_die((rect).left, bpp)))

/**
 * Returns the memory address of the given rectangle within the given immutable
 * (const) buffer, where the upper-left corner of the given buffer is (0, 0).
 * If the memory address cannot be calculated because doing so would overflow
 * the maximum value of a size_t, execution of the current process is
 * automatically aborted.
 *
 * IMPORTANT: No checks are performed on whether the rectangle extends beyond
 * the bounds of the buffer, including considering whether the left/top
 * position of the rectangle is negative. If the rectangle has not already been
 * contrained to be within the bounds of the buffer, such checks must be
 * performed before dereferencing the value returned by this macro.
 *
 * @param rect
 *     The rectangle to determine the offset of.
 *
 * @param buffer
 *     The const buffer within which the address of the given rectangle should
 *     be determined.
 *
 * @param stride
 *     The number of bytes in each row of image data within the buffer.
 *
 * @param bpp
 *     The number of bytes in each pixel of image data.
 *
 * @return
 *     The memory address of the given rectangle within the given buffer.
 */
#define GUAC_RECT_CONST_BUFFER(rect, buffer, stride, bpp) ((const void*) (    \
            ((const unsigned char*) (buffer))                                 \
                + guac_mem_ckd_mul_or_die((rect).top, stride)                 \
                + guac_mem_ckd_mul_or_die((rect).left, bpp)))

struct guac_rect {

    /**
     * The X coordinate of the upper-left corner of this rectangle (inclusive).
     * This value represents the least integer X coordinate that is part of
     * this rectangle, with greater integer X coordinates being part of this
     * rectangle up to but excluding the right boundary.
     *
     * This value MUST be less than or equal to the right boundary. If this
     * value is equal to the right boundary, the rectangle is empty (has no
     * width).
     */
    int left;

    /**
     * The Y coordinate of the upper-left corner of this rectangle (inclusive).
     * This value represents the least integer Y coordinate that is part of
     * this rectangle, with greater integer Y coordinates being part of this
     * rectangle up to but excluding the bottom boundary.
     *
     * This value MUST be less than or equal to the bottom boundary. If this
     * value is equal to the bottom boundary, the rectangle is empty (has no
     * height).
     */
    int top;

    /**
     * The X coordinate of the lower-right corner of this rectangle
     * (exclusive). This value represents the least integer X coordinate that
     * is NOT part of this rectangle, with lesser integer X coordinates being
     * part of this rectangle up to and including the left boundary.
     *
     * This value MUST be greater than or equal to the left boundary. If this
     * value is equal to the left boundary, the rectangle is empty (has no
     * width).
     */
    int right;

    /**
     * The Y coordinate of the lower-right corner of this rectangle
     * (exclusive). This value represents the least integer Y coordinate that
     * is NOT part of this rectangle, with lesser integer Y coordinates being
     * part of this rectangle up to and including the top boundary.
     *
     * This value MUST be greater than or equal to the top boundary. If this
     * value is equal to the top boundary, the rectangle is empty (has no
     * height).
     */
    int bottom;

};

/**
 * Initializes the given rectangle with the given coordinates and dimensions.
 * If a dimenion is negative, it is interpreted as if zero.
 *
 * @param rect
 *     The rectangle to initialize.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the rectangle.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the rectangle.
 *
 * @param width
 *     The width of the rectangle.
 *
 * @param height
 *     The height of the rectangle.
 */
void guac_rect_init(guac_rect* rect, int x, int y, int width, int height);

/**
 * Extends the given rectangle such that each edge of the rectangle falls on
 * the edge of an NxN cell in a regular grid anchored at the upper-left corner,
 * where N is a power of two.
 *
 * @param rect
 *     The rectangle to adjust.
 *
 * @param bits
 *     The size of the cells in the grid, as the exponent of the power of two
 *     size of each grid cell edge. For example, to align the given rectangle
 *     to the edges of a grid containing 8x8 cells, use a value of 3.
 */
void guac_rect_align(guac_rect* rect, unsigned int bits);

/**
 * Extends the given rectangle such that it contains at least the specified
 * minimum rectangle.
 *
 * @param rect
 *     The rectangle to extend.
 *
 * @param min
 *     The minimum area which must be contained within the given rectangle.
 */
void guac_rect_extend(guac_rect* rect, const guac_rect* min);

/**
 * Collapses the given rectangle such that it exists only within the bounds of
 * the given maximum rectangle.
 *
 * @param rect
 *     The rectangle to collapse.
 *
 * @param max
 *     The maximum area in which the given rectangle can exist.
 */
void guac_rect_constrain(guac_rect* rect, const guac_rect* max);

/**
 * Reduces the size of the given rectangle such that it does not exceed the
 * given width and height. The aspect ratio of the given rectangle is
 * preserved. If the original rectangle is already smaller than the given width
 * and height, this function has no effect.
 *
 * @param rect
 *     The rectangle to shrink while preserving aspect ratio.
 *
 * @param max_width
 *     The maximum width that the given rectangle may have.
 *
 * @param max_height
 *     The maximum height that the given rectangle may have.
 */
void guac_rect_shrink(guac_rect* rect, int max_width, int max_height);

/**
 * Returns whether the two given rectangles intersect.
 *
 * @param a
 *     One of the rectangles to check.
 *
 * @param b
 *     The other rectangle to check.
 *
 * @return
 *     Non-zero if the rectangles intersect, zero otherwise.
 */
int guac_rect_intersects(const guac_rect* a, const guac_rect* b);

/**
 * Returns whether the given rectangle is empty. A rectangle is empty if it has
 * no area (has an effective width or height of zero).
 *
 * @param rect
 *     The rectangle to test.
 *
 * @return
 *     Non-zero if the rectangle is empty, zero otherwise.
 */
int guac_rect_is_empty(const guac_rect* rect);

/**
 * Returns the width of the given rectangle.
 *
 * @param rect
 *     The rectangle to determine the width of.
 *
 * @return
 *     The width of the given rectangle.
 */
int guac_rect_width(const guac_rect* rect);

/**
 * Returns the height of the given rectangle.
 *
 * @param rect
 *     The rectangle to determine the height of.
 *
 * @return
 *     The height of the given rectangle.
 */
int guac_rect_height(const guac_rect* rect);

#endif
