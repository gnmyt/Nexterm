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

#ifndef GUAC_DISPLAY_PRIV_H
#define GUAC_DISPLAY_PRIV_H

#include "display-plan.h"
#include "guacamole/client.h"
#include "guacamole/display.h"
#include "guacamole/fifo.h"
#include "guacamole/rect.h"
#include "guacamole/socket.h"

#include <pthread.h>

/**
 * The maximum amount of time to wait after flushing a frame when compensating
 * for client-side processing delays, in milliseconds. If a connected client is
 * taking longer than this amount of additional time to process a received
 * frame, processing lag compensation will be only partial (to avoid delaying
 * further processing without bound for extremely slow clients).
 */
#define GUAC_DISPLAY_MAX_LAG_COMPENSATION 500

/*
 * IMPORTANT: All functions defined within the internals of guac_display that
 * DO NOT acquire locks on their own are given prefixes based on whether they
 * access or modify the pending frame, last frame, or both. It is the
 * responsibility of the caller of such functions to ensure that the required
 * locks are either held or not relevant.
 *
 * The prefixes that may be added to function names are:
 *
 *   "PFR_"
 *     The function reads (but does not write) the state of the pending frame.
 *     This prefix and "PFW_" are mutually-exclusive.
 *
 *   "PFW_"
 *     The function writes (and possibly reads) the state of the pending frame.
 *     This prefix and "PFW_" are mutually-exclusive.
 *
 *   "LFR_"
 *     The function reads (but does not write) the state of the last frame.
 *     This prefix and "LFW_" are mutually-exclusive.
 *
 *   "LFW_"
 *     The function writes (and possibly reads) the state of the last frame.
 *     This prefix and "LFR_" are mutually-exclusive.
 *
 *   "XFR_"
 *     The function reads (but does not write) the state of a frame, and
 *     whether that frame is the pending frame or the last frame depends on
 *     which frame is provided via function parameters. This prefix and "XFW_"
 *     are mutually-exclusive.
 *
 *   "XFW_"
 *     The function writes (but does not read) the state of a frame, and
 *     whether that frame is the pending frame or the last frame depends on
 *     which frame is provided via function parameters. This prefix and "XFR_"
 *     are mutually-exclusive.
 *
 * Any functions lacking these prefixes either do not access last/pending
 * frames in any way or take care of acquiring/releasing locks entirely on
 * their own.
 *
 * These conventions are used for all functions in the internals of
 * guac_display, not just those defined in this header.
 */

/*
 * IMPORTANT: In cases where a single thread must acquire multiple locks used
 * by guac_display, proper acquisition order must be observed to avoid
 * deadlock. The correct order is:
 *
 * 1) pending_frame.lock
 * 2) last_frame.lock
 * 3) ops
 * 4) render_state
 *
 * Acquiring these locks in any other order risks deadlock. Don't do it.
 */

/**
 * The size of the image tiles (cells) that will be used to track changes to
 * each layer, including gathering framerate statistics and performing indexing
 * based on contents. Each side of each cell will consist of this many pixels.
 *
 * IMPORTANT: The hashing algorithm used to search the previous frame for
 * content in the pending frame that has been reused (ie: scrolling) strongly
 * depends on this value being 64. Any adjustment to this value will require
 * corresponding and careful changes to the hashing algorithm.
 */
#define GUAC_DISPLAY_CELL_SIZE 64

/**
 * The exponent of the power-of-two value that dictates the size of the image
 * tiles (cells) that will be used to track changes to each layer
 * (GUAC_DISPLAY_CELL_SIZE).
 */
#define GUAC_DISPLAY_CELL_SIZE_EXPONENT 6

/**
 * The amount that the width/height of internal storage for graphical data
 * should be rounded up to avoid unnecessary reallocations and copying.
 */
#define GUAC_DISPLAY_RESIZE_FACTOR 64

/**
 * Given the width (or height) of a layer in pixels, calculates the width (or
 * height) of that layer's pending_frame_cells array in cells.
 *
 * NOTE: It is not necessary to recalculate these values except when resizing a
 * layer. In all other cases, the width/height of a layer in cells can be found
 * in the pending_frame_cells_width and pending_frame_cells_height members
 * respectively.
 *
 * @param pixels
 *     The width or height of the layer, in pixels.
 *
 * @return
 *     The width or height of that layer's pending_frame_cells array, in cells.
 */
#define GUAC_DISPLAY_CELL_DIMENSION(pixels) \
    ((pixels + GUAC_DISPLAY_CELL_SIZE - 1) / GUAC_DISPLAY_CELL_SIZE)

/**
 * The size of the operation FIFO read by the display worker threads. This
 * value is the number of operation slots in the FIFO, not bytes. The amount of
 * space currently specified here is roughly sufficient 8 worst-case frames
 * worth of outstanding operations.
 */
#define GUAC_DISPLAY_WORKER_FIFO_SIZE (                                       \
            GUAC_DISPLAY_MAX_WIDTH * GUAC_DISPLAY_MAX_HEIGHT                  \
                / GUAC_DISPLAY_CELL_SIZE                                      \
                / GUAC_DISPLAY_CELL_SIZE                                      \
                * 8)

/**
 * Returns the memory address of the given rectangle within the mutable image
 * buffer of the given guac_display_layer_state, where the upper-left corner of
 * the given buffer is (0, 0). If the memory address cannot be calculated
 * because doing so would overflow the maximum value of a size_t, execution of
 * the current process is automatically aborted.
 *
 * IMPORTANT: No checks are performed on whether the rectangle extends beyond
 * the bounds of the buffer, including considering whether the left/top
 * position of the rectangle is negative. If the rectangle has not already been
 * contrained to be within the bounds of the buffer, such checks must be
 * performed before dereferencing the value returned by this macro.
 *
 * @param layer_state
 *     The guac_display_layer_state associated with the image buffer within
 *     which the address of the given rectangle should be determined.
 *
 * @param rect
 *     The rectangle to determine the offset of.
 *
 * @return
 *     The memory address of the given rectangle within the buffer of the given
 *     layer state.
 */
#define GUAC_DISPLAY_LAYER_STATE_MUTABLE_BUFFER(layer_state, rect) \
    GUAC_RECT_MUTABLE_BUFFER(rect, (layer_state).buffer, (layer_state).buffer_stride, GUAC_DISPLAY_LAYER_RAW_BPP)

/**
 * Returns the memory address of the given rectangle within the immutable
 * (const) image buffer of the given guac_display_layer_state, where the
 * upper-left corner of the given buffer is (0, 0). If the memory address
 * cannot be calculated because doing so would overflow the maximum value of a
 * size_t, execution of the current process is automatically aborted.
 *
 * IMPORTANT: No checks are performed on whether the rectangle extends beyond
 * the bounds of the buffer, including considering whether the left/top
 * position of the rectangle is negative. If the rectangle has not already been
 * contrained to be within the bounds of the buffer, such checks must be
 * performed before dereferencing the value returned by this macro.
 *
 * @param layer_state
 *     The guac_display_layer_state associated with the image buffer within
 *     which the address of the given rectangle should be determined.
 *
 * @param rect
 *     The rectangle to determine the offset of.
 *
 * @return
 *     The memory address of the given rectangle within the buffer of the given
 *     layer state.
 */
#define GUAC_DISPLAY_LAYER_STATE_CONST_BUFFER(layer_state, rect) \
    GUAC_RECT_CONST_BUFFER(rect, (layer_state).buffer, (layer_state).buffer_stride, GUAC_DISPLAY_LAYER_RAW_BPP)

/**
 * Bitwise flag set on the render_state flag in guac_display when rendering of
 * a pending frame is in progress (Guacamole instructions that draw the pending
 * frame are being sent to connected users).
 */
#define GUAC_DISPLAY_RENDER_STATE_FRAME_IN_PROGRESS 1

/**
 * Bitwise flag set on the render_state flag in guac_display when rendering of
 * a pending frame is NOT in progress (Guacamole instructions that draw the
 * pending frame are NOT being sent to connected users).
 */
#define GUAC_DISPLAY_RENDER_STATE_FRAME_NOT_IN_PROGRESS 2

/**
 * Bitwise flag set on the render_state flag in guac_display when the
 * guac_display has been stopped and all worker threads have terminated (no
 * further frames will render). This flag is set when guac_display_stop() has
 * been invoked, including as part of guac_display_free().
 */
#define GUAC_DISPLAY_RENDER_STATE_STOPPED 4

/**
 * Bitwise flag that is set on the state of a guac_display_render_thread when
 * the thread should be stopped.
 */
#define GUAC_DISPLAY_RENDER_THREAD_STATE_STOPPING 1

/**
 * Bitwise flag that is set on the state of a guac_display_render_thread when
 * visible, graphical changes have been made.
 */
#define GUAC_DISPLAY_RENDER_THREAD_STATE_FRAME_MODIFIED 2

/**
 * Bitwise flag that is set on the state of a guac_display_render_thread when
 * a frame boundary has been reached.
 */
#define GUAC_DISPLAY_RENDER_THREAD_STATE_FRAME_READY 4

/**
 * The state of the mouse cursor, as independently tracked by the render
 * thread. The mouse cursor state may be reported by
 * guac_display_render_thread_notify_user_moved_mouse() to avoid unnecessarily
 * locking the display within instruction handlers (which can otherwise result
 * in delays in handling critical instructions like "sync").
 */
typedef struct guac_display_render_thread_cursor_state {

    /**
     * The user that moved or clicked the mouse.
     *
     * NOTE: This user is NOT guaranteed to still exist in memory. This may be
     * a dangling pointer and must be validated before deferencing.
     */
    guac_user* user;

    /**
     * The X coordinate of the mouse cursor.
     */
    int x;

    /**
     * The Y coordinate of the mouse cursor.
     */
    int y;

    /**
     * The mask representing the states of all mouse buttons.
     */
    int mask;

} guac_display_render_thread_cursor_state;

struct guac_display_render_thread {

    /**
     * The display this render thread should render to.
     */
    guac_display* display;

    /**
     * The actual underlying POSIX thread.
     */
    pthread_t thread;

    /**
     * Flag representing render state. This flag is used to store whether the
     * render thread is stopping and whether the current frame has been
     * modified or is ready.
     *
     * @see GUAC_DISPLAY_RENDER_THREAD_STATE_STOPPING
     * @see GUAC_DISPLAY_RENDER_THREAD_FRAME_MODIFIED
     * @see GUAC_DISPLAY_RENDER_THREAD_FRAME_READY
     */
    guac_flag state;

    /**
     * The current mouse cursor state, as reported by
     * guac_display_render_thread_notify_user_moved_mouse().
     */
    guac_display_render_thread_cursor_state cursor_state;

    /**
     * The number of frames that have been explicitly marked as ready since the
     * last frame sent. This will be zero if explicit frame boundaries are not
     * currently being used.
     */
    unsigned int frames;

};

/**
 * Approximation of how often a region of a layer is modified, as well as what
 * changes have been made to that region since the last frame. This information
 * is used to help advise future optimizations, such as whether lossy
 * compression is appropriate and whether parts of the layer can be copied from
 * other regions rather than resend image data.
 */
typedef struct guac_display_layer_cell {

    /**
     * The last time this particular cell was part of a frame (used to
     * calculate framerate).
     */
    guac_timestamp last_frame;

    /**
     * The region of this cell that has been modified since the last frame was
     * flushed. If the cell has not been modified at all, this will be an empty
     * rect.
     */
    guac_rect dirty;

    /**
     * The rough number of pixels in the dirty rect that have been modified. If
     * the cell has not been modified at all, this will be zero.
     */
    size_t dirty_size;

    /**
     * The display plan operation that is associated with this cell. If a
     * display plan is not currently being created or optimized, this will be
     * NULL.
     */
    guac_display_plan_operation* related_op;

} guac_display_layer_cell;

/**
 * The state of a Guacamole layer or buffer at some point in time. Within
 * guac_display_layer, copies of this structure are used to represent the
 * previous frame and the current, in-progress frame. The previous and
 * in-progress frames are compared during flush to determine what graphical
 * operations need to be sent to connected clients to efficiently transform the
 * remote display from its previous state to the now-current state.
 *
 * IMPORTANT: The lock of the corresponding guac_display_state must be acquired
 * before reading or modifying the values of any member of this structure.
 */
typedef struct guac_display_layer_state {

    /**
     * The width of this layer in pixels.
     */
    int width;

    /**
     * The height of this layer in pixels.
     */
    int height;

    /**
     * The layer which contains this layer. This is only applicable to visible
     * (non-buffer) layers which are not the default layer.
     */
    const guac_layer* parent;

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
     * The raw, 32-bit buffer of ARGB image data. If the layer was allocated as
     * opaque, the alpha channel of each ARGB pixel will not be considered when
     * compositing or when encoding images.
     *
     * So that large regions of image data can be easily compared, a consistent
     * value for the alpha channel SHOULD be provided so that each 32-bit pixel
     * can be compared without having to separately masking the channel.
     * Optimizations within guac_display, including scroll detection, may
     * assume that the alpha channel can always be considered when comparing
     * pixel values for equivalence.
     */
    unsigned char* buffer;

    /**
     * The width of the image data, in pixels. This is not necessarily the same
     * as the width of the layer.
     */
    int buffer_width;

    /**
     * The height of the image data, in pixels. This is not necessarily the
     * same as the height of the layer.
     */
    int buffer_height;

    /**
     * The number of bytes in each row of image data. This is not necessarily
     * equivalent to 4 * width.
     */
    size_t buffer_stride;

    /**
     * Non-zero if the image data referenced by the buffer pointer was
     * allocated externally and should not be automatically freed or managed by
     * guac_display, zero otherwise.
     */
    int buffer_is_external;

    /**
     * The approximate rectangular region containing all pixels within this
     * layer that have been modified since the frame that occurred before this
     * frame. If the layer was not modified, this will be an empty rect (zero
     * width or zero height).
     */
    guac_rect dirty;

    /**
     * Whether this layer should be searched for possible scroll/copy
     * optimizations.
     */
    int search_for_copies;

    /* ---------------- LAYER LIST POINTERS ---------------- */

    /**
     * The layer immediately prior to this layer within the list containing
     * this layer, or NULL if this is the first layer/buffer in the list.
     */
    guac_display_layer* prev;

    /**
     * The layer immediately following this layer within the list containing
     * this layer, or NULL if this is the last layer/buffer in the list.
     */
    guac_display_layer* next;

} guac_display_layer_state;

struct guac_display_layer {

    /**
     * The guac_display instance that allocated this layer/buffer.
     */
    guac_display* display;

    /**
     * The Guacamole layer (or buffer) that this guac_display_layer will draw
     * to when flushing a frame.
     *
     * NOTE: This value is set only during allocation and may safely be
     * accessed without acquiring the overall layer lock.
     */
    const guac_layer* layer;

    /**
     * Whether the graphical data that will be written to this layer/buffer
     * will only ever be opaque (no alpha channel). Compositing of graphical
     * updates can be faster when no alpha channel need be considered.
     */
    int opaque;

    /* ---------------- LAYER PREVIOUS FRAME STATE ---------------- */

    /**
     * The state of this layer when the last frame was flushed to connected clients.
     *
     * IMPORTANT: The display-level last_frame.lock MUST be acquired before
     * modifying or reading this member.
     */
    guac_display_layer_state last_frame;

    /**
     * Off-screen buffer storing the contents of the previously-rendered frame
     * for later use. If graphical updates are recognized as reusing data from
     * a previous frame, that data will be copied from this buffer. Doing this
     * simplifies the copy operation (there is no longer any need to perform
     * those copies in a specific order) and ensures the copies are efficient
     * on the client side (copying from one part of a graphical surface to
     * another part of the same surface can be inefficient, particularly if the
     * regions overlap). In practice, there is ample time between frames for
     * the client to copy a layer's current contents to an off-screen buffer
     * while awaiting the next frame.
     *
     * NOTE: This value is set only during allocation and may safely be
     * accessed without acquiring the display-level last_frame.lock.
     */
    guac_layer* last_frame_buffer;

    /* ---------------- LAYER PENDING FRAME STATE ---------------- */

    /**
     * The upcoming state of this layer when the current, in-progress frame is
     * flushed to connected clients.
     *
     * IMPORTANT: The display-level pending_frame.lock MUST be acquired before
     * modifying or reading this member.
     */
    guac_display_layer_state pending_frame;

    /**
     * The Cairo context and surface containing the graphical data of the
     * pending frame. The actual underlying buffer and details of the graphical
     * surface are also available via pending_frame_raw_context.
     *
     * IMPORTANT: The display-level pending_frame.lock MUST be acquired before
     * modifying or reading this member.
     */
    guac_display_layer_cairo_context pending_frame_cairo_context;

    /**
     * The raw underlying buffer and details of the surface containing the
     * graphical data of the pending frame. A Cairo context and surface backed
     * by this buffer are also available via pending_frame_cairo_context.
     *
     * IMPORTANT: The display-level pending_frame.lock MUST be acquired before
     * modifying or reading this member.
     */
    guac_display_layer_raw_context pending_frame_raw_context;

    /**
     * A two-dimensional array of square tiles representing the nature of
     * changes made to corresponding regions of the display. This is used both
     * to track how frequently certain regions are being updated (to help
     * inform whether lossy compression is appropriate), to track what parts of
     * the frame have actually changed, and to aid in determining whether
     * adjacent updated regions should be combined into a single update.
     *
     * IMPORTANT: The display-level pending_frame.lock MUST be acquired before
     * modifying or reading this member.
     */
    guac_display_layer_cell* pending_frame_cells;

    /**
     * The width of the pending_frame_cells array, in cells.
     *
     * IMPORTANT: The display-level pending_frame.lock MUST be acquired before
     * modifying or reading this member.
     */
    size_t pending_frame_cells_width;

    /**
     * The height of the pending_frame_cells array, in cells.
     *
     * IMPORTANT: The display-level pending_frame.lock MUST be acquired before
     * modifying or reading this member.
     */
    size_t pending_frame_cells_height;

};

typedef struct guac_display_state {

    /**
     * Lock that guards concurrent access to any member of ANY STRUCTURE that
     * relates to this guac_display_state, including the members of this
     * structure. Unless explicitly documented otherwise, this lock MUST be
     * acquired before accessing or modifying the members of this
     * guac_display_state or any nested structure.
     */
    guac_rwlock lock;

    /**
     * The specific point in time that this guac_display_state represents.
     */
    guac_timestamp timestamp;

    /**
     * All layers and buffers that were part of the display at the time that
     * the frame/snapshot represented by this guac_display_state was updated.
     * 
     * NOTE: For each guac_display, there are two distinct lists of layers: the
     * last frame layer list and the pending frame layer list:
     *
     * LAST FRAME LAYER LIST
     *
     *  - HEAD: display->last_frame.layers
     *  - NEXT: layer->last_frame.next
     *  - PREV: layer->last_frame.prev
     *
     * PENDING LAYER LIST
     *
     *  - HEAD: display->pending_frame.layers
     *  - NEXT: layer->pending_frame.next
     *  - PREV: layer->pending_frame.prev
     *
     * Existing layers are deleted only at the time a frame is flushed when a
     * layer in the last frame layer list is found to no longer exist in the
     * pending frame layer list. The same goes for the addition of new layers:
     * they are added only during flush when a layer that was not present in
     * the last frame layer list is found to be present in the pending frame
     * layer list.
     */
    guac_display_layer* layers;

    /**
     * The X coordinate of the hotspot of the mouse cursor. The cursor image is
     * stored/updated via the cursor_buffer member of guac_display.
     */
    int cursor_hotspot_x;

    /**
     * The Y coordinate of the hotspot of the mouse cursor. The cursor image is
     * stored/updated via the cursor_buffer member of guac_display.
     */
    int cursor_hotspot_y;

    /**
     * The user that moved or clicked the mouse. This is used to ensure we
     * don't attempt to synchronize an out-of-date mouse position to the user
     * that is actively moving the mouse.
     *
     * NOTE: This user is NOT guaranteed to still exist in memory. This may be
     * a dangling pointer and must be validated before deferencing.
     */
    guac_user* cursor_user;

    /**
     * The X coordinate of the mouse cursor.
     */
    int cursor_x;

    /**
     * The Y coordinate of the mouse cursor.
     */
    int cursor_y;

    /**
     * The mask representing the states of all mouse buttons.
     */
    int cursor_mask;

    /**
     * The number of logical frames that have been rendered to this display
     * state since the previous display state.
     */
    unsigned int frames;

} guac_display_state;

struct guac_display {

    /* NOTE: Any member of this structure that requires protection against
     * concurrent access is protected by its own lock. The overall display does
     * not have nor need a top-level lock. */

    /**
     * The client associated with this display.
     */
    guac_client* client;

    /* ---------------- DISPLAY FRAME STATES ---------------- */

    /**
     * The state of this display at the time the last frame was sent to
     * connected users.
     */
    guac_display_state last_frame;

    /**
     * The pending state of this display that will become the next frame once
     * it is sent to connected users.
     */
    guac_display_state pending_frame;

    /**
     * Whether the pending frame has been modified in any way outside of
     * changing the mouse cursor or moving the mouse. This is used to help
     * inform whether a frame should be flushed to update connected clients
     * with respect to mouse cursor changes, or whether those changes can be
     * safely assumed to be part of a larger frame containing general graphical
     * updates.
     *
     * IMPORTANT: The display-level pending_frame.lock MUST be acquired before
     * modifying or reading this member.
     */
    int pending_frame_dirty_excluding_mouse;

    /* ---------------- WELL-KNOWN LAYERS / BUFFERS ---------------- */

    /**
     * The default layer of the client display.
     */
    guac_display_layer* default_layer;

    /**
     * The buffer storing the current mouse cursor. The hotspot position within
     * the cursor is stored within cursor_hotspot_x and cursor_hotspot_y of
     * guac_display_state.
     */
    guac_display_layer* cursor_buffer;

    /* ---------------- FRAME ENCODING WORKER THREADS ---------------- */

    /**
     * The number of worker threads in the worker_threads array.
     */
    int worker_thread_count;

    /**
     * Pool of worker threads that automatically pull from the ops FIFO,
     * sending corresponding Guacamole instructions to all connected clients.
     */
    pthread_t* worker_threads;

    /**
     * FIFO of all graphical operations required to transform the remote
     * display state from the previous frame to the next frame. Operations
     * added to this FIFO will automatically be pulled and processed by a
     * worker thread.
     */
    guac_fifo ops;

    /**
     * Storage for any items within the ops fifo.
     */
    guac_display_plan_operation ops_items[GUAC_DISPLAY_WORKER_FIFO_SIZE];

    /**
     * The current number of active worker threads.
     *
     * IMPORTANT: This member must only be accessed or modified while the ops
     * FIFO is locked.
     */
    unsigned int active_workers;

    /**
     * Whether least one pending frame has been deferred due to the encoding
     * process being underway for a previous frame at the time it was
     * completed.
     *
     * IMPORTANT: This member must only be accessed or modified while the ops
     * FIFO is locked.
     */
    int frame_deferred;

    /**
     * The current state of the rendering process. Code that needs to be aware
     * of whether a frame is currently in the process of being rendered can
     * monitor the state of this flag, watching for either the
     * GUAC_DISPLAY_RENDER_STATE_FRAME_IN_PROGRESS or
     * GUAC_DISPLAY_RENDER_STATE_FRAME_NOT_IN_PROGRESS values.
     */
    guac_flag render_state;

};

/**
 * Allocates and inserts a new element into the given linked list of display
 * layers, associating it with the given layer and surface.
 *
 * @param head
 *     A pointer to the head pointer of the list of layers. The head pointer
 *     will be updated by this function to point to the newly-allocated
 *     display layer.
 *
 * @param layer
 *     The Guacamole layer to associated with the new display layer.
 *
 * @param opaque
 *     Non-zero if the new layer will only ever contain opaque image contents
 *     (the alpha channel should be ignored), zero otherwise.
 *
 * @return
 *     The newly-allocated display layer, which has been associated with the
 *     provided layer and surface.
 */
guac_display_layer* guac_display_add_layer(guac_display* display, guac_layer* layer, int opaque);

/**
 * Removes the given layer from all linked lists containing that layer and
 * frees all associated memory.
 *
 * @param display_layer
 *     The layer to remove.
 */
void guac_display_remove_layer(guac_display_layer* display_layer);

/**
 * Resizes the given layer to the given dimensions, including any underlying
 * image buffers.
 *
 * @param layer
 *     The layer to resize.
 *
 * @param width
 *     The new width, in pixels.
 *
 * @param height
 *     The new height, in pixels.
 */
void PFW_guac_display_layer_resize(guac_display_layer* layer,
        int width, int height);

/**
 * Worker thread that continuously pulls operations from the operation FIFO of
 * the given guac_display, applying those operations by seding corresponding
 * instructions to connected clients.
 *
 * @param data
 *     A pointer to the guac_display.
 *
 * @return
 *     Always NULL.
 */
void* guac_display_worker_thread(void* data);

#endif
