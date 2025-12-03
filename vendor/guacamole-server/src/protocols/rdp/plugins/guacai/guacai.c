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

#include "channels/audio-input/audio-buffer.h"
#include "plugins/guacai/guacai.h"
#include "plugins/guacai/guacai-messages.h"
#include "plugins/ptr-string.h"
#include "rdp.h"

#include <freerdp/dvc.h>
#include <freerdp/settings.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <winpr/stream.h>
#include <winpr/wtsapi.h>
#include <winpr/wtypes.h>

#include <stdlib.h>

/**
 * Handles the given data received along the AUDIO_INPUT channel of the RDP
 * connection associated with the given guac_client. This handler is
 * API-independent and is invoked by API-dependent guac_rdp_ai_data callback
 * specific to the version of FreeRDP installed.
 *
 * @param client
 *     The guac_client associated with RDP connection having the AUDIO_INPUT
 *     connection along which the given data was received.
 *
 * @param channel
 *     A reference to the IWTSVirtualChannel instance along which responses
 *     should be sent.
 *
 * @param stream
 *     The data received along the AUDIO_INPUT channel.
 */
static void guac_rdp_ai_handle_data(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream) {

    /* Verify we have at least 1 byte in the stream (UINT8) */
    if (Stream_GetRemainingLength(stream) < 1) {
        guac_client_log(client, GUAC_LOG_WARNING, "Audio input PDU header does "
                "not contain the expected number of bytes. Audio input "
                "redirection may not work as expected.");
        return;
    }
    
    /* Read message ID from received PDU */
    BYTE message_id;
    Stream_Read_UINT8(stream, message_id);
    
    /* Invoke appropriate message processor based on ID */
    switch (message_id) {

        /* Version PDU */
        case GUAC_RDP_MSG_SNDIN_VERSION:
            guac_rdp_ai_process_version(client, channel, stream);
            break;

        /* Sound Formats PDU */
        case GUAC_RDP_MSG_SNDIN_FORMATS:
            guac_rdp_ai_process_formats(client, channel, stream);
            break;

        /* Open PDU */
        case GUAC_RDP_MSG_SNDIN_OPEN:
            guac_rdp_ai_process_open(client, channel, stream);
            break;

        /* Format Change PDU */
        case GUAC_RDP_MSG_SNDIN_FORMATCHANGE:
            guac_rdp_ai_process_formatchange(client, channel, stream);
            break;

        /* Log unknown message IDs */
        default:
            guac_client_log(client, GUAC_LOG_DEBUG,
                    "Unknown AUDIO_INPUT message ID: 0x%x", message_id);

    }

}

/**
 * Callback which is invoked when data is received along a connection to the
 * AUDIO_INPUT plugin.
 *
 * @param channel_callback
 *     The IWTSVirtualChannelCallback structure to which this callback was
 *     originally assigned.
 *
 * @param stream
 *     The data received.
 *
 * @return
 *     Always zero.
 */
static UINT guac_rdp_ai_data(IWTSVirtualChannelCallback* channel_callback,
        wStream* stream) {

    guac_rdp_ai_channel_callback* ai_channel_callback =
        (guac_rdp_ai_channel_callback*) channel_callback;
    IWTSVirtualChannel* channel = ai_channel_callback->channel;

    /* Invoke generalized (API-independent) data handler */
    guac_rdp_ai_handle_data(ai_channel_callback->client, channel, stream);

    return CHANNEL_RC_OK;

}

/**
 * Callback which is invoked when a connection to the AUDIO_INPUT plugin is
 * closed.
 *
 * @param channel_callback
 *     The IWTSVirtualChannelCallback structure to which this callback was
 *     originally assigned.
 *
 * @return
 *     Always zero.
 */
static UINT guac_rdp_ai_close(IWTSVirtualChannelCallback* channel_callback) {

    guac_rdp_ai_channel_callback* ai_channel_callback =
        (guac_rdp_ai_channel_callback*) channel_callback;

    guac_client* client = ai_channel_callback->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_audio_buffer* audio_buffer = rdp_client->audio_input;

    /* Log closure of AUDIO_INPUT channel */
    guac_client_log(client, GUAC_LOG_DEBUG,
            "AUDIO_INPUT channel connection closed");

    guac_rdp_audio_buffer_end(audio_buffer);
    guac_mem_free(ai_channel_callback);
    return CHANNEL_RC_OK;

}

/**
 * Callback which is invoked when a new connection is received by the
 * AUDIO_INPUT plugin. Additional callbacks required to handle received data
 * and closure of the connection must be installed at this point.
 *
 * @param listener_callback
 *     The IWTSListenerCallback structure associated with the AUDIO_INPUT
 *     plugin receiving the new connection.
 *
 * @param channel
 *     A reference to the IWTSVirtualChannel instance along which data related
 *     to the AUDIO_INPUT channel should be sent.
 *
 * @param data
 *     Absolutely no idea. According to Microsoft's documentation for the
 *     function prototype on which FreeRDP's API appears to be based: "This
 *     parameter is not implemented and is reserved for future use."
 *
 * @param accept
 *     Pointer to a flag which should be set to TRUE if the connection should
 *     be accepted or FALSE otherwise. In the case of FreeRDP, this value
 *     defaults to TRUE, and TRUE absolutely MUST be identically 1 or it will
 *     be interpreted as FALSE.
 *
 * @param channel_callback
 *     A pointer to the location that the new IWTSVirtualChannelCallback
 *     structure containing the required callbacks should be assigned.
 *
 * @return
 *     Always zero.
 */
static UINT guac_rdp_ai_new_connection(
        IWTSListenerCallback* listener_callback, IWTSVirtualChannel* channel,
        BYTE* data, int* accept,
        IWTSVirtualChannelCallback** channel_callback) {

    guac_rdp_ai_listener_callback* ai_listener_callback =
        (guac_rdp_ai_listener_callback*) listener_callback;

    /* Log new AUDIO_INPUT connection */
    guac_client_log(ai_listener_callback->client, GUAC_LOG_DEBUG,
            "New AUDIO_INPUT channel connection");

    /* Allocate new channel callback */
    guac_rdp_ai_channel_callback* ai_channel_callback =
        guac_mem_zalloc(sizeof(guac_rdp_ai_channel_callback));

    /* Init listener callback with data from plugin */
    ai_channel_callback->client = ai_listener_callback->client;
    ai_channel_callback->channel = channel;
    ai_channel_callback->parent.OnDataReceived = guac_rdp_ai_data;
    ai_channel_callback->parent.OnClose = guac_rdp_ai_close;

    /* Return callback through pointer */
    *channel_callback = (IWTSVirtualChannelCallback*) ai_channel_callback;

    return CHANNEL_RC_OK;

}

/**
 * Callback which is invoked when the AUDIO_INPUT plugin has been loaded and
 * needs to be initialized with other callbacks and data.
 *
 * @param plugin
 *     The AUDIO_INPUT plugin that needs to be initialized.
 *
 * @param manager
 *     The IWTSVirtualChannelManager instance with which the AUDIO_INPUT plugin
 *     must be registered.
 *
 * @return
 *     Always zero.
 */
static UINT guac_rdp_ai_initialize(IWTSPlugin* plugin,
        IWTSVirtualChannelManager* manager) {

    /* Allocate new listener callback */
    guac_rdp_ai_listener_callback* ai_listener_callback =
        guac_mem_zalloc(sizeof(guac_rdp_ai_listener_callback));

    /* Ensure listener callback is freed when plugin is terminated */
    guac_rdp_ai_plugin* ai_plugin = (guac_rdp_ai_plugin*) plugin;
    ai_plugin->listener_callback = ai_listener_callback;

    /* Init listener callback with data from plugin */
    ai_listener_callback->client = ai_plugin->client;
    ai_listener_callback->parent.OnNewChannelConnection =
        guac_rdp_ai_new_connection;

    /* Register listener for "AUDIO_INPUT" channel */
    manager->CreateListener(manager, "AUDIO_INPUT", 0,
            (IWTSListenerCallback*) ai_listener_callback, NULL);

    return CHANNEL_RC_OK;

}

/**
 * Callback which is invoked when all connections to the AUDIO_INPUT plugin
 * have closed and the plugin is being unloaded.
 *
 * @param plugin
 *     The AUDIO_INPUT plugin being unloaded.
 *
 * @return
 *     Always zero.
 */
static UINT guac_rdp_ai_terminated(IWTSPlugin* plugin) {

    guac_rdp_ai_plugin* ai_plugin = (guac_rdp_ai_plugin*) plugin;
    guac_client* client = ai_plugin->client;

    /* Free all non-FreeRDP data */
    guac_mem_free(ai_plugin->listener_callback);
    guac_mem_free(ai_plugin);

    guac_client_log(client, GUAC_LOG_DEBUG, "AUDIO_INPUT plugin unloaded.");
    return CHANNEL_RC_OK;

}

/**
 * Entry point for AUDIO_INPUT dynamic virtual channel.
 */
UINT DVCPluginEntry(IDRDYNVC_ENTRY_POINTS* pEntryPoints) {

    /* Pull guac_client from arguments */
#ifdef PLUGIN_DATA_CONST
    const ADDIN_ARGV* args = pEntryPoints->GetPluginData(pEntryPoints);
#else
    ADDIN_ARGV* args = pEntryPoints->GetPluginData(pEntryPoints);
#endif

    guac_client* client = (guac_client*) guac_rdp_string_to_ptr(args->argv[1]);

    /* Pull previously-allocated plugin */
    guac_rdp_ai_plugin* ai_plugin = (guac_rdp_ai_plugin*)
        pEntryPoints->GetPlugin(pEntryPoints, "guacai");

    /* If no such plugin allocated, allocate and register it now */
    if (ai_plugin == NULL) {

        /* Init plugin callbacks and data */
        ai_plugin = guac_mem_zalloc(sizeof(guac_rdp_ai_plugin));
        ai_plugin->parent.Initialize = guac_rdp_ai_initialize;
        ai_plugin->parent.Terminated = guac_rdp_ai_terminated;
        ai_plugin->client = client;

        /* Register plugin as "guacai" for later retrieval */
        pEntryPoints->RegisterPlugin(pEntryPoints, "guacai",
                (IWTSPlugin*) ai_plugin);

        guac_client_log(client, GUAC_LOG_DEBUG, "AUDIO_INPUT plugin loaded.");
    }

    return CHANNEL_RC_OK;

}
