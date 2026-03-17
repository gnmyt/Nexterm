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

#ifndef GUAC_RDP_CHANNELS_DISP_H
#define GUAC_RDP_CHANNELS_DISP_H

#include "settings.h"

#include <freerdp/client/disp.h>
#include <freerdp/freerdp.h>
#include <guacamole/client.h>
#include <guacamole/timestamp.h>

/**
 * The minimum value for width or height, in pixels.
 */
#define GUAC_RDP_DISP_MIN_SIZE 200

/**
 * The maximum value for width or height, in pixels.
 */
#define GUAC_RDP_DISP_MAX_SIZE 8192

/**
 * The minimum amount of time that must elapse between display size updates,
 * in milliseconds.
 */
#define GUAC_RDP_DISP_UPDATE_INTERVAL 500

/**
 * Display size update module.
 */
typedef struct guac_rdp_disp {

    /**
     * The guac_client instance handling the relevant RDP connection.
     */
    guac_client* client;

    /**
     * Display control interface.
     */
    DispClientContext* disp;

    /**
     * The timestamp of the last display update request, or 0 if no request
     * has been sent yet.
     */
    guac_timestamp last_request;

    /**
     * The last requested screen width, in pixels.
     */
    int requested_width;

    /**
     * The last requested screen height, in pixels.
     */
    int requested_height;

    /**
     * Whether the size has changed and the RDP connection must be closed and
     * reestablished.
     */
    int reconnect_needed;

} guac_rdp_disp;

/**
 * Allocates a new display update module, which will ultimately control the
 * display update channel once connected.
 *
 * @param client
 *     The guac_client instance handling the relevant RDP connection.
 *
 * @return
 *     A newly-allocated display update module.
 */
guac_rdp_disp* guac_rdp_disp_alloc(guac_client* client);

/**
 * Frees the resources associated with support for the RDP Display Update
 * channel. Only resources specific to Guacamole are freed. Resources specific
 * to FreeRDP's handling of the Display Update channel will be freed by
 * FreeRDP. If no resources are currently allocated for Display Update support,
 * this function has no effect.
 *
 * @param disp
 *     The display update module to free.
 */
void guac_rdp_disp_free(guac_rdp_disp* disp);

/**
 * Adds FreeRDP's "disp" plugin to the list of dynamic virtual channel plugins
 * to be loaded by FreeRDP's "drdynvc" plugin. The context of the plugin will
 * automatically be associated with the guac_rdp_disp instance pointed to by the
 * current guac_rdp_client. The plugin will only be loaded once the "drdynvc"
 * plugin is loaded. The "disp" plugin ultimately adds support for the Display
 * Update channel.
 *
 * If failures occur, messages noting the specifics of those failures will be
 * logged, and the RDP side of Display Update support will not be functional.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * for Display Update support to be loaded.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 */
void guac_rdp_disp_load_plugin(rdpContext* context);

/**
 * Requests a display size update, which may then be sent immediately to the
 * RDP server. If an update was recently sent, this update may be delayed until
 * the RDP server has had time to settle. The width/height values provided may
 * be automatically altered to comply with the restrictions imposed by the
 * display update channel.
 *
 * @param disp
 *     The display update module which should maintain the requested size,
 *     sending the corresponding display update request when appropriate.
 *
 * @param settings
 *     The RDP client settings associated with the current or pending RDP
 *     session. These settings will be automatically adjusted to match the new
 *     screen size.
 *
 * @param rdp_inst
 *     The FreeRDP instance associated with the current or pending RDP session,
 *     if any. If no RDP session is active, this should be NULL.
 *
 * @param width
 *     The desired display width, in pixels. Due to the restrictions of the RDP
 *     display update channel, this will be constrained to the range of 200
 *     through 8192 inclusive, and rounded down to the nearest even number.
 *
 * @param height
 *     The desired display height, in pixels. Due to the restrictions of the
 *     RDP display update channel, this will be constrained to the range of 200
 *     through 8192 inclusive.
 */
void guac_rdp_disp_set_size(guac_rdp_disp* disp, guac_rdp_settings* settings,
        freerdp* rdp_inst, int width, int height);

/**
 * Sends an actual display update request to the RDP server based on previous
 * calls to guac_rdp_disp_set_size(). If an update was recently sent, the
 * update may be delayed until a future call to this function. If the RDP
 * session has not yet been established, the request will be delayed until the
 * session exists.
 *
 * @param disp
 *     The display update module which should track the update request.
 *
 * @param settings
 *     The RDP client settings associated with the current or pending RDP
 *     session. These settings will be automatically adjusted to match the new
 *     screen size.
 *
 * @param rdp_inst
 *     The FreeRDP instance associated with the current or pending RDP session,
 *     if any. If no RDP session is active, this should be NULL.
 */
void guac_rdp_disp_update_size(guac_rdp_disp* disp,
        guac_rdp_settings* settings, freerdp* rdp_inst);

/**
 * Signals the given display update module that the requested reconnect has
 * been performed.
 *
 * @param disp
 *     The display update module that should be signaled regarding the state
 *     of reconnection.
 */
void guac_rdp_disp_reconnect_complete(guac_rdp_disp* disp);

/**
 * Returns whether a full RDP reconnect is required for display update changes
 * to take effect.
 *
 * @param disp
 *     The display update module that should be checked to determine whether a
 *     reconnect is required.
 *
 * @return
 *     Non-zero if a reconnect is needed, zero otherwise.
 */
int guac_rdp_disp_reconnect_needed(guac_rdp_disp* disp);

#endif

