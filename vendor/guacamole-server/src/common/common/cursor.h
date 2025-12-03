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

#ifndef GUAC_COMMON_CURSOR_H
#define GUAC_COMMON_CURSOR_H

#include "surface.h"

#include <cairo/cairo.h>
#include <guacamole/client.h>
#include <guacamole/socket.h>
#include <guacamole/user.h>

/**
 * The default size of the cursor image buffer.
 */
#define GUAC_COMMON_CURSOR_DEFAULT_SIZE 64*64*4

/**
 * Cursor object which maintains and synchronizes the current mouse cursor
 * state across all users of a specific client.
 */
typedef struct guac_common_cursor {

    /**
     * The client to maintain the mouse cursor for.
     */
    guac_client* client;

    /**
     * The buffer containing the current cursor image.
     */
    guac_layer* buffer;

    /**
     * The width of the cursor image, in pixels.
     */
    int width;

    /**
     * The height of the cursor image, in pixels.
     */
    int height;

    /**
     * Arbitrary image data buffer, backing the Cairo surface used to store
     * the cursor image.
     */
    unsigned char* image_buffer;

    /**
     * The size of the image data buffer, in bytes.
     */
    size_t image_buffer_size;

    /**
     * The current cursor image, if any. If the mouse cursor has not yet been
     * set, this will be NULL.
     */
    cairo_surface_t* surface;

    /**
     * The X coordinate of the hotspot of the mouse cursor.
     */
    int hotspot_x;

    /**
     * The Y coordinate of the hotspot of the mouse cursor.
     */
    int hotspot_y;

    /**
     * The last user to move the mouse, or NULL if no user has moved the
     * mouse yet.
     */
    guac_user* user;

    /**
     * The X coordinate of the current mouse cursor location.
     */
    int x;

    /**
     * The Y coordinate of the current mouse cursor location.
     */
    int y;

    /**
     * An integer value representing the current state of each button, where
     * the Nth bit within the integer is set to 1 if and only if the Nth mouse
     * button is currently pressed. The lowest-order bit is the left mouse
     * button, followed by the middle button, right button, and finally the up
     * and down buttons of the scroll wheel.
     *
     * @see GUAC_CLIENT_MOUSE_LEFT
     * @see GUAC_CLIENT_MOUSE_MIDDLE
     * @see GUAC_CLIENT_MOUSE_RIGHT
     * @see GUAC_CLIENT_MOUSE_SCROLL_UP
     * @see GUAC_CLIENT_MOUSE_SCROLL_DOWN
     */
    int button_mask;

    /**
     * The server timestamp representing the point in time when the mouse
     * location was last updated.
     */
    guac_timestamp timestamp;

    /**
     * Lock which restricts simultaneous access to the cursor, guaranteeing
     * ordered modifications to the cursor and that incompatible operations
     * do not occur simultaneously. This lock is for internal use within the
     * cursor only.
     */
    pthread_mutex_t _lock;

} guac_common_cursor;

/**
 * Allocates a new cursor object which maintains and synchronizes the current
 * mouse cursor state across all users of the given client.
 *
 * @param client
 *     The client for which this object shall maintain the mouse cursor.
 *
 * @return
 *     The newly-allocated mouse cursor.
 */
guac_common_cursor* guac_common_cursor_alloc(guac_client* client);

/**
 * Frees the given cursor.
 *
 * @param cursor
 *     The cursor to free.
 */
void guac_common_cursor_free(guac_common_cursor* cursor);

/**
 * Sends the current state of this cursor across the given socket, including
 * the current cursor image. The resulting cursor on the remote display will
 * be visible.
 *
 * @param cursor
 *     The cursor to send.
 *
 * @param client
 *     The user receiving the updated cursor.
 *
 * @param socket
 *     The socket over which the updated cursor should be sent.
 */
void guac_common_cursor_dup(
        guac_common_cursor* cursor, guac_client* client, guac_socket* socket);

/**
 * Updates the current position and button state of the mouse cursor, marking
 * the given user as the most recent user of the mouse. The remote mouse cursor
 * will be hidden for this user and shown for all others.
 *
 * @param cursor
 *     The cursor being updated.
 *
 * @param user
 *     The user that moved the cursor.
 *
 * @param x
 *     The new X coordinate of the cursor.
 *
 * @param y
 *     The new Y coordinate of the cursor.
 *
 * @param button_mask
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
void guac_common_cursor_update(guac_common_cursor* cursor, guac_user* user,
        int x, int y, int button_mask);

/**
 * Sets the cursor image to the given raw image data. This raw image data must
 * be in 32-bit ARGB format, having 8 bits per color component, where the
 * alpha component is stored in the high-order 8 bits, and blue is stored
 * in the low-order 8 bits.
 *
 * @param cursor
 *     The cursor to set the image of.
 *
 * @param hx
 *     The X coordinate of the hotspot of the new cursor image.
 *
 * @param hy
 *     The Y coordinate of the hotspot of the new cursor image.
 *
 * @param data
 *     A pointer to raw 32-bit ARGB image data.
 *
 * @param width
 *     The width of the given image data, in pixels.
 *
 * @param height
 *     The height of the given image data, in pixels.
 *
 * @param stride
 *     The number of bytes in a single row of image data.
 */
void guac_common_cursor_set_argb(guac_common_cursor* cursor, int hx, int hy,
    unsigned const char* data, int width, int height, int stride);

/**
 * Sets the cursor image to the contents of the given surface. The entire
 * contents of the surface are used, and the dimensions of the resulting
 * cursor will be the dimensions of the given surface.
 *
 * @param cursor
 *     The cursor to set the image of.
 *
 * @param hx
 *     The X coordinate of the hotspot of the new cursor image.
 *
 * @param hy
 *     The Y coordinate of the hotspot of the new cursor image.
 *
 * @param surface
 *     The surface containing the cursor image.
 */
void guac_common_cursor_set_surface(guac_common_cursor* cursor, int hx, int hy,
    guac_common_surface* surface);

/**
 * Set the cursor of the remote display to the embedded "pointer" graphic. The
 * pointer graphic is a black arrow with white border.
 *
 * @param cursor
 *     The cursor to set the image of.
 */
void guac_common_cursor_set_pointer(guac_common_cursor* cursor);

/**
 * Set the cursor of the remote display to the embedded "dot" graphic. The dot
 * graphic is a small black square with white border.
 *
 * @param cursor
 *     The cursor to set the image of.
 */
void guac_common_cursor_set_dot(guac_common_cursor* cursor);

/**
 * Sets the cursor of the remote display to the embedded "I-bar" graphic. The
 * I-bar graphic is a small black "I" shape with white border, used to indicate
 * the presence of selectable or editable text.
 *
 * @param cursor
 *     The cursor to set the image of.
 */
void guac_common_cursor_set_ibar(guac_common_cursor* cursor);

/**
 * Sets the cursor of the remote display to the embedded transparent (blank)
 * graphic, effectively hiding the mouse cursor.
 *
 * @param cursor
 *     The cursor to set the image of.
 */
void guac_common_cursor_set_blank(guac_common_cursor* cursor);

/**
 * Removes the given user, such that future synchronization will not occur.
 * This is necessary when a user leaves the connection. If a user leaves the
 * connection and this is not called, the mouse cursor state may not update
 * correctly in response to mouse events.
 *
 * @param cursor
 *     The cursor to remove the user from.
 *
 * @param user
 *     The user to remove.
 */
void guac_common_cursor_remove_user(guac_common_cursor* cursor,
        guac_user* user);

#endif
