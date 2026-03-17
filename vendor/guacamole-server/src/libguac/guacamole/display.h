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

#ifndef GUAC_DISPLAY_H
#define GUAC_DISPLAY_H

/**
 * An abstract display implementation which handles optimization automatically.
 * Current optimizations include:
 *
 * - Scroll/copy detection
 * - Solid color detection
 * - Dirty rectangle reduction
 * - Dynamic selection of PNG/JPEG/WebP compression depending on update content
 *   and frequency
 * - Combining/rewriting of updates based on estimated cost
 *
 * @defgroup display guac_display
 * @{
 */

/**
 * Provides an abstract display implementation (guac_display), which handles
 * optimization automatically.
 *
 * @file display.h
 */

#include "client.h"
#include "display-constants.h"
#include "display-types.h"
#include "rect.h"
#include "socket.h"

#include <cairo/cairo.h>
#include <unistd.h>

/**
 * Returns the memory address of the given rectangle within the image buffer of
 * the given guac_display_layer_raw_context, where the upper-left corner of the
 * given buffer is (0, 0). If the memory address cannot be calculated because
 * doing so would overflow the maximum value of a size_t, execution of the
 * current process is automatically aborted.
 *
 * IMPORTANT: No checks are performed on whether the rectangle extends beyond
 * the bounds of the buffer, including considering whether the left/top
 * position of the rectangle is negative. If the rectangle has not already been
 * contrained to be within the bounds of the buffer, such checks must be
 * performed before dereferencing the value returned by this macro.
 *
 * @param context
 *     The guac_display_layer_raw_context associated with the image buffer
 *     within which the address of the given rectangle should be determined.
 *
 * @param rect
 *     The rectangle to determine the offset of.
 */
#define GUAC_DISPLAY_LAYER_RAW_BUFFER(context, rect) \
    GUAC_RECT_MUTABLE_BUFFER(rect, context->buffer, context->stride, GUAC_DISPLAY_LAYER_RAW_BPP)

struct guac_display_layer_cairo_context {

    /**
     * A Cairo context created for the Cairo surface. This Cairo context is
     * persistent and will maintain its state between different calls to
     * guac_display_layer_open_cairo() for the same layer.
     */
    cairo_t* cairo;

    /**
     * A Cairo image surface wrapping the image buffer of this
     * guac_display_layer.
     */
    cairo_surface_t* surface;

    /**
     * A rectangle covering the current bounds of the graphical surface.
     */
    guac_rect bounds;

    /**
     * A rectangle covering the region of the guac_display_layer that has
     * changed since the last frame. This rectangle is initially empty and must
     * be manually updated to cover any additional changed regions before
     * closing the guac_display_layer_cairo_context.
     */
    guac_rect dirty;

    /**
     * The layer that should be searched for possible scroll/copy operations
     * related to the changes being made via this guac_display_layer_cairo_context.
     * This value is initially the layer being drawn to and must be updated
     * before closing the context if a different source layer should be
     * considered for scroll/copy optimizations. This value may be set to NULL
     * to hint that no scroll/copy optimization should be performed.
     */
    guac_display_layer* hint_from;

};

struct guac_display_layer_raw_context {

    /**
     * The raw, underlying image buffer of the guac_display_layer. If the layer
     * was created as opaque, this image is 32-bit RGB with 8 bits per color
     * component, where the lowest-order byte is the blue component and the
     * highest-order byte is ignored. If the layer was not created as opaque,
     * this image is 32-bit ARGB with 8 bits per color component, where the
     * lowest-order byte is the blue component and the highest-order byte is
     * alpha.
     *
     * This value may be replaced with a manually-allocated buffer if the
     * associated layer should instead use that manually-allocated buffer for
     * future rendering operations. If the buffer is replaced, it must be
     * maintained manually going forward, including when the buffer needs to be
     * resized or after the corresponding layer/display have been freed.
     *
     * If necessary (such as when a manually-allocated buffer must be freed
     * before freeing the guac_display), all guac_display references to a
     * manually-allocated buffer may be removed by setting this value to NULL
     * and closing the context. Layers with a NULL buffer will not be
     * considered for graphical changes in subsequent frames.
     */
    unsigned char* buffer;

    /**
     * The number of bytes in each row of image data. This value is not
     * necessarily the same as the width of the image multiplied by the size of
     * each pixel. Additional space may be allocated to allow for memory
     * alignment or to make future resize operations more efficient.
     *
     * If the buffer for this layer is replaced with an external buffer, or if
     * the external buffer changes structure, then this value must be manually
     * kept up-to-date with the stride of the external buffer.
     */
    size_t stride;

    /**
     * A rectangle covering the current bounds of the graphical surface. The
     * buffer must not be addressed outside these bounds.
     *
     * If the buffer for this layer is replaced with an external buffer, or if
     * the external buffer changes size, then the dimensions of this bounds
     * rect must be manually kept up-to-date with the dimensions of the
     * external buffer. These dimensions will also be passed through to become
     * the dimensions of the layer, since layers with external buffers cannot
     * be resized with guac_display_layer_resize().
     *
     * NOTE: If an external buffer is used and bounds dimensions are provided
     * that are greater than GUAC_DISPLAY_MAX_WIDTH and
     * GUAC_DISPLAY_MAX_HEIGHT, those values will instead be interpreted as
     * equal to GUAC_DISPLAY_MAX_WIDTH and GUAC_DISPLAY_MAX_HEIGHT.
     */
    guac_rect bounds;

    /**
     * A rectangle covering the region of the guac_display_layer that has
     * changed since the last frame. This rectangle is initially empty and must
     * be manually updated to cover any additional changed regions before
     * closing the guac_display_layer_raw_context.
     */
    guac_rect dirty;

    /**
     * The layer that should be searched for possible scroll/copy operations
     * related to the changes being made via this guac_display_layer_raw_context.
     * This value is initially the layer being drawn to and must be updated
     * before closing the context if a different source layer should be
     * considered for scroll/copy optimizations. This value may be set to NULL
     * to hint that no scroll/copy optimization should be performed.
     */
    guac_display_layer* hint_from;

};

/**
 * Allocates a new guac_display representing the remote display shared by all
 * connected users of the given guac_client. The dimensions of the display
 * should be set with guac_display_default_layer() and
 * guac_display_layer_resize() once the desired display size is known. The
 * guac_display must eventually be freed through a call to guac_display_free().
 *
 * NOTE: If the buffer of a layer has been replaced with an externally
 * maintained buffer, this function CANNOT be used to resize the layer. The
 * layer must instead be resized through changing the bounds of a
 * guac_display_layer_raw_context and, if necessary, replacing the underlying
 * buffer again.
 *
 * @param client
 *     The guac_client whose remote display should be represented by the new
 *     guac_display.
 *
 * @return
 *     A newly-allocated guac_display representing the remote display of the
 *     given guac_client.
 */
guac_display* guac_display_alloc(guac_client* client);

/**
 * Stops all background processes that may be running beneath the given
 * guac_display, ensuring nothing within guac_display will continue to access
 * any memory unless explicitly and externally requested. After this function
 * returns, all background threads used by guac_display have stopped. This
 * function is threadsafe and may be safely invoked by multiple threads. All
 * concurrent calls to this function will block until all background threads
 * used by the guac_display have terminated.
 *
 * This function DOES NOT affect the state of a guac_display_render_thread,
 * which must be similarly stopped and destroyed with a call to
 * guac_display_render_thread_destroy() before underlying external buffers can
 * be safely freed.
 *
 * NOTE: Invoking this function may be necessary to allow external objects to
 * be safely cleaned up, particularly if external buffers have been provided to
 * replace the buffers allocated by guac_display. Doing otherwise would mean
 * that background worker threads used for encoding by guac_display may
 * continue to check the contents of external buffers while those buffers are
 * being freed.
 *
 * @param display
 *     The display to stop.
 */
void guac_display_stop(guac_display* display);

/**
 * Frees all resources associated with the given guac_display.
 *
 * @param display
 *     The guac_display to free.
 */
void guac_display_free(guac_display* display);

/**
 * Replicates the current remote display state across the given socket. When
 * new users join a particular guac_client, this function should be used to
 * synchronize those users with the current display state.
 *
 * @param display
 *     The display that should be synchronized to all users at the other end of
 *     the given guac_socket.
 *
 * @param socket
 *     The socket to send the current remote display state over.
 */
void guac_display_dup(guac_display* display, guac_socket* socket);

/**
 * Notifies the given guac_display that a specific user has left the connection
 * and need no longer be considered for future updates/events. This SHOULD
 * always be called when a user leaves the connection to ensure other future,
 * user-related events are interpreted correctly.
 *
 * @param display
 *     The guac_display to notify.
 *
 * @param user
 *     The user that left the connection.
 */
void guac_display_notify_user_left(guac_display* display, guac_user* user);

/**
 * Notifies the given guac_display that a specific user has changed the state
 * of the mouse, such as through moving the pointer or pressing/releasing a
 * mouse button. This function automatically invokes
 * guac_display_end_mouse_frame().
 *
 * NOTE: If using guac_display_render_thread, the
 * guac_display_render_thread_notify_user_moved_mouse() function should be used
 * instead. If NOT using guac_display_render_thread, care should be taken in
 * calling this function directly within a mouse_handler, as doing so
 * inherently must lock the guac_display, which can cause delays in handling
 * other received instructions like "sync".
 *
 * @param display
 *     The guac_display to notify.
 *
 * @param user
 *     The user that moved the mouse or pressed/released a mouse button.
 *
 * @param x
 *     The X position of the mouse, in pixels.
 *
 * @param y
 *     The Y position of the mouse, in pixels.
 *
 * @param mask
 *     An integer value representing the current state of each button, where
 *     the Nth bit within the integer is set to 1 if and only if the Nth mouse
 *     button is currently pressed. The lowest-order bit is the left mouse
 *     button, followed by the middle button, right button, and finally the up
 *     and down buttons of the scroll wheel.
 *
 *     @see GUAC_CLIENT_MOUSE_LEFT
 *     @see GUAC_CLIENT_MOUSE_MIDDLE
 *     @see GUAC_CLIENT_MOUSE_RIGHT
 *     @see GUAC_CLIENT_MOUSE_SCROLL_UP
 *     @see GUAC_CLIENT_MOUSE_SCROLL_DOWN
 */
void guac_display_notify_user_moved_mouse(guac_display* display, guac_user* user, int x, int y, int mask);

/**
 * Ends the current frame, where the number of input frames that were
 * considered in creating this frame is either unknown or inapplicable,
 * allowing the guac_display to complete sending the frame to connected
 * clients.
 *
 * @param display
 *     The guac_display that should send the current frame.
 */
void guac_display_end_frame(guac_display* display);

/**
 * Ends the current frame only if the user-visible changes consist purely of
 * updates to the mouse cursor position or icon. If other visible changes have
 * been made, such as graphical updates to the display itself, this function
 * has no effect.
 *
 * @param display
 *     The guac_display that should send the current frame if only the mouse
 *     cursor is visibly affected.
 */
void guac_display_end_mouse_frame(guac_display* display);

/**
 * Ends the current frame, where that frame may combine or otherwise represent the
 * changes of an arbitrary number of input frames, allowing the guac_display to
 * complete sending the frame to connected clients.
 *
 * @param display
 *     The guac_display that should send the current frame.
 *
 * @param
 *     The number of distinct frames that were considered or combined when
 *     generating the current frame, or zero if the boundaries of relevant
 *     frames are unknown.
 */
void guac_display_end_multiple_frames(guac_display* display, int frames);

/**
 * Returns the default layer for the given display. The default layer is the
 * only layer that always exists and serves as the root-level layer for all
 * other layers.
 *
 * @see GUAC_DEFAULT_LAYER
 *
 * @param display
 *     The guac_display to return the default layer from.
 *
 * @return
 *     A guac_display_layer representing the default layer for the given
 *     guac_display.
 */
guac_display_layer* guac_display_default_layer(guac_display* display);

/**
 * Allocates a new layer for the given display. The new layer will initially be
 * a direct child of the display's default layer. When the layer is no longer
 * needed, it may be freed through calling guac_display_free_layer(). If not
 * freed manually through a call to guac_display_free_layer(), it will be freed
 * when the display is freed with guac_display_free().
 *
 * @param display
 *     The guac_display to allocate a new layer for.
 *
 * @param opaque
 *     Non-zero if the new layer will only ever contain opaque image contents
 *     (the alpha channel should be ignored), zero otherwise.
 *
 * @return
 *     A newly-allocated guac_display_layer that is initially a direct child of
 *     the default layer.
 */
guac_display_layer* guac_display_alloc_layer(guac_display* display, int opaque);

/**
 * Allocates a new buffer (offscreen layer) for the given display. When the
 * buffer is no longer needed, it may be freed through calling
 * guac_display_free_layer(). If not freed manually through a call to
 * guac_display_free_layer(), it will be freed when the display is freed with
 * guac_display_free().
 *
 * @param display
 *     The guac_display to allocate a new buffer for.
 *
 * @param opaque
 *     Non-zero if the new buffer will only ever contain opaque image contents
 *     (the alpha channel should be ignored), zero otherwise.
 *
 * @return
 *     A newly-allocated guac_display_layer representing the new buffer.
 */
guac_display_layer* guac_display_alloc_buffer(guac_display* display, int opaque);

/**
 * Frees the given layer, releasing any underlying memory. If the layer has
 * already been used for rendering, it will be freed on the remote side, as
 * well, when the current pending frame is complete.
 *
 * @param display_layer
 *     The layer to free.
 */
void guac_display_free_layer(guac_display_layer* display_layer);

/**
 * Returns a layer representing the current mouse cursor icon. Changes to the
 * contents of this layer will affect the remote mouse cursor after the current
 * pending frame is complete.
 *
 * Callers should consider using guac_display_end_mouse_frame() to update
 * connected users as soon as all changes to the mouse cursor are completed.
 * Doing so avoids needing to couple changes to the mouse cursor with
 * complicated logic around changes to the remote desktop display.
 *
 * @param display
 *     The guac_display to return the cursor layer for.
 *
 * @return
 *     A guac_display_layer representing the mouse cursor of the given
 *     guac_display.
 */
guac_display_layer* guac_display_cursor(guac_display* display);

/**
 * Sets the remote mouse cursor to the given built-in cursor icon. This
 * function automatically invokes guac_display_end_mouse_frame().
 *
 * Callers should consider using guac_display_end_mouse_frame() to update
 * connected users as soon as all changes to the mouse cursor are completed.
 * Doing so avoids needing to couple changes to the mouse cursor with
 * complicated logic around changes to the remote desktop display.
 *
 * @param display
 *     The guac_display to set the cursor of.
 *
 * @param cursor_type
 *     The built-in cursor icon to set the remote cursor to.
 */
void guac_display_set_cursor(guac_display* display,
        guac_display_cursor_type cursor_type);

/**
 * Sets the hotspot location of the remote mouse cursor. The hotspot is the
 * point within the mouse cursor where the click occurs. Changes to the hotspot
 * of the remote mouse cursor will take effect after the current pending frame
 * is complete.
 *
 * Callers should consider using guac_display_end_mouse_frame() to update
 * connected users as soon as all changes to the mouse cursor are completed.
 * Doing so avoids needing to couple changes to the mouse cursor with
 * complicated logic around changes to the remote desktop display.
 *
 * @param display
 *     The guac_display to set the cursor hotspot of.
 *
 * @param x
 *     The X coordinate of the cursor hotspot, in pixels.
 *
 * @param y
 *     The Y coordinate of the cursor hotspot, in pixels.
 */
void guac_display_set_cursor_hotspot(guac_display* display, int x, int y);

/**
 * Stores the current bounding rectangle of the given layer in the given
 * guac_rect. The boundary stored will be the boundary of the current pending
 * frame.
 *
 * @oaram layer
 *     The layer to determine the dimensions of.
 *
 * @param bounds
 *     The guac_rect that should receive the bounding rectangle of the given
 *     layer.
 */
void guac_display_layer_get_bounds(guac_display_layer* layer, guac_rect* bounds);

/**
 * Moves the given layer to the given coordinates. The changes to the given
 * layer will be made as part of the current pending frame, and will not take
 * effect on remote displays until the pending frame is complete.
 *
 * @param layer
 *     The layer to set the position of.
 *
 * @param x
 *     The X coordinate of the upper-left corner of the layer, in pixels.
 *
 * @param y
 *     The Y coordinate of the upper-left corner of the layer, in pixels.
 */
void guac_display_layer_move(guac_display_layer* layer, int x, int y);

/**
 * Sets the stacking position of the given layer relative to all other sibling
 * layers (direct children of the same parent). The change in relative layer
 * stacking position will be made as part of the current pending frame, and
 * will not take effect on remote displays until the pending frame is complete.
 *
 * @param layer
 *     The layer to set the stacking position of.
 *
 * @param z
 *     The relative order of this layer.
 */
void guac_display_layer_stack(guac_display_layer* layer, int z);

/**
 * Reparents the given layer such that it is a direct child of the given parent
 * layer. The change in layer hierarchy will be made as part of the current
 * pending frame, and will not take effect on remote displays until the pending
 * frame is complete.
 *
 * @param layer
 *     The layer to change the parent of.
 *
 * @param parent
 *     The layer that should be the new parent.
 */
void guac_display_layer_set_parent(guac_display_layer* layer, const guac_display_layer* parent);

/**
 * Sets the opacity of the given layer. The change in layer opacity will be
 * made as part of the current pending frame, and will not take effect on
 * remote displays until the pending frame is complete.
 *
 * @param layer
 *     The layer to change the opacity of.
 *
 * @param opacity
 *     The opacity to assign to the given layer, as a value between 0 and 255
 *     inclusive, where 0 is completely transparent and 255 is completely
 *     opaque.
 */
void guac_display_layer_set_opacity(guac_display_layer* layer, int opacity);

/**
 * Sets whether graphical changes to the given layer are allowed to be
 * represented, updated, or sent using methods that can cause some loss of
 * information, such as JPEG or WebP compression. By default, layers are
 * allowed to use lossy methods. Changes to lossy vs. lossless behavior will
 * affect the current pending frame, as well as any frames that follow.
 *
 * @param layer
 *     The layer to change the lossy behavior of.
 *
 * @param lossless
 *     Non-zero if the layer should be allowed to use lossy methods (the
 *     default behavior), zero if the layer should use strictly lossless
 *     methods.
 */
void guac_display_layer_set_lossless(guac_display_layer* layer, int lossless);

/**
 * Sets the level of multitouch support available for the given layer. The
 * change in layer multitouch support will be made as part of the current
 * pending frame, and will not take effect on remote displays until the pending
 * frame is complete. Setting multitouch support only has any effect on the
 * default layer.
 *
 * @param layer
 *     The layer to set the multitouch support level of.
 *
 * @param touches
 *     The maximum number of simultaneous touches tracked by the layer, where 0
 *     represents no touch support.
 */
void guac_display_layer_set_multitouch(guac_display_layer* layer, int touches);

/**
 * Resizes the given layer to the given dimensions. The change in layer size
 * will be made as part of the current pending frame, and will not take effect
 * on remote displays until the pending frame is complete.
 *
 * This function will not resize the underlying buffer containing image data if
 * the layer has been manually reassociated with a different,
 * externally-maintained buffer using a guac_display_layer_raw_context. If this
 * is the case, that buffer must instead be manually maintained by the caller,
 * and resizing will typically involve replacing the buffer again.
 *
 * IMPORTANT: While it is safe to call this function while holding an open
 * context (raw or Cairo), this should only be done if the underlying buffer is
 * maintained externally or if the context is finished being used. Resizing a
 * layer can result in the underlying buffer being replaced.
 *
 * @param layer
 *     The layer to set the size of.
 *
 * @param width
 *     The new width to assign to the layer, in pixels. Any values provided
 *     that are greater than GUAC_DISPLAY_MAX_WIDTH will instead be interpreted
 *     as equal to GUAC_DISPLAY_MAX_WIDTH.
 *
 * @param height
 *     The new height to assign to the layer, in pixels. Any values provided
 *     that are greater than GUAC_DISPLAY_MAX_HEIGHT will instead be
 *     interpreted as equal to GUAC_DISPLAY_MAX_HEIGHT.
 */
void guac_display_layer_resize(guac_display_layer* layer, int width, int height);

/**
 * Begins a drawing operation for the given layer, returning a context that can
 * be used to draw directly to the raw image buffer containing the layer's
 * current pending frame.
 *
 * Starting a draw operation acquires exclusive access to the display for the
 * current thread. When complete, the original calling thread must relinquish
 * exclusive access and free the graphical context by calling
 * guac_display_layer_close_raw(). It is the responsibility of the caller to
 * ensure the dirty rect within the returned context is updated to contain the
 * region modified, such as by calling guac_rect_expand().
 *
 * @param layer
 *     The layer to draw to.
 *
 * @return
 *     A mutable graphical context containing the current raw pending frame
 *     state of the given layer.
 */
guac_display_layer_raw_context* guac_display_layer_open_raw(guac_display_layer* layer);

/**
 * Ends a drawing operation that was started with a call to
 * guac_display_layer_open_raw() and relinquishes exclusive access to the
 * display. All graphical changes made to the layer through the raw context
 * will be committed to the layer and will be included in the current pending
 * frame.
 *
 * This function MUST NOT be called by any thread other than the thread that called 
 * guac_display_layer_open_raw() to obtain the given context.
 *
 * @param layer
 *     The layer that finished being drawn to.
 *
 * @param context
 *     The raw context of the drawing operation that has completed, as returned
 *     by a previous call to guac_display_layer_open_raw().
 */
void guac_display_layer_close_raw(guac_display_layer* layer, guac_display_layer_raw_context* context);

/**
 * Fills a rectangle of image data within the given raw context with a single
 * color. All pixels within the rectangle are replaced with the given color. If
 * applicable, this includes the alpha channel. Compositing is not performed by
 * this function.
 *
 * @param context
 *     The raw context of the layer that is being drawn to.
 *
 * @param dst
 *     The rectangular area that should be filled with the given color.
 *
 * @param color
 *     The color that should replace all current pixel values within the given
 *     rectangular region.
 */
void guac_display_layer_raw_context_set(guac_display_layer_raw_context* context,
        const guac_rect* dst, uint32_t color);

/**
 * Copies a rectangle of image data from the given buffer to the given raw
 * context, replacing all pixel values within the given rectangle. Compositing
 * is not performed by this function.
 *
 * The size of the image data copied and the destination location of that data
 * within the layer are dictated by the given rectangle. If any offset needs to
 * be applied to the source image buffer, it is expected that this offset will
 * already have been applied via the address of the buffer provided to this
 * function, such as through an earlier call to GUAC_RECT_CONST_BUFFER().
 *
 * @param context
 *     The raw context of the layer that is being drawn to.
 *
 * @param dst
 *     The rectangular area that should be filled with the image data from the
 *     given buffer.
 *
 * @param buffer
 *     The containing the image data that should replace all current pixel
 *     values within the given rectangular region.
 *
 * @param stride
 *     The number of bytes in each row of image data within the given buffer.
 */
void guac_display_layer_raw_context_put(guac_display_layer_raw_context* context,
        const guac_rect* dst, const void* restrict buffer, size_t stride);

/**
 * Begins a drawing operation for the given layer, returning a context that can
 * be used to draw to a Cairo surface containing the layer's current pending
 * frame. The underlying Cairo state within the returned context will be
 * preserved between calls to guac_display_layer_open_cairo().
 *
 * Starting a draw operation acquires exclusive access to the display for the
 * current thread.  When complete, the original calling thread must relinquish
 * exclusive access and free the graphical context by calling
 * guac_display_layer_close_cairo(). It is the responsibility of the caller to
 * ensure the dirty rect within the returned context is updated to contain the
 * region modified, such as by calling guac_rect_expand().
 *
 * @param layer
 *     The layer to draw to.
 *
 * @return
 *     A mutable graphical context containing the current pending frame state
 *     of the given layer in the form of a Cairo surface.
 */
guac_display_layer_cairo_context* guac_display_layer_open_cairo(guac_display_layer* layer);

/**
 * Ends a drawing operation that was started with a call to
 * guac_display_layer_open_cairo() and relinquishes exclusive access to the
 * display. All graphical changes made to the layer through the Cairo context
 * will be committed to the layer and will be included in the current pending
 * frame.
 *
 * This function MUST NOT be called by any thread other than the thread that called 
 * guac_display_layer_open_cairo() to obtain the given context.
 *
 * @param layer
 *     The layer that finished being drawn to.
 *
 * @param context
 *     The Cairo context of the drawing operation that has completed, as
 *     returned by a previous call to guac_display_layer_open_cairo().
 */
void guac_display_layer_close_cairo(guac_display_layer* layer, guac_display_layer_cairo_context* context);

/**
 * Creates and starts a rendering thread for the given guac_display. The
 * returned thread must eventually be freed with a call to
 * guac_display_render_thread_destroy(). The rendering thread simplifies
 * efficient handling of guac_display, but is not a requirement. If your use
 * case is not well-served by the provided render thread, you can use your own
 * render loop, thread, etc.
 *
 * The render thread will finalize and send frames after being notified that
 * graphical changes have occurred, heuristically determining frame boundaries
 * based on the lull in modifications that occurs between frames. In the event
 * that modifications are made continuously without pause, the render thread
 * will finalize and send frames at a reasonable minimum rate.
 *
 * If explicit frame boundaries are available, the render thread can be
 * notified of these boundaries. Explicit boundaries will be preferred by the
 * render thread over heuristically determined boundaries.
 *
 * @see guac_display_render_thread_notify_modified()
 * @see guac_display_render_thread_notify_frame()
 *
 * @param display
 *     The display to start a rendering thread for.
 *
 * @return
 *     An opaque reference to the created, running rendering thread. This
 *     thread must be eventually freed through a call to
 *     guac_display_render_thread_destroy().
 */
guac_display_render_thread* guac_display_render_thread_create(guac_display* display);

/**
 * Notifies the given render thread that the graphical state of the display has
 * been modified in some visible way. The changes will then be included in a
 * future frame by the render thread once a frame boundary has been reached.
 * If frame boundaries are currently being determined heuristically by the
 * render thread, it is the timing of calls to this function that determine the
 * boundaries of frames.
 *
 * @param render_thread
 *     The render thread to notify of display modifications.
 */
void guac_display_render_thread_notify_modified(guac_display_render_thread* render_thread);

/**
 * Notifies the given render thread that a frame boundary has been reached.
 * Further heuristic detection of frame boundaries by the render thread will
 * stop, and all further frames must be marked through calls to this function.
 *
 * @param render_thread
 *     The render thread to notify of an explicit frame boundary.
 */
void guac_display_render_thread_notify_frame(guac_display_render_thread* render_thread);

/**
 * Notifies the given render thread that a specific user has changed the state
 * of the mouse, such as through moving the pointer or pressing/releasing a
 * mouse button.
 *
 * When using guac_display_render_thread, this function should be preferred to
 * manually invoking guac_display_notify_user_moved_mouse().
 *
 * @param render_thread
 *     The guac_display_render_thread to notify.
 *
 * @param user
 *     The user that moved the mouse or pressed/released a mouse button.
 *
 * @param x
 *     The X position of the mouse, in pixels.
 *
 * @param y
 *     The Y position of the mouse, in pixels.
 *
 * @param mask
 *     An integer value representing the current state of each button, where
 *     the Nth bit within the integer is set to 1 if and only if the Nth mouse
 *     button is currently pressed. The lowest-order bit is the left mouse
 *     button, followed by the middle button, right button, and finally the up
 *     and down buttons of the scroll wheel.
 *
 *     @see GUAC_CLIENT_MOUSE_LEFT
 *     @see GUAC_CLIENT_MOUSE_MIDDLE
 *     @see GUAC_CLIENT_MOUSE_RIGHT
 *     @see GUAC_CLIENT_MOUSE_SCROLL_UP
 *     @see GUAC_CLIENT_MOUSE_SCROLL_DOWN
 */
void guac_display_render_thread_notify_user_moved_mouse(guac_display_render_thread* render_thread,
        guac_user* user, int x, int y, int mask);

/**
 * Safely stops and frees all resources associated with the given render
 * thread. The provided pointer to the render thread is no longer valid after a
 * call to this function. The guac_display associated with the render thread is
 * unaffected.
 *
 * @param render_thread
 *     The render thread to stop and free.
 */
void guac_display_render_thread_destroy(guac_display_render_thread* render_thread);

/**
 * @}
 */

#endif
