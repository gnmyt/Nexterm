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
#include "display-plan.h"
#include "display-priv.h"
#include "guacamole/client.h"
#include "guacamole/display.h"
#include "guacamole/fifo.h"
#include "guacamole/layer.h"
#include "guacamole/mem.h"
#include "guacamole/protocol.h"
#include "guacamole/rect.h"
#include "guacamole/rwlock.h"
#include "guacamole/socket.h"
#include "guacamole/timestamp.h"
#include "guacamole/user.h"

#ifdef __MINGW32__
#include <winbase.h>
#endif

#include <cairo/cairo.h>
#include <pthread.h>
#include <sched.h>
#include <unistd.h>

/**
 * The number of worker threads to create per processor.
 */
#define GUAC_DISPLAY_CPU_THREAD_FACTOR 1

/**
 * Returns the number of processors available to this process. If possible,
 * limits on otherwise available processors like CPU affinity will be taken
 * into account. If the number of available processors cannot be determined,
 * zero is returned.
 *
 * @return
 *     The number of available processors, or zero if this value cannot be
 *     determined for any reason.
 */
static unsigned long guac_display_nproc() {

#if defined(HAVE_SCHED_GETAFFINITY)

    /* Linux, etc. implementation leveraging sched_getaffinity() (this is
     * specific to glibc and MUSL libc and is non-portable) */

    cpu_set_t cpu_set;
    CPU_ZERO(&cpu_set);

    if (sched_getaffinity(0, sizeof(cpu_set), &cpu_set) == 0) {
        long cpu_count = CPU_COUNT(&cpu_set);
        if (cpu_count > 0)
            return cpu_count;
    }

#elif defined(_SC_NPROCESSORS_ONLN)

    /* Linux, etc. implementation leveraging sysconf() and _SC_NPROCESSORS_ONLN
     * (which is also non-portable) */

    long cpu_count = sysconf(_SC_NPROCESSORS_ONLN);
    if (cpu_count > 0)
        return cpu_count;

#elif defined(__MINGW32__)

    /* Windows-specific implementation (clearly also non-portable) */

    unsigned long cpu_count = 0;
    DWORD_PTR process_mask, system_mask;
    for (GetProcessAffinityMask(GetCurrentProcess(), &process_mask, &system_mask);
            process_mask != 0; process_mask >>= 1) {

        if (process_mask & 1)
                cpu_count++;

    }

    if (cpu_count > 0)
        return cpu_count;

#else

    /* Fallback implementation that does not query the number of CPUs available
     * at all, returning an error code (as portable as it gets) */

    long cpu_count = 0;

#endif

    return 0;

}

guac_display* guac_display_alloc(guac_client* client) {

    /* Allocate and init core properties (really just the client pointer) */
    guac_display* display = guac_mem_zalloc(sizeof(guac_display));
    display->client = client;

    /* Init last frame and pending frame tracking */
    guac_rwlock_init(&display->last_frame.lock);
    guac_rwlock_init(&display->pending_frame.lock);
    display->last_frame.timestamp = display->pending_frame.timestamp = guac_timestamp_current();

    /* It's safe to discard const of the default layer here, as
     * guac_display_free_layer() function is specifically written to consider
     * the default layer as const */
    display->default_layer = guac_display_add_layer(display, (guac_layer*) GUAC_DEFAULT_LAYER, 1);
    display->cursor_buffer = guac_display_alloc_buffer(display, 0);

    /* Init operation FIFO used by worker threads */
    guac_fifo_init(&display->ops, display->ops_items,
            GUAC_DISPLAY_WORKER_FIFO_SIZE, sizeof(guac_display_plan_operation));

    /* Init flag used to notify threads that need to monitor whether a frame is
     * currently being rendered */
    guac_flag_init(&display->render_state);
    guac_flag_set(&display->render_state, GUAC_DISPLAY_RENDER_STATE_FRAME_NOT_IN_PROGRESS);

    int cpu_count = guac_display_nproc();
    if (cpu_count <= 0) {
        guac_client_log(client, GUAC_LOG_WARNING, "Number of available "
                "processors could not be determined. Assuming single-processor.");
        cpu_count = 1;
    }
    else {
        guac_client_log(client, GUAC_LOG_INFO, "Local system reports %i "
                "processor(s) are available.", cpu_count);
    }

    display->worker_thread_count = cpu_count * GUAC_DISPLAY_CPU_THREAD_FACTOR;
    display->worker_threads = guac_mem_alloc(display->worker_thread_count, sizeof(pthread_t));
    guac_client_log(client, GUAC_LOG_INFO, "Graphical updates will be encoded "
            "using %i worker thread(s).", display->worker_thread_count);

    /* Now that the core of the display has been fully initialized, it's safe
     * to start the worker threads */
    for (int i = 0; i < display->worker_thread_count; i++)
        pthread_create(&(display->worker_threads[i]), NULL, guac_display_worker_thread, display);

    return display;

}

void guac_display_stop(guac_display* display) {

    /* Ensure only one of any number of concurrent calls to guac_display_stop()
     * will actually start terminating the worker threads */
    guac_fifo_lock(&display->ops);

    /* Stop and clean up worker threads if the display is not already being
     * stopped (we don't use the GUAC_DISPLAY_RENDER_STATE_STOPPED flag here,
     * as we must consider the case that guac_display_stop() has already been
     * called in a different thread but has not yet finished) */
    if (guac_fifo_is_valid(&display->ops)) {

        /* Stop further use of the operation FIFO */
        guac_fifo_invalidate(&display->ops);
        guac_fifo_unlock(&display->ops);

        /* Wait for all worker threads to terminate (they should nearly immediately
         * terminate following invalidation of the FIFO) */
        for (int i = 0; i < display->worker_thread_count; i++)
            pthread_join(display->worker_threads[i], NULL);

        /* All worker threads are now terminated and may be safely cleaned up */
        guac_mem_free(display->worker_threads);
        display->worker_thread_count = 0;

        /* NOTE: The only other reference to the worker_threads AT ALL is in
         * guac_display_create(). Nothing outside of guac_display_create() and
         * guac_display_stop() references worker_threads or worker_thread_count. */

        /* Notify other calls to guac_display_stop() that the display is now
         * officially stopped */
        guac_flag_set(&display->render_state, GUAC_DISPLAY_RENDER_STATE_STOPPED);

    }

    /* Even if it isn't this particular call to guac_display_stop() that
     * terminates and waits on all the worker threads, ensure that we only
     * return after all threads are known to have been stopped */
    else {

        guac_fifo_unlock(&display->ops);

        guac_flag_wait_and_lock(&display->render_state, GUAC_DISPLAY_RENDER_STATE_STOPPED);
        guac_flag_unlock(&display->render_state);

    }

}

void guac_display_free(guac_display* display) {

    guac_display_stop(display);

    /* All locks, FIFOs, etc. are now unused and can be safely destroyed */
    guac_flag_destroy(&display->render_state);
    guac_fifo_destroy(&display->ops);
    guac_rwlock_destroy(&display->last_frame.lock);
    guac_rwlock_destroy(&display->pending_frame.lock);

    /* Free all layers within the pending_frame list (NOTE: This will also free
     * those layers from the last_frame list) */
    while (display->pending_frame.layers != NULL)
        guac_display_free_layer(display->pending_frame.layers);

    /* Free any remaining layers that were present only on the last_frame list
     * and not on the pending_frame list */
    while (display->last_frame.layers != NULL)
        guac_display_free_layer(display->last_frame.layers);

    guac_mem_free(display);

}

void guac_display_dup(guac_display* display, guac_socket* socket) {

    guac_client* client = display->client;
    guac_rwlock_acquire_read_lock(&display->last_frame.lock);

    /* Wait for any pending frame to finish being sent to established users of
     * the connection before syncing any new users (doing otherwise could
     * result in trailing instructions of that pending frame getting sent to
     * new users after they finish joining, even though they are already in
     * sync with that frame, and those trailing instructions may not have the
     * intended meaning in context of the new users' remote displays) */
    guac_flag_wait_and_lock(&display->render_state,
            GUAC_DISPLAY_RENDER_STATE_FRAME_NOT_IN_PROGRESS);

    /* Sync the state of all layers/buffers */
    guac_display_layer* current = display->last_frame.layers;
    while (current != NULL) {

        const guac_layer* layer = current->layer;

        guac_rect layer_bounds;
        guac_display_layer_get_bounds(current, &layer_bounds);

        int width = guac_rect_width(&layer_bounds);
        int height = guac_rect_height(&layer_bounds);
        guac_protocol_send_size(socket, layer, width, height);

        if (width > 0 && height > 0) {

            /* Get Cairo surface covering layer bounds */
            unsigned char* buffer = GUAC_DISPLAY_LAYER_STATE_MUTABLE_BUFFER(current->last_frame, layer_bounds);
            cairo_surface_t* rect = cairo_image_surface_create_for_data(buffer,
                        current->opaque ? CAIRO_FORMAT_RGB24 : CAIRO_FORMAT_ARGB32,
                        width, height, current->last_frame.buffer_stride);

            /* Send PNG for rect */
            guac_client_stream_png(client, socket, GUAC_COMP_OVER, layer, 0, 0, rect);

            /* Resync copy of previous frame */
            guac_protocol_send_copy(socket,
                    layer, 0, 0, width, height,
                    GUAC_COMP_OVER, current->last_frame_buffer, 0, 0);

            cairo_surface_destroy(rect);

        }

        /* Resync any properties that are specific to non-buffer layers */
        if (current->layer->index > 0) {

            /* Resync layer opacity */
            guac_protocol_send_shade(socket, current->layer,
                    current->last_frame.opacity);

            /* Resync layer position/hierarchy */
            guac_protocol_send_move(socket, current->layer,
                    current->last_frame.parent,
                    current->last_frame.x,
                    current->last_frame.y,
                    current->last_frame.z);

        }

        /* Resync multitouch support */
        if (current->layer->index >= 0) {
            guac_protocol_send_set_int(socket, current->layer,
                    GUAC_PROTOCOL_LAYER_PARAMETER_MULTI_TOUCH,
                    current->last_frame.touches);
        }

        current = current->last_frame.next;

    }

    /* Synchronize mouse cursor */
    guac_display_layer* cursor = display->cursor_buffer;
    guac_protocol_send_cursor(socket,
            display->last_frame.cursor_hotspot_x,
            display->last_frame.cursor_hotspot_y,
            cursor->layer, 0, 0,
            cursor->last_frame.width,
            cursor->last_frame.height);

    /* Synchronize mouse location */
    guac_protocol_send_mouse(socket, display->last_frame.cursor_x, display->last_frame.cursor_y,
            display->last_frame.cursor_mask, client->last_sent_timestamp);

    /* The initial frame synchronizing the newly-joined users is now complete */
    guac_protocol_send_sync(socket, client->last_sent_timestamp, display->last_frame.frames);

    /* Further rendering for the current connection can now safely continue */
    guac_flag_unlock(&display->render_state);
    guac_rwlock_release_lock(&display->last_frame.lock);

    guac_socket_flush(socket);

}

void guac_display_notify_user_left(guac_display* display, guac_user* user) {
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    /* Update to reflect leaving user, if necessary */
    if (display->pending_frame.cursor_user == user)
        display->pending_frame.cursor_user = NULL;

    guac_rwlock_release_lock(&display->pending_frame.lock);
}

void guac_display_notify_user_moved_mouse(guac_display* display, guac_user* user, int x, int y, int mask) {

    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);
    display->pending_frame.cursor_user = user;
    display->pending_frame.cursor_x = x;
    display->pending_frame.cursor_y = y;
    display->pending_frame.cursor_mask = mask;
    guac_rwlock_release_lock(&display->pending_frame.lock);

    guac_display_end_mouse_frame(display);

}

guac_display_layer* guac_display_default_layer(guac_display* display) {
    return display->default_layer;
}

guac_display_layer* guac_display_alloc_layer(guac_display* display, int opaque) {
    return guac_display_add_layer(display, guac_client_alloc_layer(display->client), opaque);
}

guac_display_layer* guac_display_alloc_buffer(guac_display* display, int opaque) {
    return guac_display_add_layer(display, guac_client_alloc_buffer(display->client), opaque);
}

void guac_display_free_layer(guac_display_layer* display_layer) {

    guac_display* display = display_layer->display;
    const guac_layer* layer = display_layer->layer;

    guac_display_remove_layer(display_layer);

    if (layer->index != 0) {

        guac_client* client = display->client;
        guac_protocol_send_dispose(client->socket, layer);

        /* As long as this isn't the display layer, it's safe to cast away the
         * constness and free the underlying layer/buffer. Only the default
         * layer (layer #0) is truly const. */
        if (layer->index > 0)
            guac_client_free_layer(client, (guac_layer*) layer);
        else
            guac_client_free_buffer(client, (guac_layer*) layer);

    }

}
