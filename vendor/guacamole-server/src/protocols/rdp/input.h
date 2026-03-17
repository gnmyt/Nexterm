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

#ifndef GUAC_RDP_INPUT_H
#define GUAC_RDP_INPUT_H

#include <guacamole/user.h>

/**
 * All event types supported by the guac_rdp_input_event structure.
 */
typedef enum guac_rdp_input_event_type {

    /**
     * A mouse event, such as mouse movement or press/release of a mouse
     * button.
     */
    GUAC_RDP_INPUT_EVENT_MOUSE,

    /**
     * A key event, such as press/release of a keyboard key.
     */
    GUAC_RDP_INPUT_EVENT_KEY,

    /**
     * A touch event, such as movement of an established touch or a change in
     * touch pressure.
     */
    GUAC_RDP_INPUT_EVENT_TOUCH

} guac_rdp_input_event_type;

/**
 * Event details specific to GUAC_RDP_INPUT_EVENT_MOUSE events.
 */
typedef struct guac_rdp_input_event_mouse_details {

    /**
     * The X coordinate of the mouse pointer, in pixels. This value is not
     * guaranteed to be within the bounds of the display area.
     */
    int x;

    /**
     * The Y coordinate of the mouse pointer, in pixels. This value is not
     * guaranteed to be within the bounds of the display area.
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
    int mask;

} guac_rdp_input_event_mouse_details;

/**
 * Event details specific to GUAC_RDP_INPUT_EVENT_KEY events.
 */
typedef struct guac_rdp_input_event_key_details {

    /**
     * The X11 keysym of the key that was pressed or released.
     */
    int keysym;

    /**
     * Non-zero if the key was pressed, zero if the key was released.
     */
    int pressed;

} guac_rdp_input_event_key_details;

/**
 * Event details specific to GUAC_RDP_INPUT_EVENT_TOUCH events.
 */
typedef struct guac_rdp_input_event_touch_details {

    /**
     * An arbitrary integer ID which uniquely identifies this contact relative
     * to other active contacts.
     */
    int id;

    /**
     * The X coordinate of the center of the touch contact within the display
     * when the event occurred, in pixels. This value is not guaranteed to be
     * within the bounds of the display area.
     */
    int x;

    /**
     * The Y coordinate of the center of the touch contact within the display
     * when the event occurred, in pixels. This value is not guaranteed to be
     * within the bounds of the display area.
     */
    int y;

    /**
     * The X radius of the ellipse covering the general area of the touch
     * contact, in pixels.
     */
    int x_radius;

    /**
     * The Y radius of the ellipse covering the general area of the touch
     * contact, in pixels.
     */
    int y_radius;

    /**
     * The rough angle of clockwise rotation of the general area of the touch
     * contact, in degrees.
     */
    double angle;

    /**
     * The relative force exerted by the touch contact, where 0 is no force
     * (the touch has been lifted) and 1 is maximum force (the maximum amount
     * of force representable by the device).
     */
    double force;

} guac_rdp_input_event_touch_details;

/**
 * Generic input event that may represent any one of several possible event
 * types, as dictated by guac_rdp_input_event_type. The available details of
 * the event depend on the event type.
 */
typedef struct guac_rdp_input_event {

    /**
     * The type of this event. This value dictates which event details are
     * relevant.
     */
    guac_rdp_input_event_type type;

    /**
     * The user that originated this event. NOTE: This pointer is not
     * guaranteed to be valid and MUST NOT be dereferenced without verifying
     * the pointer is actually still valid.
     */
    guac_user* user;

    /**
     * Event details that are type-specific.
     */
    union {

        /**
         * Event details specific to GUAC_RDP_INPUT_EVENT_MOUSE events. This
         * details structure MUST NOT be used for any other event type. Doing
         * otherwise may overwrite valid event details.
         */
        guac_rdp_input_event_mouse_details mouse;

        /**
         * Event details specific to GUAC_RDP_INPUT_EVENT_KEY events. This
         * details structure MUST NOT be used for any other event type. Doing
         * otherwise may overwrite valid event details.
         */
        guac_rdp_input_event_key_details key;

        /**
         * Event details specific to GUAC_RDP_INPUT_EVENT_TOUCH events. This
         * details structure MUST NOT be used for any other event type. Doing
         * otherwise may overwrite valid event details.
         */
        guac_rdp_input_event_touch_details touch;

    } details;

} guac_rdp_input_event;

/**
 * Handler for Guacamole user mouse events.
 */
guac_user_mouse_handler guac_rdp_user_mouse_handler;

/**
 * Handler for Guacamole user touch events.
 */
guac_user_touch_handler guac_rdp_user_touch_handler;

/**
 * Handler for Guacamole user key events.
 */
guac_user_key_handler guac_rdp_user_key_handler;

/**
 * Handler for Guacamole user size events.
 */
guac_user_size_handler guac_rdp_user_size_handler;

#endif

