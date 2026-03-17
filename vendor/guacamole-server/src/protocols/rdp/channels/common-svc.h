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

#ifndef GUAC_RDP_CHANNELS_COMMON_SVC_H
#define GUAC_RDP_CHANNELS_COMMON_SVC_H

#include <freerdp/freerdp.h>
#include <freerdp/svc.h>
#include <guacamole/client.h>
#include <guacamole/stream.h>
#include <winpr/stream.h>
#include <winpr/wtsapi.h>
#include <winpr/wtypes.h>

/**
 * The maximum number of bytes to allow within each channel name, including
 * null terminator.
 */
#define GUAC_RDP_SVC_MAX_LENGTH 8

/**
 * The maximum number of bytes that the RDP server will be allowed to send
 * within any single write operation, regardless of the number of chunks that
 * write is split into. Bytes beyond this limit may be dropped.
 */
#define GUAC_SVC_MAX_ASSEMBLED_LENGTH 1048576

/**
 * Structure describing a static virtual channel, and the corresponding
 * Guacamole pipes and FreeRDP resources.
 */
typedef struct guac_rdp_common_svc guac_rdp_common_svc;

/**
 * Handler which is invoked when a CHANNEL_EVENT_CONNECTED event has been
 * processed and the connection/initialization process of the SVC is now
 * complete.
 *
 * @param svc
 *     The guac_rdp_common_svc structure representing the SVC that is now
 *     connected.
 */
typedef void guac_rdp_common_svc_connect_handler(guac_rdp_common_svc* svc);

/**
 * Handler which is invoked when a logical block of data has been received
 * along an SVC, having been reassembled from a series of
 * CHANNEL_EVENT_DATA_RECEIVED events.
 *
 * @param svc
 *     The guac_rdp_common_svc structure representing the SVC that received the
 *     data.
 *
 * @param input_stream
 *     The reassembled block of data that was received.
 */
typedef void guac_rdp_common_svc_receive_handler(guac_rdp_common_svc* svc, wStream* input_stream);

/**
 * Handler which is invoked when a CHANNEL_EVENT_TERMINATED event has been
 * processed and all resources associated with the SVC must now be freed.
 *
 * @param svc
 *     The guac_rdp_common_svc structure representing the SVC that has been
 *     terminated.
 */
typedef void guac_rdp_common_svc_terminate_handler(guac_rdp_common_svc* svc);

struct guac_rdp_common_svc {

    /**
     * Reference to the client owning this static channel.
     */
    guac_client* client;

    /**
     * The name of the static virtual channel, as specified to
     * guac_rdp_common_svc_load_plugin(). This value is stored and defined
     * internally by the CHANNEL_DEF.
     */
    const char* name;

    /**
     * Arbitrary channel-specific data which may be assigned and referenced by
     * channel implementations leveraging the "guac-common-svc" plugin.
     */
    void* data;

    /**
     * Handler which is invoked when handling a CHANNEL_EVENT_CONNECTED event.
     */
    guac_rdp_common_svc_connect_handler* _connect_handler;

    /**
     * Handler which is invoked when all chunks of data for a single logical
     * block have been received via CHANNEL_EVENT_DATA_RECEIVED events and
     * reassembled.
     */
    guac_rdp_common_svc_receive_handler* _receive_handler;

    /**
     * Handler which is involved when the SVC has been disconnected and is
     * about to be freed.
     */
    guac_rdp_common_svc_terminate_handler* _terminate_handler;

    /**
     * The definition of this static virtual channel, including its name.
     */
    CHANNEL_DEF _channel_def;

    /**
     * Functions and data specific to the FreeRDP side of the virtual channel
     * and plugin.
     */
    CHANNEL_ENTRY_POINTS_FREERDP_EX _entry_points;

    /**
     * Handle which identifies the client connection, typically referred to
     * within the FreeRDP source as pInitHandle. This handle is provided to the
     * channel entry point and the channel init event handler. The handle must
     * eventually be used within the channel open event handler to obtain a
     * handle to the channel itself.
     */
    PVOID _init_handle;

    /**
     * Handle which identifies the channel itself, typically referred to within
     * the FreeRDP source as OpenHandle. This handle is obtained through a call
     * to entry_points.pVirtualChannelOpenEx() in response to receiving a
     * CHANNEL_EVENT_CONNECTED event via the init event handler.
     *
     * Data is received in CHANNEL_EVENT_DATA_RECEIVED events via the open
     * event handler, and data is written through calls to
     * entry_points.pVirtualChannelWriteEx().
     */
    DWORD _open_handle;

    /**
     * All data that has been received thus far from the current RDP server
     * write operation. Data received along virtual channels is sent in chunks
     * (typically 1600 bytes), and thus must be gradually reassembled as it is
     * received.
     */
    wStream* _input_stream;

};

/**
 * Initializes arbitrary static virtual channel (SVC) support for RDP, loading
 * a new instance of Guacamole's arbitrary SVC plugin for FreeRDP ("guacsvc")
 * supporting the channel having the given name. Data sent from within the RDP
 * session using this channel will be sent along an identically-named pipe
 * stream to the Guacamole client, and data sent along a pipe stream having the
 * same name will be written to the SVC and received within the RDP session. If
 * failures occur while loading the plugin, messages noting the specifics of
 * those failures will be logged, and support for the given channel will not be
 * functional.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * for static virtual channel support to be loaded.
 *
 * @param context
 *     The rdpContext associated with the FreeRDP side of the RDP connection.
 *
 * @param name
 *     The name of the SVC which should be handled by the new instance of the
 *     plugin.
 *
 * @param channel_options
 *     Bitwise OR of any of the several CHANNEL_OPTION_* flags. Regardless of
 *     whether specified here, the CHANNEL_OPTION_INTIALIZED and
 *     CHANNEL_OPTION_ENCRYPT_RDP flags will automatically be set.
 *
 * @param connect_handler
 *     The function to invoke when the SVC has been connected.
 *
 * @param receive_handler
 *     The function to invoke when the SVC has received a logical block of
 *     data, reassembled from perhaps several smaller chunks of data.
 *
 * @param terminate_handler
 *     The function to invoke when the SVC has been disconnected and is about
 *     to be freed.
 *
 * @return
 *     Zero if the plugin was loaded successfully, non-zero if the plugin could
 *     not be loaded.
 */
int guac_rdp_common_svc_load_plugin(rdpContext* context,
        char* name, ULONG channel_options,
        guac_rdp_common_svc_connect_handler* connect_handler,
        guac_rdp_common_svc_receive_handler* receive_handler,
        guac_rdp_common_svc_terminate_handler* terminate_handler);

/**
 * Writes the given data to the virtual channel such that it can be received
 * within the RDP session. The given data MUST be dynamically allocated, as the
 * write operation may be queued and the actual write may not occur until
 * later. The provided wStream and the buffer it points to will be
 * automatically freed after the write occurs.
 *
 * @param svc
 *     The static virtual channel to write data to.
 *
 * @param output_stream
 *     The data to write, which MUST be dynamically allocated.
 */
void guac_rdp_common_svc_write(guac_rdp_common_svc* svc,
        wStream* output_stream);

#endif

