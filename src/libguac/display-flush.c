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
#include "guacamole/assert.h"
#include "guacamole/client.h"
#include "guacamole/display.h"
#include "guacamole/fifo.h"
#include "guacamole/flag.h"
#include "guacamole/mem.h"
#include "guacamole/protocol.h"
#include "guacamole/rect.h"
#include "guacamole/rwlock.h"
#include "guacamole/user.h"

#include <string.h>

/**
 * Begins a section related to an optimization phase that should be tracked for
 * performance at the "trace" log level.
 */
#define GUAC_DISPLAY_PLAN_BEGIN_PHASE()                                       \
    do {                                                                      \
        guac_timestamp phase_start = guac_timestamp_current();

/**
 * Ends a section related to an optimization phase that should be tracked for
 * performance at the "trace" log level.
 *
 * @param display
 *     The guac_display related to the optimizations being performed.
 *
 * @param phase
 *     A human-readable name for the optimization phase being tracked.
 *
 * @param n
 *     The ordinal number of this phase relative to other phases, where the
 *     first phase is phase 1.
 *
 * @param total
 *     The total number of optimization phases.
 */
#define GUAC_DISPLAY_PLAN_END_PHASE(display, phase, n, total)                 \
        guac_timestamp phase_end = guac_timestamp_current();                  \
        guac_client_log(display->client, GUAC_LOG_TRACE, "Render planning "   \
                "phase %i/%i (%s): %ims", n, total, phase,                    \
                (int) (phase_end - phase_start));                             \
    } while (0)

void guac_display_end_frame(guac_display* display) {
    guac_display_end_multiple_frames(display, 0);
}

/**
 * Callback for guac_client_foreach_user() which sends the current cursor
 * position and button state to any given user except the user that moved the
 * cursor last.
 *
 * @param data
 *     A pointer to the guac_display whose cursor state should be broadcast to
 *     all users except the user that moved the cursor last.
 *
 * @return
 *     Always NULL.
 */
static void* LFR_guac_display_broadcast_cursor_state(guac_user* user, void* data) {

    guac_display* display = (guac_display*) data;

    /* Send cursor state only if the user is not moving the cursor */
    if (user != display->last_frame.cursor_user) {
        guac_protocol_send_mouse(user->socket,
                display->last_frame.cursor_x, display->last_frame.cursor_y,
                display->last_frame.cursor_mask, display->last_frame.timestamp);
        guac_socket_flush(user->socket);
    }

    return NULL;

}

/**
 * Finalizes the current pending frame, storing that state as the copy of the
 * last frame. All layer properties that have changed since the last frame will
 * be sent out to connected clients.
 *
 * @param display
 *     The display whose pending frame should be finalized and persisted as the
 *     last frame.
 *
 * @return
 *     Non-zero if any layers within the pending frame had any changes
 *     whatsoever that needed to be sent as part of the frame, zero otherwise.
 */
static int PFW_LFW_guac_display_frame_complete(guac_display* display) {

    guac_client* client = display->client;
    int retval = 0;

    display->last_frame.layers = display->pending_frame.layers;
    guac_display_layer* current = display->pending_frame.layers;
    while (current != NULL) {

        /* Skip processing any layers whose buffers have been replaced with
         * NULL (this is intentionally allowed to ensure references to external
         * buffers can be safely removed if necessary, even before guac_display
         * is freed) */
        if (current->pending_frame.buffer == NULL) {
            GUAC_ASSERT(current->pending_frame.buffer_is_external);
            continue;
        }

        /* Always resize the last_frame buffer to match the pending_frame prior
         * to copying over any changes (this is particularly important given
         * that the pending_frame buffer can be replaced with an external
         * buffer). Since this involves copying over all data from the
         * pending frame, we can skip the later pending frame copy based on
         * whether the pending frame is dirty. */
        if (current->last_frame.buffer_stride != current->pending_frame.buffer_stride
                || current->last_frame.buffer_width != current->pending_frame.buffer_width
                || current->last_frame.buffer_height != current->pending_frame.buffer_height) {

            size_t buffer_size = guac_mem_ckd_mul_or_die(current->pending_frame.buffer_height,
                    current->pending_frame.buffer_stride);

            guac_mem_free(current->last_frame.buffer);
            current->last_frame.buffer = guac_mem_zalloc(buffer_size);
            memcpy(current->last_frame.buffer, current->pending_frame.buffer, buffer_size);

            current->last_frame.buffer_stride = current->pending_frame.buffer_stride;
            current->last_frame.buffer_width = current->pending_frame.buffer_width;
            current->last_frame.buffer_height = current->pending_frame.buffer_height;

            current->last_frame.dirty = current->pending_frame.dirty;
            current->pending_frame.dirty = (guac_rect) { 0 };

            retval = 1;

        }

        /* Copy over pending frame contents if actually changed (this is not
         * necessary if the last_frame buffer was resized to match
         * pending_frame, as a copy from pending_frame to last_frame is
         * inherently part of that) */
        else if (!guac_rect_is_empty(&current->pending_frame.dirty)) {

            unsigned char* pending_frame = current->pending_frame.buffer;
            unsigned char* last_frame = current->last_frame.buffer;
            size_t row_length = guac_mem_ckd_mul_or_die(current->pending_frame.width, 4);

            for (int y = 0; y < current->pending_frame.height; y++) {
                memcpy(last_frame, pending_frame, row_length);
                last_frame += current->last_frame.buffer_stride;
                pending_frame += current->pending_frame.buffer_stride;
            }

            current->last_frame.dirty = current->pending_frame.dirty;
            current->pending_frame.dirty = (guac_rect) { 0 };

            retval = 1;

        }

        /* Even if nothing has changed in the pending frame, we have to at
         * least flush that fact to the last frame (otherwise, the last frame
         * may contain stale dirty rects) */
        else
            current->last_frame.dirty = (guac_rect) { 0 };

        /* Commit any change in layer size */
        if (current->pending_frame.width != current->last_frame.width
                || current->pending_frame.height != current->last_frame.height) {

            guac_protocol_send_size(client->socket, current->layer,
                    current->pending_frame.width, current->pending_frame.height);

            current->last_frame.width = current->pending_frame.width;
            current->last_frame.height = current->pending_frame.height;

            retval = 1;

        }

        /* Commit any change in layer opacity */
        if (current->pending_frame.opacity != current->last_frame.opacity) {

            guac_protocol_send_shade(client->socket, current->layer,
                    current->pending_frame.opacity);

            current->last_frame.opacity = current->pending_frame.opacity;

            retval = 1;

        }

        /* Commit any change in layer location/hierarchy */
        if (current->pending_frame.x != current->last_frame.x
                || current->pending_frame.y != current->last_frame.y
                || current->pending_frame.z != current->last_frame.z
                || current->pending_frame.parent != current->last_frame.parent) {

            guac_protocol_send_move(client->socket, current->layer,
                    current->pending_frame.parent,
                    current->pending_frame.x,
                    current->pending_frame.y,
                    current->pending_frame.z);

            current->last_frame.x = current->pending_frame.x;
            current->last_frame.y = current->pending_frame.y;
            current->last_frame.z = current->pending_frame.z;
            current->last_frame.parent = current->pending_frame.parent;

            retval = 1;

        }

        /* Commit any change in layer multitouch support */
        if (current->pending_frame.touches != current->last_frame.touches) {
            guac_protocol_send_set_int(client->socket, current->layer,
                    GUAC_PROTOCOL_LAYER_PARAMETER_MULTI_TOUCH,
                    current->pending_frame.touches);
            current->last_frame.touches = current->pending_frame.touches;
        }

        /* Commit any hinting regarding scroll/copy optimization (NOTE: While
         * this value is copied for consistency, it will already have taken
         * effect in the context of the pending frame due to the scroll/copy
         * optimization pass having occurred prior to the call to this
         * function) */
        current->last_frame.search_for_copies = current->pending_frame.search_for_copies;
        current->pending_frame.search_for_copies = 0;

        /* Commit any change in lossless setting (no need to synchronize this
         * to the client - it affects only how last_frame is interpreted) */
        current->last_frame.lossless = current->pending_frame.lossless;

        /* Duplicate layers from pending frame to last frame */
        current->last_frame.prev = current->pending_frame.prev;
        current->last_frame.next = current->pending_frame.next;
        current = current->pending_frame.next;

    }

    display->last_frame.timestamp = display->pending_frame.timestamp;
    display->last_frame.frames = display->pending_frame.frames;

    display->pending_frame.frames = 0;
    display->pending_frame_dirty_excluding_mouse = 0;

    /* Commit cursor hotspot */
    display->last_frame.cursor_hotspot_x = display->pending_frame.cursor_hotspot_x;
    display->last_frame.cursor_hotspot_y = display->pending_frame.cursor_hotspot_y;

    /* Commit mouse cursor location and notify all other users of change in
     * cursor state */
    if (display->pending_frame.cursor_x != display->last_frame.cursor_x
            || display->pending_frame.cursor_y != display->last_frame.cursor_y
            || display->pending_frame.cursor_mask != display->last_frame.cursor_mask) {

        display->last_frame.cursor_user = display->pending_frame.cursor_user;
        display->last_frame.cursor_x = display->pending_frame.cursor_x;
        display->last_frame.cursor_y = display->pending_frame.cursor_y;
        display->last_frame.cursor_mask = display->pending_frame.cursor_mask;
        guac_client_foreach_user(client, LFR_guac_display_broadcast_cursor_state, display);

        /* NOTE: We DO NOT set retval here, as flushing a frame due purely to
         * mouse position changes can cause slowdowns apparently from the sheer
         * quantity of frames */

    }

    return retval;

}

void guac_display_end_mouse_frame(guac_display* display) {

    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    if (!display->pending_frame_dirty_excluding_mouse)
        guac_display_end_multiple_frames(display, 0);

    guac_rwlock_release_lock(&display->pending_frame.lock);

}

void guac_display_end_multiple_frames(guac_display* display, int frames) {

    guac_display_plan* plan = NULL;

    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);
    display->pending_frame.frames += frames;

    /* Defer rendering of further frames until after any in-progress frame has
     * finished. Graphical changes will meanwhile continue being accumulated in
     * the pending frame. */

    guac_fifo_lock(&display->ops);
    int defer_frame = display->frame_deferred =
        (display->ops.state.value & GUAC_FIFO_STATE_NONEMPTY) || display->active_workers;
    guac_fifo_unlock(&display->ops);

    if (defer_frame)
        goto finished_with_pending_frame_lock;

    guac_rwlock_acquire_write_lock(&display->last_frame.lock);

    /* PASS 0: Create naive plan, identify minimal dirty rects by comparing the
     * changes between the pending and last frames.
     *
     * This plan will contain operations covering only the minimal parts of the
     * display that have changed, but is naive in the sense that it only
     * produces draw operations covering 64x64 cells. There is room for
     * optimization of those operations, which will be performed by further
     * passes. */
    GUAC_DISPLAY_PLAN_BEGIN_PHASE();
    plan = PFW_LFR_guac_display_plan_create(display);
    GUAC_DISPLAY_PLAN_END_PHASE(display, "draft", 1, 5);

    if (plan != NULL) {

        display->pending_frame.timestamp = plan->frame_end;

        /* PASS 1: Identify draw operations that only apply a single color, and
         * replace those operations with simple rectangle draws. */
        GUAC_DISPLAY_PLAN_BEGIN_PHASE();
        PFR_guac_display_plan_rewrite_as_rects(plan);
        GUAC_DISPLAY_PLAN_END_PHASE(display, "rects", 2, 5);

        /* PASS 2 (and 3): Index all modified cells by their graphical contents and
         * search the previous frame for occurrences of the same content. Where any
         * draws could instead be represented as copies from the previous frame, do
         * so instead of sending new image data. */
        GUAC_DISPLAY_PLAN_BEGIN_PHASE();
        PFR_guac_display_plan_index_dirty_cells(plan);
        PFR_LFR_guac_display_plan_rewrite_as_copies(plan);
        GUAC_DISPLAY_PLAN_END_PHASE(display, "search", 3, 5);

        /* PASS 4 (and 5): Combine adjacent updates in horizontal and vertical
         * directions where doing so would be more efficient. The goal of these
         * passes is to ensure that graphics can be encoded and decoded
         * efficiently, without defeating the parralelism provided by providing the
         * worker threads with many smaller operations. */
        GUAC_DISPLAY_PLAN_BEGIN_PHASE();
        PFW_guac_display_plan_combine_horizontally(plan);
        PFW_guac_display_plan_combine_vertically(plan);
        GUAC_DISPLAY_PLAN_END_PHASE(display, "combine", 4, 5);

    }

    /*
     * With all optimizations now performed, finalize the pending frame. This
     * sets the worker threads in motion and frees up the pending frame
     * surfaces for writing. Drawing to the next pending frame can now occur
     * without disturbing the encoding performed by the worker threads.
     */

    int frame_nonempty;

    GUAC_DISPLAY_PLAN_BEGIN_PHASE();
    frame_nonempty = PFW_LFW_guac_display_frame_complete(display);
    GUAC_DISPLAY_PLAN_END_PHASE(display, "commit", 5, 5);

    guac_rwlock_release_lock(&display->last_frame.lock);

    /* Awaken worker threads to perform the rest of the tasks required for the
     * frame (if any such tasks remain) */
    if (plan != NULL) {
        guac_display_plan_apply(plan);
        guac_display_plan_free(plan);
    }

    /* Not all frames are graphical, and not all frames result in operations
     * reaching the worker threads. If we end up with a frame containing
     * nothing but layer property changes or nothing but non-image updates,
     * then we must still send at least one operation to awaken the workers,
     * flush any layer changes, and mark the end of the frame with a "sync",
     * even though there is no display plan to optimize.  */
    if (frame_nonempty) {
        guac_display_plan_operation end_frame_op = {
            .type = GUAC_DISPLAY_PLAN_OPERATION_NOP
        };
        guac_fifo_enqueue(&display->ops, &end_frame_op);
    }

finished_with_pending_frame_lock:
    guac_rwlock_release_lock(&display->pending_frame.lock);

}
