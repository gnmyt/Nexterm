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

#include "display-plan.h"
#include "display-priv.h"
#include "guacamole/display.h"
#include "guacamole/mem.h"
#include "guacamole/rect.h"

#include <string.h>
#include <stdint.h>

/**
 * Rounds the given value down to the nearest power of two.
 *
 * @param value
 *     The value to round.
 *
 * @return
 *     The power of two that is closest to the given value without exceeding
 *     that value.
 */
static size_t guac_display_plan_round_pot(size_t value) {

    if (value <= 2)
        return value;

    size_t rounded = 1;
    while (value >>= 1)
        rounded <<= 1;

    return rounded;

}

/**
 * Returns whether the given buffer consists entirely of the same 32-bit
 * quantity (ie: a single ARGB pixel), repeated throughout the buffer.
 *
 * This function attempts to perform a fast comparison leveraging memcmp() to
 * reduce the search space, rather than simply looping through each pixel one
 * at a time. Basic benchmarks show this approach to be roughly twice as fast
 * as a simple loop for arbitrary buffer lengths and four times as fast for
 * buffer lengths that are powers of two.
 *
 * @param buffer
 *     The buffer to check.
 *
 * @param length
 *     The number of bytes in the buffer.
 *
 * @param color
 *     A pointer to a uint32_t to receive the value of the 32-bit quantity that
 *     is repeated, if applicable.
 *
 * @return
 *     Non-zero if the same 32-bit quantity is repeated throughout the buffer,
 *     zero otherwise. If the same value is indeed repeated throughout the
 *     buffer, that value is stored in the variable pointed to by the "color"
 *     pointer. If the value is not repeated, the variable pointed to by the
 *     "color" pointer is left untouched.
 */
static int guac_display_plan_is_single_color(const unsigned char* restrict buffer,
        size_t length, uint32_t* restrict color) {

    /* It is vacuously true that all the 32-bit quantities in an empty buffer
     * are the same */
    if (length == 0) {
        *color = 0x00000000;
        return 1;
    }

    /* A single 32-bit value is the same as itself */
    if (length == 4) {
        *color = ((const uint32_t*) buffer)[0];
        return 1;
    }

    /* Simply directly compare if there are only two values */
    if (length == 8) {
        uint32_t a = ((const uint32_t*) buffer)[0];
        uint32_t b = ((const uint32_t*) buffer)[1];
        if (a == b) {
            *color = a;
            return 1;
        }
    }

    /* For all other lengths, avoid comparing if finding a match is impossible.
     * A buffer can consist entirely of the same 32-bit (4-byte) quantity
     * repeated throughout the buffer only if that buffer's length is a
     * multiple of 4. */
    if ((length % 4) != 0)
        return 0;

    /* A buffer consists entirely of the same 32-bit quantity repeated
     * throughout if (1) the two halves of the buffer are the same and (2) one
     * of those halves is known to consist entirely of the same 32-bit quantity
     * repeated throughout. */

    size_t pot_length = guac_display_plan_round_pot(guac_mem_ckd_sub_or_die(length, 1));
    size_t remaining_length = guac_mem_ckd_sub_or_die(length, pot_length);

    /* Easiest recursive case: the buffer is already a power of two and can be
     * split into two very easy-to-compare halves */
    if (pot_length == remaining_length) {
        return !memcmp(buffer, buffer + pot_length, pot_length)
            && guac_display_plan_is_single_color(buffer, pot_length, color);
    }

    /* For buffers that can't be split into two power-of-two halves, decide
     * based on one easy power-of-two case and one not-so-easy case of whatever
     * remains */
    uint32_t color_a = 0, color_b = 0;
    if (guac_display_plan_is_single_color(buffer, pot_length, &color_a)
        && guac_display_plan_is_single_color(buffer + pot_length, remaining_length, &color_b)
        && color_a == color_b) {

        *color = color_a;
        return 1;

    }

    return 0;

}

/**
 * Returns whether the given rectangle within given buffer consists entirely of
 * the same 32-bit quantity (ie: a single ARGB pixel), repeated throughout the
 * rectangular region.
 *
 * This function attempts to perform a fast comparison leveraging memcmp() to
 * reduce the search space, rather than simply looping through each pixel one
 * at a time. Basic benchmarks show this approach to be roughly twice as fast
 * as a simple loop for arbitrary buffer lengths and four times as fast for
 * buffer lengths that are powers of two.
 *
 * @param buffer
 *     The buffer to check.
 *
 * @param stride
 *     The number of bytes in each row of image data within the buffer.
 *
 * @param rect
 *     The rectangle representing the region to be checked within the buffer.
 *
 * @param color
 *     A pointer to a uint32_t to receive the value of the 32-bit quantity that
 *     is repeated, if applicable.
 *
 * @return
 *     Non-zero if the same 32-bit quantity is repeated throughout the
 *     rectangular region, zero otherwise. If the same value is indeed repeated
 *     throughout the rectangle, that value is stored in the variable pointed
 *     to by the "color" pointer. If the value is not repeated, the variable
 *     pointed to by the "color" pointer is left untouched.
 */
static int guac_display_plan_is_rect_single_color(const unsigned char* restrict buffer,
        size_t stride, const guac_rect* restrict rect, uint32_t* restrict color) {

    size_t row_length = guac_mem_ckd_mul_or_die(guac_rect_width(rect), GUAC_DISPLAY_LAYER_RAW_BPP);
    buffer = GUAC_RECT_CONST_BUFFER(*rect, buffer, stride, GUAC_DISPLAY_LAYER_RAW_BPP);

    /* Verify that the first row consists of a single color */
    uint32_t first_color = 0x00000000;
    if (!guac_display_plan_is_single_color(buffer, row_length, &first_color))
        return 0;

    /* The whole rectangle consists of a single color if each row is identical
     * and it's already known that one of those rows consists of the a single
     * color */
    const unsigned char* previous = buffer;
    for (int y = rect->top + 1; y < rect->bottom; y++) {

        const unsigned char* current = previous + stride;
        if (memcmp(previous, current, row_length))
            return 0;

        previous = current;

    }

    *color = first_color;
    return 1;

}

void PFR_guac_display_plan_rewrite_as_rects(guac_display_plan* plan) {

    uint32_t color = 0x00000000;

    guac_display_plan_operation* op = plan->ops;
    for (int i = 0; i < plan->length; i++) {

        if (op->type == GUAC_DISPLAY_PLAN_OPERATION_IMG) {

            guac_display_layer* layer = op->layer;
            size_t stride = layer->pending_frame.buffer_stride;
            const unsigned char* buffer = layer->pending_frame.buffer;

            /* NOTE: Processing of operations referring to layers whose buffers
             * have been replaced with NULL is intentionally allowed to ensure
             * references to external buffers can be safely removed if
             * necessary, even before guac_display is freed */

            if (buffer != NULL && guac_display_plan_is_rect_single_color(buffer, stride, &op->dest, &color)) {

                /* Ignore alpha channel for opaque layers */
                if (layer->opaque)
                    color |= 0xFF000000;

                op->type = GUAC_DISPLAY_PLAN_OPERATION_RECT;
                op->src.color = color;

            }

        }

        op++;

    }

}
