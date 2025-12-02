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

#ifndef GUAC_RDP_CHANNELS_RDPEI_H
#define GUAC_RDP_CHANNELS_RDPEI_H

#include "settings.h"

#include <freerdp/client/rdpei.h>
#include <freerdp/freerdp.h>
#include <guacamole/client.h>
#include <guacamole/timestamp.h>

/**
 * The maximum number of simultaneously-tracked touches.
 */
#define GUAC_RDP_RDPEI_MAX_TOUCHES 10

/**
 * A single, tracked touch contact.
 */
typedef struct guac_rdp_rdpei_touch {

    /**
     * Whether this touch is active (1) or inactive (0). An active touch is
     * being tracked, while an inactive touch is simple an empty space awaiting
     * use by some future touch event.
     */
    int active;

    /**
     * The unique ID representing this touch contact.
     */
    int id;

    /**
     * The X-coordinate of this touch, in pixels.
     */
    int x;

    /**
     * The Y-coordinate of this touch, in pixels.
     */
    int y;

} guac_rdp_rdpei_touch;

/**
 * Multi-touch input module.
 */
typedef struct guac_rdp_rdpei {

    /**
     * The guac_client instance handling the relevant RDP connection.
     */
    guac_client* client;

    /**
     * RDPEI control interface.
     */
    RdpeiClientContext* rdpei;

    /**
     * All currently-tracked touches.
     */
    guac_rdp_rdpei_touch touch[GUAC_RDP_RDPEI_MAX_TOUCHES];

} guac_rdp_rdpei;

/**
 * Allocates a new RDPEI module, which will ultimately control the RDPEI
 * channel once connected. The RDPEI channel allows multi-touch input
 * events to be sent to the RDP server.
 *
 * @param client
 *     The guac_client instance handling the relevant RDP connection.
 *
 * @return
 *     A newly-allocated RDPEI module.
 */
guac_rdp_rdpei* guac_rdp_rdpei_alloc(guac_client* client);

/**
 * Frees the resources associated with support for the RDPEI channel. Only
 * resources specific to Guacamole are freed. Resources specific to FreeRDP's
 * handling of the RDPEI channel will be freed by FreeRDP. If no resources are
 * currently allocated for RDPEI, this function has no effect.
 *
 * @param rdpei
 *     The RDPEI module to free.
 */
void guac_rdp_rdpei_free(guac_rdp_rdpei* rdpei);

/**
 * Adds FreeRDP's "rdpei" plugin to the list of dynamic virtual channel plugins
 * to be loaded by FreeRDP's "drdynvc" plugin. The context of the plugin will
 * automatically be associated with the guac_rdp_rdpei instance pointed to by the
 * current guac_rdp_client. The plugin will only be loaded once the "drdynvc"
 * plugin is loaded. The "rdpei" plugin ultimately adds support for multi-touch
 * input via the RDPEI channel.
 *
 * If failures occur, messages noting the specifics of those failures will be
 * logged, and the RDP side of multi-touch support will not be functional.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * for multi-touch support to be loaded.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 */
void guac_rdp_rdpei_load_plugin(rdpContext* context);

/**
 * Reports to the RDP server that the status of a single touch contact has
 * changed. Depending on the amount of force associated with the touch and
 * whether the touch has been encountered before, this will result a new touch
 * contact, updates to an existing contact, or removal of an existing contact.
 * If the RDPEI channel has not yet been connected, touches will be ignored and
 * dropped until it is connected.
 *
 * @param rdpei
 *     The RDPEI module associated with the RDP session.
 *
 * @param id
 *     An arbitrary integer ID unique to the touch being updated.
 *
 * @param x
 *     The X-coordinate of the touch, in pixels.
 *
 * @param y
 *     The Y-coordinate of the touch, in pixels.
 *
 * @param force
 *     The amount of force currently being exerted on the device by the touch
 *     contact in question, where 1.0 is the maximum amount of force
 *     representable and 0.0 indicates the contact has been lifted.
 *
 * @return
 *     Zero if the touch event was successfully processed, non-zero if the
 *     touch event had to be dropped.
 */
int guac_rdp_rdpei_touch_update(guac_rdp_rdpei* rdpei, int id, int x, int y,
        double force);

#endif

