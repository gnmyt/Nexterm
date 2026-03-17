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

#include "channels/rdpei.h"
#include "plugins/channels.h"
#include "rdp.h"
#include "settings.h"

#include <freerdp/client/rdpei.h>
#include <freerdp/freerdp.h>
#include <freerdp/event.h>
#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/mem.h>
#include <guacamole/timestamp.h>

#include <stdlib.h>
#include <string.h>

guac_rdp_rdpei* guac_rdp_rdpei_alloc(guac_client* client) {

    guac_rdp_rdpei* rdpei = guac_mem_alloc(sizeof(guac_rdp_rdpei));
    rdpei->client = client;

    /* Not yet connected */
    rdpei->rdpei = NULL;

    /* No active touches */
    for (int i = 0; i < GUAC_RDP_RDPEI_MAX_TOUCHES; i++)
        rdpei->touch[i].active = 0;

    return rdpei;

}

void guac_rdp_rdpei_free(guac_rdp_rdpei* rdpei) {
    guac_mem_free(rdpei);
}

/**
 * Callback which associates handlers specific to Guacamole with the
 * RdpeiClientContext instance allocated by FreeRDP to deal with received
 * RDPEI (multi-touch input) messages.
 *
 * This function is called whenever a channel connects via the PubSub event
 * system within FreeRDP, but only has any effect if the connected channel is
 * the RDPEI channel. This specific callback is registered with the
 * PubSub system of the relevant rdpContext when guac_rdp_rdpei_load_plugin() is
 * called.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 *
 * @param args
 *     Event-specific arguments, mainly the name of the channel, and a
 *     reference to the associated plugin loaded for that channel by FreeRDP.
 */
static void guac_rdp_rdpei_channel_connected(rdpContext* context,
        ChannelConnectedEventArgs* args) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_rdpei* guac_rdpei = rdp_client->rdpei;

    /* Ignore connection event if it's not for the RDPEI channel */
    if (strcmp(args->name, RDPEI_DVC_CHANNEL_NAME) != 0)
        return;

    /* Store reference to the RDPEI plugin once it's connected */
    RdpeiClientContext* rdpei = (RdpeiClientContext*) args->pInterface;
    guac_rdpei->rdpei = rdpei;

    /* Declare level of multi-touch support */
    guac_display_layer_set_multitouch(guac_display_default_layer(rdp_client->display),
            GUAC_RDP_RDPEI_MAX_TOUCHES);

    guac_client_log(client, GUAC_LOG_DEBUG, "RDPEI channel will be used for "
            "multi-touch support.");

}

/**
 * Callback which disassociates Guacamole from the RdpeiClientContext instance
 * that was originally allocated by FreeRDP and is about to be deallocated.
 *
 * This function is called whenever a channel disconnects via the PubSub event
 * system within FreeRDP, but only has any effect if the disconnected channel
 * is the RDPEI channel. This specific callback is registered with the PubSub
 * system of the relevant rdpContext when guac_rdp_rdpei_load_plugin() is
 * called.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 *
 * @param args
 *     Event-specific arguments, mainly the name of the channel, and a
 *     reference to the associated plugin loaded for that channel by FreeRDP.
 */
static void guac_rdp_rdpei_channel_disconnected(rdpContext* context,
        ChannelDisconnectedEventArgs* args) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_rdpei* guac_rdpei = rdp_client->rdpei;

    /* Ignore disconnection event if it's not for the RDPEI channel */
    if (strcmp(args->name, RDPEI_DVC_CHANNEL_NAME) != 0)
        return;

    /* Channel is no longer connected */
    guac_rdpei->rdpei = NULL;

    guac_client_log(client, GUAC_LOG_DEBUG, "RDPDI channel disconnected.");

}

void guac_rdp_rdpei_load_plugin(rdpContext* context) {

    /* Subscribe to and handle channel connected events */
    PubSub_SubscribeChannelConnected(context->pubSub,
        (pChannelConnectedEventHandler) guac_rdp_rdpei_channel_connected);

    /* Subscribe to and handle channel disconnected events */
    PubSub_SubscribeChannelDisconnected(context->pubSub,
            (pChannelDisconnectedEventHandler) guac_rdp_rdpei_channel_disconnected);

    /* Add "rdpei" channel */
    guac_freerdp_dynamic_channel_collection_add(context->settings, "rdpei", NULL);

}

int guac_rdp_rdpei_touch_update(guac_rdp_rdpei* rdpei, int id, int x, int y,
        double force) {

    guac_client* client = rdpei->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    int contact_id; /* Ignored */

    /* Track touches only if channel is connected */
    RdpeiClientContext* context = rdpei->rdpei;
    if (context == NULL)
        return 1;

    /* Locate active touch having provided ID */
    guac_rdp_rdpei_touch* touch = NULL;
    for (int i = 0; i < GUAC_RDP_RDPEI_MAX_TOUCHES; i++) {
        if (rdpei->touch[i].active && rdpei->touch[i].id == id) {
            touch = &rdpei->touch[i];
            break;
        }
    }

    /* If no such touch exists, add it */
    if (touch == NULL) {
        for (int i = 0; i < GUAC_RDP_RDPEI_MAX_TOUCHES; i++) {
            if (!rdpei->touch[i].active) {
                touch = &rdpei->touch[i];
                touch->id = id;
                break;
            }
        }
    }

    /* If the touch couldn't be added, we're already at maximum touch capacity.
     * Drop the event. */
    if (touch == NULL)
        return 1;

    /* Signal the end of an established touch if touch force has become zero
     * (this should be a safe comparison, as zero has an exact representation
     * in floating point, and the client side will use an exact value to
     * represent the absence of a touch) */
    if (force == 0.0) {

        /* Ignore release of touches that we aren't tracking */
        if (!touch->active)
            return 1;

        pthread_mutex_lock(&(rdp_client->message_lock));
        context->TouchEnd(context, id, x, y, &contact_id);
        pthread_mutex_unlock(&(rdp_client->message_lock));

        touch->active = 0;

    }

    /* Signal the start of a touch if this is the first we've seen it */
    else if (!touch->active) {

        pthread_mutex_lock(&(rdp_client->message_lock));
        context->TouchBegin(context, id, x, y, &contact_id);
        pthread_mutex_unlock(&(rdp_client->message_lock));

        touch->active = 1;

    }

    /* Established touches need only be updated */
    else {
        pthread_mutex_lock(&(rdp_client->message_lock));
        context->TouchUpdate(context, id, x, y, &contact_id);
        pthread_mutex_unlock(&(rdp_client->message_lock));
    }

    return 0;

}

