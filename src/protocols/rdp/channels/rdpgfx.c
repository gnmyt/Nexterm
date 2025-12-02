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

#include "channels/rdpgfx.h"
#include "plugins/channels.h"
#include "rdp.h"
#include "settings.h"

#include <freerdp/client/rdpgfx.h>
#include <freerdp/freerdp.h>
#include <freerdp/gdi/gfx.h>
#include <freerdp/event.h>
#include <guacamole/client.h>

#include <stdlib.h>
#include <string.h>

/**
 * Callback which associates handlers specific to Guacamole with the
 * RdpgfxClientContext instance allocated by FreeRDP to deal with received
 * RDPGFX (Graphics Pipeline) messages.
 *
 * This function is called whenever a channel connects via the PubSub event
 * system within FreeRDP, but only has any effect if the connected channel is
 * the RDPGFX channel. This specific callback is registered with the
 * PubSub system of the relevant rdpContext when guac_rdp_rdpgfx_load_plugin() is
 * called.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 *
 * @param args
 *     Event-specific arguments, mainly the name of the channel, and a
 *     reference to the associated plugin loaded for that channel by FreeRDP.
 */
static void guac_rdp_rdpgfx_channel_connected(rdpContext* context,
        ChannelConnectedEventArgs* args) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;

    /* Ignore connection event if it's not for the RDPGFX channel */
    if (strcmp(args->name, RDPGFX_DVC_CHANNEL_NAME) != 0)
        return;

    /* Init GDI-backed support for the Graphics Pipeline */
    RdpgfxClientContext* rdpgfx = (RdpgfxClientContext*) args->pInterface;
    rdpGdi* gdi = context->gdi;

    if (!gdi_graphics_pipeline_init(gdi, rdpgfx))
        guac_client_log(client, GUAC_LOG_WARNING, "Rendering backend for RDPGFX "
                "channel could not be loaded. Graphics may not render at all!");
    else
        guac_client_log(client, GUAC_LOG_DEBUG, "RDPGFX channel will be used for "
                "the RDP Graphics Pipeline Extension.");

}

/**
 * Callback which handles any RDPGFX cleanup specific to Guacamole.
 *
 * This function is called whenever a channel disconnects via the PubSub event
 * system within FreeRDP, but only has any effect if the disconnected channel
 * is the RDPGFX channel. This specific callback is registered with the PubSub
 * system of the relevant rdpContext when guac_rdp_rdpgfx_load_plugin() is
 * called.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 *
 * @param args
 *     Event-specific arguments, mainly the name of the channel, and a
 *     reference to the associated plugin loaded for that channel by FreeRDP.
 */
static void guac_rdp_rdpgfx_channel_disconnected(rdpContext* context,
        ChannelDisconnectedEventArgs* args) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;

    /* Ignore disconnection event if it's not for the RDPGFX channel */
    if (strcmp(args->name, RDPGFX_DVC_CHANNEL_NAME) != 0)
        return;

    /* Un-init GDI-backed support for the Graphics Pipeline */
    RdpgfxClientContext* rdpgfx = (RdpgfxClientContext*) args->pInterface;
    rdpGdi* gdi = context->gdi;
    gdi_graphics_pipeline_uninit(gdi, rdpgfx);

    guac_client_log(client, GUAC_LOG_DEBUG, "RDPGFX channel support unloaded.");

}

void guac_rdp_rdpgfx_load_plugin(rdpContext* context) {

    /* Subscribe to and handle channel connected events */
    PubSub_SubscribeChannelConnected(context->pubSub,
        (pChannelConnectedEventHandler) guac_rdp_rdpgfx_channel_connected);

    /* Subscribe to and handle channel disconnected events */
    PubSub_SubscribeChannelDisconnected(context->pubSub,
        (pChannelDisconnectedEventHandler) guac_rdp_rdpgfx_channel_disconnected);

    /* Add "rdpgfx" channel */
    guac_freerdp_dynamic_channel_collection_add(context->settings, "rdpgfx", NULL);

}

