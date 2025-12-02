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

#ifndef GUAC_RDP_PLUGINS_GUACAI_H
#define GUAC_RDP_PLUGINS_GUACAI_H

#include <freerdp/constants.h>
#include <freerdp/dvc.h>
#include <freerdp/freerdp.h>
#include <guacamole/client.h>

/**
 * Extended version of the IWTSListenerCallback structure, providing additional
 * access to Guacamole-specific data. The IWTSListenerCallback provides access
 * to callbacks related to the receipt of new connections to the AUDIO_INPUT
 * channel.
 */
typedef struct guac_rdp_ai_listener_callback {

    /**
     * The parent IWTSListenerCallback structure that this structure extends.
     * THIS MEMBER MUST BE FIRST!
     */
    IWTSListenerCallback parent;

    /**
     * The guac_client instance associated with the RDP connection using the
     * AUDIO_INPUT plugin.
     */
    guac_client* client;

} guac_rdp_ai_listener_callback;

/**
 * Extended version of the IWTSVirtualChannelCallback structure, providing
 * additional access to Guacamole-specific data. The IWTSVirtualChannelCallback
 * provides access to callbacks related to an active connection to the
 * AUDIO_INPUT channel, including receipt of data. 
 */
typedef struct guac_rdp_ai_channel_callback {

    /**
     * The parent IWTSVirtualChannelCallback structure that this structure
     * extends. THIS MEMBER MUST BE FIRST!
     */
    IWTSVirtualChannelCallback parent;

    /**
     * The actual virtual channel instance along which the AUDIO_INPUT plugin
     * should send any responses.
     */
    IWTSVirtualChannel* channel;

    /**
     * The guac_client instance associated with the RDP connection using the
     * AUDIO_INPUT plugin.
     */
    guac_client* client;

} guac_rdp_ai_channel_callback;

/**
 * All data associated with Guacamole's AUDIO_INPUT plugin for FreeRDP.
 */
typedef struct guac_rdp_ai_plugin {

    /**
     * The parent IWTSPlugin structure that this structure extends. THIS
     * MEMBER MUST BE FIRST!
     */
    IWTSPlugin parent;

    /**
     * The listener callback structure allocated when the AUDIO_INPUT plugin
     * was loaded, if any. If the plugin did not fully load, this will be NULL.
     * If non-NULL, this callback structure must be freed when the plugin is
     * terminated.
     */
    guac_rdp_ai_listener_callback* listener_callback;

    /**
     * The guac_client instance associated with the RDP connection using the
     * AUDIO_INPUT plugin.
     */
    guac_client* client;

} guac_rdp_ai_plugin;

#endif

