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
#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/recording.h>
#include <guacamole/rwlock.h>
#include <guacamole/user.h>

#include <stdlib.h>

int guac_rdp_user_mouse_handler(guac_user* user, int x, int y, int mask) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    guac_rdp_input_event mouse_event = {
        .type = GUAC_RDP_INPUT_EVENT_MOUSE,
        .user = user,
        .details.mouse = {
            .x = x,
            .y = y,
            .mask = mask
        }
    };

    guac_rdp_input_event_enqueue(rdp_client, &mouse_event);
    return 0;

}

int guac_rdp_user_touch_handler(guac_user* user, int id, int x, int y,
        int x_radius, int y_radius, double angle, double force) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    guac_rdp_input_event touch_event = {
        .type = GUAC_RDP_INPUT_EVENT_TOUCH,
        .user = user,
        .details.touch = {
            .id = id,
            .x = x,
            .y = y,
            .x_radius = x_radius,
            .y_radius = y_radius,
            .angle = angle,
            .force = force
        }
    };

    guac_rdp_input_event_enqueue(rdp_client, &touch_event);
    return 0;

}

int guac_rdp_user_key_handler(guac_user* user, int keysym, int pressed) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    guac_rdp_input_event key_event = {
        .type = GUAC_RDP_INPUT_EVENT_KEY,
        .user = user,
        .details.key = {
            .keysym = keysym,
            .pressed = pressed
        }
    };

    guac_rdp_input_event_enqueue(rdp_client, &key_event);
    return 0;

}

int guac_rdp_user_size_handler(guac_user* user, int width, int height) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_settings* settings = rdp_client->settings;
    freerdp* rdp_inst = rdp_client->rdp_inst;

    /* Convert client pixels to remote pixels */
    width  = width  * settings->resolution / user->info.optimal_resolution;
    height = height * settings->resolution / user->info.optimal_resolution;

    /* Send display update */
    guac_rdp_disp_set_size(rdp_client->disp, settings, rdp_inst, width, height);

    return 0;

}
