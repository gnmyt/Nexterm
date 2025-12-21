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

#ifndef GUAC_RECORDING_H
#define GUAC_RECORDING_H

#include <guacamole/client.h>

/**
 * Provides functions and structures to be use for session recording.
 *
 * @file recording.h
 */

/**
 * The maximum numeric value allowed for the .1, .2, .3, etc. suffix appended
 * to the end of the session recording filename if a recording having the
 * requested name already exists.
 */
#define GUAC_COMMON_RECORDING_MAX_SUFFIX 255

/**
 * The maximum length of the string containing a sequential numeric suffix
 * between 1 and GUAC_COMMON_RECORDING_MAX_SUFFIX inclusive, in bytes,
 * including NULL terminator.
 */
#define GUAC_COMMON_RECORDING_MAX_SUFFIX_LENGTH 4

/**
 * The maximum overall length of the full path to the session recording file,
 * including any additional suffix and NULL terminator, in bytes.
 */
#define GUAC_COMMON_RECORDING_MAX_NAME_LENGTH 2048

/**
 * An in-progress session recording, attached to a guac_client instance such
 * that output Guacamole instructions may be dynamically intercepted and
 * written to a file.
 */
typedef struct guac_recording {

    /**
     * The guac_socket which writes directly to the recording file, rather than
     * to any particular user.
     */
    guac_socket* socket;

    /**
     * Non-zero if output which is broadcast to each connected client
     * (graphics, streams, etc.) should be included in the session recording,
     * zero otherwise. Including output is necessary for any recording which
     * must later be viewable as video.
     */
    int include_output;

    /**
     * Non-zero if changes to mouse state, such as position and buttons pressed
     * or released, should be included in the session recording, zero
     * otherwise. Including mouse state is necessary for the mouse cursor to be
     * rendered in any resulting video.
     */
    int include_mouse;

    /**
     * Non-zero if multi-touch events should be included in the session
     * recording, zero otherwise. Depending on whether the remote desktop will
     * automatically provide graphical feedback for touches, including touch
     * events may be necessary for multi-touch interactions to be rendered in
     * any resulting video.
     */
    int include_touch;

    /**
     * Non-zero if keys pressed and released should be included in the session
     * recording, zero otherwise. Including key events within the recording may
     * be necessary in certain auditing contexts, but should only be done with
     * caution. Key events can easily contain sensitive information, such as
     * passwords, credit card numbers, etc.
     */
    int include_keys;

} guac_recording;

/**
 * Replaces the socket of the given client such that all further Guacamole
 * protocol output will be copied into a file within the given path and having
 * the given name. If the create_path flag is non-zero, the given path will be
 * created if it does not yet exist. If creation of the recording file or path
 * fails, error messages will automatically be logged, and no recording will be
 * written. The recording will automatically be closed once the client is
 * freed.
 *
 * @param client
 *     The client whose output should be copied to a recording file.
 *
 * @param path
 *     The full absolute path to a directory in which the recording file should
 *     be created.
 *
 * @param name
 *     The base name to use for the recording file created within the specified
 *     path.
 *
 * @param create_path
 *     Zero if the specified path MUST exist for the recording file to be
 *     written, or non-zero if the path should be created if it does not yet
 *     exist.
 *
 * @param include_output
 *     Non-zero if output which is broadcast to each connected client
 *     (graphics, streams, etc.) should be included in the session recording,
 *     zero otherwise. Including output is necessary for any recording which
 *     must later be viewable as video.
 *
 * @param include_mouse
 *     Non-zero if changes to mouse state, such as position and buttons pressed
 *     or released, should be included in the session recording, zero
 *     otherwise. Including mouse state is necessary for the mouse cursor to be
 *     rendered in any resulting video.
 *
 * @param include_touch
 *     Non-zero if touch events should be included in the session recording,
 *     zero otherwise. Depending on whether the remote desktop will
 *     automatically provide graphical feedback for touches, including touch
 *     events may be necessary for multi-touch interactions to be rendered in
 *     any resulting video.
 *
 * @param include_keys
 *     Non-zero if keys pressed and released should be included in the session
 *     recording, zero otherwise. Including key events within the recording may
 *     be necessary in certain auditing contexts, but should only be done with
 *     caution. Key events can easily contain sensitive information, such as
 *     passwords, credit card numbers, etc.
 *
 * @param allow_write_existing
 *     Non-zero if writing to an existing file should be allowed, or zero
 *     otherwise.
 *
 * @return
 *     A new guac_recording structure representing the in-progress
 *     recording if the recording file has been successfully created and a
 *     recording will be written, NULL otherwise.
 */
guac_recording* guac_recording_create(guac_client* client,
        const char* path, const char* name, int create_path,
        int include_output, int include_mouse, int include_touch,
        int include_keys, int allow_write_existing);

/**
 * Frees the resources associated with the given in-progress recording. Note
 * that, due to the manner that recordings are attached to the guac_client, the
 * underlying guac_socket is not freed. The guac_socket will be automatically
 * freed when the guac_client is freed.
 *
 * @param recording
 *     The guac_recording to free.
 */
void guac_recording_free(guac_recording* recording);

/**
 * Reports the current mouse position and button state within the recording.
 *
 * @param recording
 *     The guac_recording associated with the mouse that has moved.
 *
 * @param x
 *     The new X coordinate of the mouse cursor, in pixels.
 *
 * @param y
 *     The new Y coordinate of the mouse cursor, in pixels.
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
void guac_recording_report_mouse(guac_recording* recording,
        int x, int y, int button_mask);

/**
 * Reports the current state of a touch contact within the recording.
 *
 * @param recording
 *     The guac_recording associated with the touch contact that
 *     has changed state.
 *
 * @param id
 *     An arbitrary integer ID which uniquely identifies this contact relative
 *     to other active contacts.
 *
 * @param x
 *     The X coordinate of the center of the touch contact.
 *
 * @param y
 *     The Y coordinate of the center of the touch contact.
 *
 * @param x_radius
 *     The X radius of the ellipse covering the general area of the touch
 *     contact, in pixels.
 *
 * @param y_radius
 *     The Y radius of the ellipse covering the general area of the touch
 *     contact, in pixels.
 *
 * @param angle
 *     The rough angle of clockwise rotation of the general area of the touch
 *     contact, in degrees.
 *
 * @param force
 *     The relative force exerted by the touch contact, where 0 is no force
 *     (the touch has been lifted) and 1 is maximum force (the maximum amount
 *     of force representable by the device).
 */
void guac_recording_report_touch(guac_recording* recording,
        int id, int x, int y, int x_radius, int y_radius,
        double angle, double force);

/**
 * Reports a change in the state of an individual key within the recording.
 *
 * @param recording
 *     The guac_recording associated with the key that was pressed or
 *     released.
 *
 * @param keysym
 *     The X11 keysym of the key that was pressed or released.
 *
 * @param pressed
 *     Non-zero if the key represented by the given keysym is currently
 *     pressed, zero if it is released.
 */
void guac_recording_report_key(guac_recording* recording,
        int keysym, int pressed);

#endif

