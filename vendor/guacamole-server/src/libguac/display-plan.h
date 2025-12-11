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

#ifndef GUAC_DISPLAY_PLAN_H
#define GUAC_DISPLAY_PLAN_H

#include "guacamole/display.h"
#include "guacamole/rect.h"
#include "guacamole/timestamp.h"

#include <stdint.h>
#include <unistd.h>

/**
 * The width of an update which should be considered negible and thus
 * trivial overhead compared to the cost of two updates.
 */
#define GUAC_DISPLAY_NEGLIGIBLE_WIDTH 64

/**
 * The height of an update which should be considered negible and thus
 * trivial overhead compared to the cost of two updates.
 */
#define GUAC_DISPLAY_NEGLIGIBLE_HEIGHT 64

/**
 * The proportional increase in cost contributed by transfer and processing of
 * image data, compared to processing an equivalent amount of client-side
 * data.
 */
#define GUAC_DISPLAY_DATA_FACTOR 128

/**
 * The maximum width or height to allow when combining any pair of rendering
 * operations into a single operation, in pixels, as the exponent of a power of
 * two. This value is intended to be large enough to avoid unnecessarily
 * increasing the number of drawing operations, yet also small enough to allow
 * larger updates to be easily parallelized via the worker threads.
 *
 * The current value of 9 means that each encoded image will be no larger than
 * 512x512 pixels.
 */
#define GUAC_DISPLAY_MAX_COMBINED_SIZE 9

/**
 * The base cost of every update. Each update should be considered to have
 * this starting cost, plus any additional cost estimated from its
 * content.
 */
#define GUAC_DISPLAY_BASE_COST 4096

/**
 * An increase in cost is negligible if it is less than
 * 1/GUAC_DISPLAY_NEGLIGIBLE_INCREASE of the old cost.
 */
#define GUAC_DISPLAY_NEGLIGIBLE_INCREASE 4

/**
 * The framerate which, if exceeded, indicates that JPEG is preferred.
 */
#define GUAC_DISPLAY_JPEG_FRAMERATE 3

/**
 * Minimum JPEG bitmap size (area). If the bitmap is smaller than this threshold,
 * it should be compressed as a PNG image to avoid the JPEG compression tax.
 */
#define GUAC_DISPLAY_JPEG_MIN_BITMAP_SIZE 4096

/**
 * The JPEG compression min block size, as the exponent of a power of two. This
 * defines the optimal rectangle block size factor for JPEG compression.
 * Usually 8x8 would suffice, but we use 16x16 here to reduce the occurrence of
 * ringing artifacts further.
 */
#define GUAC_SURFACE_JPEG_BLOCK_SIZE 4

/**
 * The WebP compression min block size, as the exponent of a power of two. This
 * defines the optimal rectangle block size factor for WebP compression. WebP
 * does utilize variable block size, but ensuring a block size factor reduces
 * any noise on the image edges.
 */
#define GUAC_SURFACE_WEBP_BLOCK_SIZE 3

/**
 * The number of hash buckets within each guac_display_plan.
 */
#define GUAC_DISPLAY_PLAN_OPERATION_INDEX_SIZE 0x10000

/**
 * Hash function which hashes a larger, 64-bit hash into a 16-bit hash that
 * will fit within GUAC_DISPLAY_PLAN_OPERATION_INDEX_SIZE. Note that the random
 * distribution of this hash relies entirely on the random distribution of the
 * value being hashed.
 */
#define GUAC_DISPLAY_PLAN_OPERATION_HASH(hash) (\
          ( hash        & 0xFFFF)               \
        ^ ((hash >> 16) & 0xFFFF)               \
        ^ ((hash >> 32) & 0xFFFF)               \
        ^ ((hash >> 48) & 0xFFFF)               \
        )

/**
 * The type of a graphical operation that may be part of a guac_display_plan.
 */
typedef enum guac_display_plan_operation_type {

    /**
     * Do nothing (no-op).
     */
    GUAC_DISPLAY_PLAN_OPERATION_NOP = 0,

    /**
     * Copy image data from the associated source rect to the destination rect.
     * The source and destination layers are not necessarily the same.
     */
    GUAC_DISPLAY_PLAN_OPERATION_COPY,

    /**
     * Fill a rectangular region of the destination layer with the source
     * color.
     */
    GUAC_DISPLAY_PLAN_OPERATION_RECT,

    /**
     * Draw arbitrary image data to the destination rect.
     */
    GUAC_DISPLAY_PLAN_OPERATION_IMG

} guac_display_plan_operation_type;

/**
 * A reference to a rectangular region of image data within a layer of the
 * remote Guacamole display.
 */
typedef struct guac_display_plan_layer_rect {

    /**
     * The rectangular region that should serve as source data for an
     * operation.
     */
    guac_rect rect;

    /**
     * The layer that the source data is coming from.
     */
    const guac_layer* layer;

} guac_display_plan_layer_rect;

/**
 * Any one of several operations that may be contained in a guac_display_plan.
 */
typedef struct guac_display_plan_operation {

    /**
     * The destination layer (recipient of graphical output/changes).
     */
    guac_display_layer* layer;

    /**
     * The operation being performed on the destination layer.
     */
    guac_display_plan_operation_type type;

    /**
     * The location within the destination layer that will receive these
     * changes.
     */
    guac_rect dest;

    /**
     * The approximate number of pixels that have actually changed as a result
     * of this operation. This value will not necessarily be the same as the
     * area of the destination rect if some pixels remain unchanged.
     */
    size_t dirty_size;

    /**
     * The timestamp of the last frame that made any change within the
     * destination rect of the destination layer.
     */
    guac_timestamp last_frame;

    /**
     * The timestamp of the change being made. This will be the timestamp of
     * the frame at the time the frame was ended, not the timestamp of the
     * server at the time this operation was added to the plan.
     */
    guac_timestamp current_frame;

    union {

        /**
         * The color that should be used to fill the destination rect. This
         * value applies only to GUAC_DISPLAY_PLAN_OPERATION_RECT operations.
         */
        uint32_t color;

        /**
         * The rectangle that should be copied to the destination rect. This
         * value applies only to GUAC_DISPLAY_PLAN_OPERATION_COPY operations.
         */
        guac_display_plan_layer_rect layer_rect;

    } src;

} guac_display_plan_operation;

/**
 * A guac_display_plan_operation that has been hashed and stored within a
 * guac_display_plan.
 */
typedef struct guac_display_plan_indexed_operation {

    /**
     * The operation.
     */
    guac_display_plan_operation* op;

    /**
     * The hash value associated with the operation. This hash value is derived
     * from the actual image contents of the region that was changed, using the
     * new contents of that region. The intent of this hash is to allow
     * operations to be quickly located based on the output they will produce,
     * such that image draw operations can be automatically replaced with
     * simple copies if they reuse data from elsewhere in a layer.
     */
    uint64_t hash;

} guac_display_plan_indexed_operation;

/**
 * The set of operations required to transform the display state from what each
 * user currently sees (the previous frame) to the current state of the
 * guac_display (the current frame). The operations within a plan are quickly
 * generated based on simple image comparisons, and are then refined by an
 * optimizer based on estimated costs.
 */
typedef struct guac_display_plan {

    /**
     * The display that this plan was created for.
     */
    guac_display* display;

    /**
     * The time that the frame ended.
     */
    guac_timestamp frame_end;

    /**
     * Array of all operations that should be applied, in order. The operations
     * in this array do not overlap nor depend on each other. They may be
     * safely reordered without any impact on the image that results from
     * applying those operations.
     */
    guac_display_plan_operation* ops;

    /**
     * The number of operations stored in the ops array.
     */
    size_t length;

    /**
     * Index of operations in the plan by their image contents. Only operations
     * that can be easily stored without collisions will be represented here.
     */
    guac_display_plan_indexed_operation ops_by_hash[GUAC_DISPLAY_PLAN_OPERATION_INDEX_SIZE];

} guac_display_plan;

/**
 * Creates a new guac_display_plan representing the changes necessary to
 * transform the current remote display state seen by each connected user (the
 * previous frame) to the current local display state represented by the
 * guac_display (the current frame). The actual operations within the plan are
 * chosen based on the result of passing the naive set of operations through an
 * optimizer.
 *
 * There are cases where no plan will be generated. If no changes have occurred
 * since the last frame, or if the last frame is still being encoded by the
 * guac_display, NULL is returned. In the event that NULL is returned but
 * changes have been made, those changes will eventually be automatically
 * picked up after the currently-pending frame has finished encoded.
 *
 * The returned guac_display_plan must eventually be manually freed by a call
 * to guac_display_plan_free().
 *
 * IMPORTANT: The calling thread must already hold the write lock for the
 * display's pending_frame.lock, and must at least hold the read lock for the
 * display's last_frame.lock.
 *
 * @param display
 *     The guac_display to create a plan for.
 *
 * @return
 *     A newly-allocated guac_display_plan representing the changes necessary
 *     to transform the current remote display state to that of the local
 *     guac_display, or NULL if no plan could be created. If non-NULL, this
 *     value must eventually be freed by a call to guac_display_plan_free().
 */
guac_display_plan* PFW_LFR_guac_display_plan_create(guac_display* display);

/**
 * Frees all memory associated with the given guac_display_plan.
 *
 * @param plan
 *     The plan to free.
 */
void guac_display_plan_free(guac_display_plan* plan);

/**
 * Walks through all operations currently in the given guac_display_plan,
 * replacing draw operations with simple rects wherever draws consist only of a
 * single color.
 *
 * @param plan
 *     The guac_display_plan to modify.
 */
void PFR_guac_display_plan_rewrite_as_rects(guac_display_plan* plan);

/**
 * Walks through all operations currently in the given guac_display_plan,
 * storing the hashes of each outstanding draw operation within ops_by_hash.
 * This function must be invoked before guac_display_plan_rewrite_as_copies()
 * can be used for the current pending frame.
 *
 * @param plan
 *     The guac_display_plan to index.
 */
void PFR_guac_display_plan_index_dirty_cells(guac_display_plan* plan);

/**
 * Walks through all operations currently in the given guac_display_plan,
 * replacing draw operations with simple copies wherever draws can be rewritten
 * as copies that pull image data from the previous frame. The display plan
 * must first be indexed by guac_display_plan_index_dirty_cells() before this
 * function can be used.
 *
 * @param plan
 *     The guac_display_plan to modify.
 */
void PFR_LFR_guac_display_plan_rewrite_as_copies(guac_display_plan* plan);

/**
 * Walks through all operations currently in the given guac_display_plan,
 * combining horizontally-adjacent operations wherever doing so appears to be
 * more efficient than performing those operations separately.
 *
 * @param plan
 *     The guac_display_plan to modify.
 */
void PFW_guac_display_plan_combine_horizontally(guac_display_plan* plan);

/**
 * Walks through all operations currently in the given guac_display_plan,
 * combining vertically-adjacent operations wherever doing so appears to be
 * more efficient than performing those operations separately.
 *
 * @param plan
 *     The guac_display_plan to modify.
 */
void PFW_guac_display_plan_combine_vertically(guac_display_plan* plan);

/**
 * Enqueues all operations from the given plan within the operation FIFO used
 * by the worker threads of the display associated with that plan. The
 * display's worker threads will immediately begin picking up and performing
 * these operations, with the final operation resulting in a frame boundary
 * ("sync" instruction) being sent to connected users.
 *
 * @param plan
 *     The guac_display_plan to apply.
 */
void guac_display_plan_apply(guac_display_plan* plan);

#endif
