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

#include "channels/disp.h"
#include "channels/rdpei.h"
#include "input.h"
#include "guacamole/display.h"
#include "keyboard.h"
#include "rdp.h"
#include "settings.h"

#include <freerdp/freerdp.h>
#include <freerdp/input.h>
#include <guacamole/assert.h>
#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/recording.h>
#include <guacamole/rwlock.h>
#include <guacamole/user.h>

#include <stdlib.h>

/**
 * Processes a single mouse event, updating client state and sending any
 * associated RDP PDUs via the provided RDP client instance.
 *
 * @param rdp_client
 *     The RDP client instance that should be updated and used to send any PDUs
 *     associated with the event.
 *
 * @param event
 *     The mouse event to process.
 */
static void guac_rdp_handle_mouse_event(guac_rdp_client* rdp_client,
        const guac_rdp_input_event* event) {

    /* This function exclusively processes mouse events, and it's on the caller
     * to ensure only mouse events are provided */
    GUAC_ASSERT(event->type == GUAC_RDP_INPUT_EVENT_MOUSE);

    guac_user* user = event->user;
    int x = event->details.mouse.x;
    int y = event->details.mouse.y;
    int mask = event->details.mouse.mask;

    guac_rwlock_acquire_read_lock(&(rdp_client->lock));

    /* Skip if not yet connected */
    freerdp* rdp_inst = rdp_client->rdp_inst;
    if (rdp_inst == NULL)
        goto complete;

    /* Store current mouse location/state */
    guac_display_render_thread_notify_user_moved_mouse(rdp_client->render_thread, user, x, y, mask);

    /* Report mouse position within recording */
    if (rdp_client->recording != NULL)
        guac_recording_report_mouse(rdp_client->recording, x, y, mask);

    /* If button mask unchanged, just send move event */
    if (mask == rdp_client->mouse_button_mask) {
        pthread_mutex_lock(&(rdp_client->message_lock));
        GUAC_RDP_CONTEXT(rdp_inst)->input->MouseEvent(
                GUAC_RDP_CONTEXT(rdp_inst)->input, PTR_FLAGS_MOVE, x, y);
        pthread_mutex_unlock(&(rdp_client->message_lock));
    }

    /* Otherwise, send events describing button change */
    else {

        /* Mouse buttons which have JUST become released */
        int released_mask =  rdp_client->mouse_button_mask & ~mask;

        /* Mouse buttons which have JUST become pressed */
        int pressed_mask  = ~rdp_client->mouse_button_mask &  mask;

        /* Release event */
        if (released_mask & 0x07) {

            /* Calculate flags */
            int flags = 0;
            if (released_mask & 0x01) flags |= PTR_FLAGS_BUTTON1;
            if (released_mask & 0x02) flags |= PTR_FLAGS_BUTTON3;
            if (released_mask & 0x04) flags |= PTR_FLAGS_BUTTON2;

            pthread_mutex_lock(&(rdp_client->message_lock));
            GUAC_RDP_CONTEXT(rdp_inst)->input->MouseEvent(
                    GUAC_RDP_CONTEXT(rdp_inst)->input, flags, x, y);
            pthread_mutex_unlock(&(rdp_client->message_lock));

        }

        /* Press event */
        if (pressed_mask & 0x07) {

            /* Calculate flags */
            int flags = PTR_FLAGS_DOWN;
            if (pressed_mask & 0x01) flags |= PTR_FLAGS_BUTTON1;
            if (pressed_mask & 0x02) flags |= PTR_FLAGS_BUTTON3;
            if (pressed_mask & 0x04) flags |= PTR_FLAGS_BUTTON2;
            if (pressed_mask & 0x08) flags |= PTR_FLAGS_WHEEL | 0x78;
            if (pressed_mask & 0x10) flags |= PTR_FLAGS_WHEEL | PTR_FLAGS_WHEEL_NEGATIVE | 0x88;

            /* Send event */
            pthread_mutex_lock(&(rdp_client->message_lock));
            GUAC_RDP_CONTEXT(rdp_inst)->input->MouseEvent(
                    GUAC_RDP_CONTEXT(rdp_inst)->input, flags, x, y);
            pthread_mutex_unlock(&(rdp_client->message_lock));

        }

        /* Scroll event */
        if (pressed_mask & 0x18) {

            /* Down */
            if (pressed_mask & 0x08) {
                pthread_mutex_lock(&(rdp_client->message_lock));
                GUAC_RDP_CONTEXT(rdp_inst)->input->MouseEvent(
                        GUAC_RDP_CONTEXT(rdp_inst)->input, PTR_FLAGS_WHEEL | 0x78, x, y);
                pthread_mutex_unlock(&(rdp_client->message_lock));
            }

            /* Up */
            if (pressed_mask & 0x10) {
                pthread_mutex_lock(&(rdp_client->message_lock));
                GUAC_RDP_CONTEXT(rdp_inst)->input->MouseEvent(
                        GUAC_RDP_CONTEXT(rdp_inst)->input, PTR_FLAGS_WHEEL | PTR_FLAGS_WHEEL_NEGATIVE | 0x88, x, y);
                pthread_mutex_unlock(&(rdp_client->message_lock));
            }

        }

        rdp_client->mouse_button_mask = mask;
    }

complete:
    guac_rwlock_release_lock(&(rdp_client->lock));

}

/**
 * Processes a single key event, updating client state and sending any
 * associated RDP PDUs via the provided RDP client instance.
 *
 * @param rdp_client
 *     The RDP client instance that should be updated and used to send any PDUs
 *     associated with the event.
 *
 * @param event
 *     The key event to process.
 */
static void guac_rdp_handle_key_event(guac_rdp_client* rdp_client,
        const guac_rdp_input_event* event) {

    /* This function exclusively processes key events, and it's on the caller
     * to ensure only key events are provided */
    GUAC_ASSERT(event->type == GUAC_RDP_INPUT_EVENT_KEY);

    int keysym = event->details.key.keysym;
    int pressed = event->details.key.pressed;

    guac_rwlock_acquire_read_lock(&(rdp_client->lock));

    /* Report key state within recording */
    if (rdp_client->recording != NULL)
        guac_recording_report_key(rdp_client->recording,
                keysym, pressed);

    /* Skip if keyboard not yet ready */
    if (rdp_client->keyboard == NULL)
        goto complete;

    /* Update keysym state */
    guac_rdp_keyboard_update_keysym(rdp_client->keyboard,
                keysym, pressed, GUAC_RDP_KEY_SOURCE_CLIENT);

complete:
    guac_rwlock_release_lock(&(rdp_client->lock));

}

/**
 * Processes a single touch event, updating client state and sending any
 * associated RDP PDUs via the provided RDP client instance.
 *
 * @param rdp_client
 *     The RDP client instance that should be updated and used to send any PDUs
 *     associated with the event.
 *
 * @param event
 *     The touch event to process.
 */
static void guac_rdp_handle_touch_event(guac_rdp_client* rdp_client,
        const guac_rdp_input_event* event) {

    /* This function exclusively processes touch. events, and it's on the
     * caller to ensure only touch. events are provided */
    GUAC_ASSERT(event->type == GUAC_RDP_INPUT_EVENT_TOUCH);

    int id = event->details.touch.id;
    int x = event->details.touch.x;
    int y = event->details.touch.y;
    int x_radius = event->details.touch.x_radius;
    int y_radius = event->details.touch.y_radius;
    double angle = event->details.touch.angle;
    double force = event->details.touch.force;

    guac_rwlock_acquire_read_lock(&(rdp_client->lock));

    /* Skip if not yet connected */
    freerdp* rdp_inst = rdp_client->rdp_inst;
    if (rdp_inst == NULL)
        goto complete;

    /* Report touch event within recording */
    if (rdp_client->recording != NULL)
        guac_recording_report_touch(rdp_client->recording, id, x, y,
                x_radius, y_radius, angle, force);

    /* Forward touch event along RDPEI channel */
    guac_rdp_rdpei_touch_update(rdp_client->rdpei, id, x, y, force);

complete:
    guac_rwlock_release_lock(&(rdp_client->lock));

}

void guac_rdp_input_event_enqueue(guac_rdp_client* rdp_client,
        const guac_rdp_input_event* input_event) {

    guac_fifo_enqueue_and_lock(&rdp_client->input_events, input_event);
    SetEvent(rdp_client->input_event_queued);
    guac_fifo_unlock(&rdp_client->input_events);

}

void guac_rdp_handle_input_events(guac_rdp_client* rdp_client) {

    guac_fifo_lock(&rdp_client->input_events);

    guac_rdp_input_event input_event;
    while (guac_fifo_timed_dequeue(&rdp_client->input_events, &input_event, 0)) {
        switch (input_event.type) {

            /* Mouse event */
            case GUAC_RDP_INPUT_EVENT_MOUSE:
                guac_rdp_handle_mouse_event(rdp_client, &input_event);
                break;

            /* Keyboard event */
            case GUAC_RDP_INPUT_EVENT_KEY:
                guac_rdp_handle_key_event(rdp_client, &input_event);
                break;

            /* Touch event */
            case GUAC_RDP_INPUT_EVENT_TOUCH:
                guac_rdp_handle_touch_event(rdp_client, &input_event);
                break;

        }
    }

    ResetEvent(rdp_client->input_event_queued);
    guac_fifo_unlock(&rdp_client->input_events);

}
