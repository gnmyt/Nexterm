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
#include "guacamole/rect.h"

/**
 * Returns whether the given rectangle crosses the boundaries of any two
 * adjacent cells in a grid, where each cell in the grid is
 * 2^GUAC_DISPLAY_MAX_COMBINED_SIZE pixels on each side.
 *
 * This function exists because combination of adjacent image updates is
 * intentionally limited to a certain size in order to favor parallelism.
 * Greedily combining in the horizontal direction works, but in practice tends
 * to produce a vertical series of strips that are offset from each other to
 * the point that they cannot be further combined. Anchoring combined image
 * updates to a grid helps prevent ths.
 *
 * @param rect
 *     The rectangle to test.
 *
 * @return
 *     Non-zero if the rectangle crosses the boundary of any adjacent pair of
 *     cells in a grid, where each cell is 2^GUAC_DISPLAY_MAX_COMBINED_SIZE
 *     pixels on each side, zero otherwise.
 */
static int guac_display_plan_rect_crosses_boundary(const guac_rect* rect) {

    /* A particular rectangle crosses a grid boundary if and only if expanding
     * that rectangle to fit the grid would mean increasing the size of that
     * rectangle beyond a single grid cell */

    guac_rect rect_copy = *rect;
    guac_rect_align(&rect_copy, GUAC_DISPLAY_MAX_COMBINED_SIZE);

    const int max_size_pixels = 1 << GUAC_DISPLAY_MAX_COMBINED_SIZE;
    return guac_rect_width(&rect_copy) > max_size_pixels
        || guac_rect_height(&rect_copy) > max_size_pixels;

}

/**
 * Returns whether the two rectangles are adjacent and share exactly one common
 * edge.
 *
 * @param op_a
 *     One of the rectangles to compare.
 *
 * @param op_b
 *     The rectangle to compare op_a with.
 *
 * @return
 *     Non-zero if the rectangles are adjacent and share exactly one common
 *     edge, zero otherwise.
 */
static int guac_display_plan_has_common_edge(const guac_display_plan_operation* op_a,
        const guac_display_plan_operation* op_b) {

    /* Two operations share a common edge if they are perfectly aligned
     * vertically and have the same left/right or right/left edge */
    if (op_a->dest.top == op_b->dest.top
            && op_a->dest.bottom == op_b->dest.bottom) {

        return op_a->dest.right == op_b->dest.left
            || op_a->dest.left == op_b->dest.right;

    }

    /* Two operations share a common edge if they are perfectly aligned
     * horizontally and have the same top/bottom or bottom/top edge */
    else if (op_a->dest.left == op_b->dest.left
            && op_a->dest.right == op_b->dest.right) {

        return op_a->dest.top == op_b->dest.bottom
            || op_a->dest.bottom == op_b->dest.top;

    }

    /* There are no other cases where two operations share a common edge */
    return 0;

}

/**
 * Returns whether the given pair of operations should be combined into a
 * single operation.
 *
 * @param op_a
 *     The first operation to check.
 *
 * @param op_b
 *     The second operation to check.
 *
 * @return
 *     Non-zero if the operations would be better represented as a single,
 *     combined operation, zero otherwise.
 */
static int guac_display_plan_should_combine(const guac_display_plan_operation* op_a,
        const guac_display_plan_operation* op_b) {

    /* Operations can only be combined within the same layer */
    if (op_a->layer != op_b->layer)
        return 0;

    /* Simulate combination */
    guac_rect combined = op_a->dest;
    guac_rect_extend(&combined, &op_b->dest);

    /* Operations of the same type can be trivially unified under specific
     * circumstances */
    if (op_a->type == op_b->type) {
        switch (op_a->type) {

            /* Copy operations can be combined if they are perfectly adjacent
             * (exactly share an edge) and copy from the same source layer in
             * the same direction */
            case GUAC_DISPLAY_PLAN_OPERATION_COPY:
                if (op_a->src.layer_rect.layer == op_b->src.layer_rect.layer
                        && guac_display_plan_has_common_edge(op_a, op_b)) {

                    int delta_xa = op_a->dest.left - op_a->src.layer_rect.rect.left;
                    int delta_ya = op_a->dest.top  - op_a->src.layer_rect.rect.top;
                    int delta_xb = op_b->dest.left - op_b->src.layer_rect.rect.left;
                    int delta_yb = op_b->dest.top  - op_b->src.layer_rect.rect.top;

                    return delta_xa == delta_xb
                        && delta_ya == delta_yb
                        && !guac_display_plan_rect_crosses_boundary(&combined);

                }
                break;

            /* Rectangle-drawing operations can be combined if they are
             * perfectly adjacent (exactly share an edge) and draw the same
             * color */
            case GUAC_DISPLAY_PLAN_OPERATION_RECT:
                return op_a->src.color == op_b->src.color
                    && guac_display_plan_has_common_edge(op_a, op_b)
                    && !guac_display_plan_rect_crosses_boundary(&combined);

            /* Image-drawing operations can be combined if doing so wouldn't
             * exceed the size limits for images (we enforce size limits here
             * to promote parallelism) */
            case GUAC_DISPLAY_PLAN_OPERATION_IMG:
                return !guac_display_plan_rect_crosses_boundary(&combined);

            /* Other combinations require more complex logic... (see below) */
            default:
                break;

        }
    }

    /* Combine if result is still small */
    int combined_width = guac_rect_width(&combined);
    int combined_height = guac_rect_height(&combined);
    if (combined_width <= GUAC_DISPLAY_NEGLIGIBLE_WIDTH && combined_height <= GUAC_DISPLAY_NEGLIGIBLE_HEIGHT)
        return 1;

    /* Estimate costs of the existing update, new update, and both combined */
    int cost_ab = GUAC_DISPLAY_BASE_COST + combined_width * combined_height;
    int cost_a  = GUAC_DISPLAY_BASE_COST + op_a->dirty_size;
    int cost_b  = GUAC_DISPLAY_BASE_COST + op_b->dirty_size;

    /* Reduce cost if no image data */
    if (op_a->type != GUAC_DISPLAY_PLAN_OPERATION_IMG) cost_a /= GUAC_DISPLAY_DATA_FACTOR;
    if (op_b->type != GUAC_DISPLAY_PLAN_OPERATION_IMG) cost_b /= GUAC_DISPLAY_DATA_FACTOR;

    /* Combine if cost estimate shows benefit or the increase in cost is
     * negligible */
    if ((cost_ab <= cost_b + cost_a)
            || (cost_ab - cost_a <= cost_a / GUAC_DISPLAY_NEGLIGIBLE_INCREASE)
            || (cost_ab - cost_b <= cost_b / GUAC_DISPLAY_NEGLIGIBLE_INCREASE))
        return 1;

    /* Otherwise, do not combine */
    return 0;

}

/**
 * Combines the given pair of operations into a single operation if doing so is
 * advantageous (results in an operation of lesser or negligibly-worse cost).
 *
 * @param op_a
 *     The first of the pair of operations to be combined. If they operations
 *     are combined, the combined operation will be stored here.
 *
 * @param op_b
 *     The second of the pair of operations to be combined, which may
 *     potentially be identical to the first. If the operations are combined,
 *     this operation will be updated to be a GUAC_DISPLAY_PLAN_OPERATION_NOP
 *     operation.
 *
 * @return
 *     Non-zero if the operations were combined, zero otherwise.
 */
static int guac_display_plan_combine_if_improved(guac_display_plan_operation* op_a,
        guac_display_plan_operation* op_b) {

    if (op_a == op_b)
        return 0;

    /* Combine any adjacent operations that match the combination criteria
     * (combining produces a net lower cost) */
    if (guac_display_plan_should_combine(op_a, op_b)) {

        guac_rect_extend(&op_a->dest, &op_b->dest);

        /* Operations of different types can only be combined as images */
        if (op_a->type != op_b->type)
            op_a->type = GUAC_DISPLAY_PLAN_OPERATION_IMG;

        /* When combining two copy operations, additionally combine their
         * source rects (NOT just the destination rects) */
        else if (op_a->type == GUAC_DISPLAY_PLAN_OPERATION_COPY)
            guac_rect_extend(&op_a->src.layer_rect.rect, &op_b->src.layer_rect.rect);

        op_a->dirty_size += op_b->dirty_size;

        if (op_b->last_frame > op_a->last_frame)
            op_a->last_frame = op_b->last_frame;

        op_b->type = GUAC_DISPLAY_PLAN_OPERATION_NOP;

        return 1;

    }

    return 0;

}

void PFW_guac_display_plan_combine_horizontally(guac_display_plan* plan) {

    guac_display* display = plan->display;
    guac_display_layer* current = display->pending_frame.layers;
    while (current != NULL) {

        /* Process only layers that have been modified */
        if (!guac_rect_is_empty(&current->pending_frame.dirty)) {

            /* Loop through all cells in left-to-right, top-to-bottom order,
             * combining any operations that are combinable and horizontally
             * adjacent. */

            guac_display_layer_cell* cell = current->pending_frame_cells;
            for (int y = 0; y < current->pending_frame_cells_height; y++) {

                guac_display_layer_cell* previous = cell++;
                for (int x = 1; x < current->pending_frame_cells_width; x++) {

                    /* Combine adjacent updates if doing so is advantageous */
                    if (previous->related_op != NULL && cell->related_op != NULL
                            && guac_display_plan_combine_if_improved(previous->related_op, cell->related_op)) {
                        cell->related_op = previous->related_op;
                    }

                    previous++;
                    cell++;

                }
            }

        }

        current = current->pending_frame.next;

    }

}

void PFW_guac_display_plan_combine_vertically(guac_display_plan* plan) {

    guac_display* display = plan->display;
    guac_display_layer* current = display->pending_frame.layers;
    while (current != NULL) {

        /* Process only layers that have been modified */
        if (!guac_rect_is_empty(&current->pending_frame.dirty)) {

            /* Loop through all cells in top-to-bottom, left-to-right order,
             * combining any operations that are combinable and horizontally
             * adjacent. */

            guac_display_layer_cell* cell_col = current->pending_frame_cells;
            for (int x = 0; x < current->pending_frame_cells_width; x++) {

                guac_display_layer_cell* previous = cell_col;
                guac_display_layer_cell* cell = cell_col + current->pending_frame_cells_width;

                for (int y = 1; y < current->pending_frame_cells_height; y++) {

                    /* Combine adjacent updates if doing so is advantageous */
                    if (previous->related_op != NULL && cell->related_op != NULL
                            && guac_display_plan_has_common_edge(previous->related_op, cell->related_op)
                            && guac_display_plan_combine_if_improved(previous->related_op, cell->related_op)) {
                        cell->related_op = previous->related_op;
                    }

                    previous += current->pending_frame_cells_width;
                    cell += current->pending_frame_cells_width;

                }

                cell_col++;

            }

        }

        current = current->pending_frame.next;

    }

}
