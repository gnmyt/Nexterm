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

#include "config.h"
#include "channels/common-svc.h"

#include <freerdp/svc.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <winpr/stream.h>
#include <winpr/wtsapi.h>
#include <winpr/wtypes.h>

#include <stdlib.h>

/**
 * Event handler for events which deal with data transmitted over an open SVC,
 * including receipt of inbound data and completion of outbound writes.
 *
 * The FreeRDP requirements for this function follow those of the
 * VirtualChannelOpenEventEx callback defined within Microsoft's RDP API:
 *
 * https://docs.microsoft.com/en-us/previous-versions/windows/embedded/aa514754%28v%3dmsdn.10%29
 *
 * @param user_param
 *     The pointer to arbitrary data originally passed via the first parameter
 *     of the pVirtualChannelInitEx() function call when the associated channel
 *     was initialized. The pVirtualChannelInitEx() function is exposed within
 *     the channel entry points structure.
 *
 * @param open_handle
 *     The handle which identifies the channel itself, typically referred to
 *     within the FreeRDP source as OpenHandle.
 *
 * @param event
 *     An integer representing the event that should be handled. This will be
 *     either CHANNEL_EVENT_DATA_RECEIVED, CHANNEL_EVENT_WRITE_CANCELLED, or
 *     CHANNEL_EVENT_WRITE_COMPLETE.
 *
 * @param data
 *     The data received, for CHANNEL_EVENT_DATA_RECEIVED events, and the value
 *     passed as user data to pVirtualChannelWriteEx() for
 *     CHANNEL_EVENT_WRITE_* events (note that user data for
 *     pVirtualChannelWriteEx() as implemented by FreeRDP MUST either be NULL
 *     or a wStream containing the data written).
 *
 * @param data_length
 *     The number of bytes of event-specific data.
 *
 * @param total_length
 *     The total number of bytes expected to be received from the RDP server
 *     due to this single write (from the server's perspective). Each write may
 *     actually be split into multiple chunks, thus resulting in multiple
 *     receive events for the same logical block of data. The relationship
 *     between chunks is indicated with the CHANNEL_FLAG_FIRST and
 *     CHANNEL_FLAG_LAST flags.
 *
 * @param data_flags
 *     The result of a bitwise OR of the CHANNEL_FLAG_* flags which apply to
 *     the data received. This value is relevant only to
 *     CHANNEL_EVENT_DATA_RECEIVED events. Valid flags are CHANNEL_FLAG_FIRST,
 *     CHANNEL_FLAG_LAST, and CHANNEL_FLAG_ONLY. The flag CHANNEL_FLAG_MIDDLE
 *     is not itself a flag, but the absence of both CHANNEL_FLAG_FIRST and
 *     CHANNEL_FLAG_LAST.
 */
static VOID guac_rdp_common_svc_handle_open_event(LPVOID user_param,
        DWORD open_handle, UINT event, LPVOID data, UINT32 data_length,
        UINT32 total_length, UINT32 data_flags) {

#ifndef FREERDP_SVC_CORE_FREES_WSTREAM
    /* Free stream data after send is complete */
    if ((event == CHANNEL_EVENT_WRITE_CANCELLED
            || event == CHANNEL_EVENT_WRITE_COMPLETE) && data != NULL) {
        Stream_Free((wStream*) data, TRUE);
        return;
    }
#endif

    /* Ignore all events except for received data */
    if (event != CHANNEL_EVENT_DATA_RECEIVED)
        return;

    guac_rdp_common_svc* svc = (guac_rdp_common_svc*) user_param;

    /* Validate relevant handle matches that of SVC */
    if (open_handle != svc->_open_handle) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "%i bytes of data "
                "received from within the remote desktop session for SVC "
                "\"%s\" are being dropped because the relevant open handle "
                "(0x%X) does not match the open handle of the SVC (0x%X).",
                data_length, svc->name, open_handle, svc->_open_handle);
        return;
    }

    /* If receiving first chunk, allocate sufficient space for all remaining
     * chunks */
    if (data_flags & CHANNEL_FLAG_FIRST) {

        /* Limit maximum received size */
        if (total_length > GUAC_SVC_MAX_ASSEMBLED_LENGTH) {
            guac_client_log(svc->client, GUAC_LOG_WARNING, "RDP server has "
                    "requested to send a sequence of %i bytes, but this "
                    "exceeds the maximum buffer space of %i bytes. Received "
                    "data may be truncated.", total_length,
                    GUAC_SVC_MAX_ASSEMBLED_LENGTH);
            total_length = GUAC_SVC_MAX_ASSEMBLED_LENGTH;
        }

        svc->_input_stream = Stream_New(NULL, total_length);
    }

    /* leave if we don't have a stream. */
    if (svc->_input_stream == NULL)
        return;
    
    /* Add chunk to buffer only if sufficient space remains */
    if (Stream_EnsureRemainingCapacity(svc->_input_stream, data_length))
        Stream_Write(svc->_input_stream, data, data_length);
    else
        guac_client_log(svc->client, GUAC_LOG_WARNING, "%i bytes of data "
                "received from within the remote desktop session for SVC "
                "\"%s\" are being dropped because the maximum available "
                "space for received data has been exceeded.", data_length,
                svc->name);

    /* Fire event once last chunk has been received */
    if (data_flags & CHANNEL_FLAG_LAST) {

        Stream_SealLength(svc->_input_stream);
        Stream_SetPosition(svc->_input_stream, 0);

        /* Handle channel-specific data receipt tasks, if any */
        if (svc->_receive_handler)
            svc->_receive_handler(svc, svc->_input_stream);

        Stream_Free(svc->_input_stream, TRUE);
        svc->_input_stream = NULL;

    }

}

/**
 * Processes a CHANNEL_EVENT_CONNECTED event, completing the
 * connection/initialization process of the channel.
 *
 * @param rdpsnd
 *     The guac_rdp_common_svc structure representing the channel.
 */
static void guac_rdp_common_svc_process_connect(guac_rdp_common_svc* svc) {

    /* Open FreeRDP side of connected channel */
    UINT32 open_status =
        svc->_entry_points.pVirtualChannelOpenEx(svc->_init_handle,
                &svc->_open_handle, svc->_channel_def.name,
                guac_rdp_common_svc_handle_open_event);

    /* Warn if the channel cannot be opened after all */
    if (open_status != CHANNEL_RC_OK) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "SVC \"%s\" could not "
                "be opened: %s (error %i)", svc->name,
                WTSErrorToString(open_status), open_status);
        return;
    }

    /* Handle channel-specific connect tasks, if any */
    if (svc->_connect_handler)
        svc->_connect_handler(svc);

    /* Channel is now ready */
    guac_client_log(svc->client, GUAC_LOG_DEBUG, "SVC \"%s\" connected.",
            svc->name);

}

/**
 * Processes a CHANNEL_EVENT_TERMINATED event, freeing all resources associated
 * with the channel.
 *
 * @param svc
 *     The guac_rdp_common_svc structure representing the channel.
 */
static void guac_rdp_common_svc_process_terminate(guac_rdp_common_svc* svc) {

    /* Handle channel-specific termination tasks, if any */
    if (svc->_terminate_handler)
        svc->_terminate_handler(svc);

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "SVC \"%s\" disconnected.",
            svc->name);
    guac_mem_free(svc);

}

/**
 * Event handler for events which deal with the overall lifecycle of an SVC.
 * This specific implementation of the event handler currently handles only
 * CHANNEL_EVENT_CONNECTED and CHANNEL_EVENT_TERMINATED events, delegating
 * actual handling of those events to guac_rdp_common_svc_process_connect() and
 * guac_rdp_common_svc_process_terminate() respectively.
 *
 * The FreeRDP requirements for this function follow those of the
 * VirtualChannelInitEventEx callback defined within Microsoft's RDP API:
 *
 * https://docs.microsoft.com/en-us/previous-versions/windows/embedded/aa514727%28v%3dmsdn.10%29
 *
 * @param user_param
 *     The pointer to arbitrary data originally passed via the first parameter
 *     of the pVirtualChannelInitEx() function call when the associated channel
 *     was initialized. The pVirtualChannelInitEx() function is exposed within
 *     the channel entry points structure.
 *
 * @param init_handle
 *     The handle which identifies the client connection, typically referred to
 *     within the FreeRDP source as pInitHandle.
 *
 * @param event
 *     An integer representing the event that should be handled. This will be
 *     either CHANNEL_EVENT_CONNECTED, CHANNEL_EVENT_DISCONNECTED,
 *     CHANNEL_EVENT_INITIALIZED, CHANNEL_EVENT_TERMINATED, or
 *     CHANNEL_EVENT_V1_CONNECTED.
 *
 * @param data
 *     NULL in all cases except the CHANNEL_EVENT_CONNECTED event, in which
 *     case this is a null-terminated string containing the name of the server.
 *
 * @param data_length
 *     The number of bytes of data, if any.
 */
static VOID guac_rdp_common_svc_handle_init_event(LPVOID user_param,
        LPVOID init_handle, UINT event, LPVOID data, UINT data_length) {

    guac_rdp_common_svc* svc = (guac_rdp_common_svc*) user_param;

    /* Validate relevant handle matches that of SVC */
    if (init_handle != svc->_init_handle) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "An init event (#%i) "
                "for SVC \"%s\" has been dropped because the relevant init "
                "handle (0x%X) does not match the init handle of the SVC "
                "(0x%X).", event, svc->name, init_handle, svc->_init_handle);
        return;
    }

    switch (event) {

        /* The remote desktop side of the SVC has been connected */
        case CHANNEL_EVENT_CONNECTED:
            guac_rdp_common_svc_process_connect(svc);
            break;

        /* The channel has disconnected and now must be cleaned up */
        case CHANNEL_EVENT_TERMINATED:
            guac_rdp_common_svc_process_terminate(svc);
            break;

    }

}

/**
 * Entry point for FreeRDP plugins. This function is automatically invoked when
 * the plugin is loaded.
 *
 * @param entry_points
 *     Functions and data specific to the FreeRDP side of the virtual channel
 *     and plugin. This structure must be copied within implementation-specific
 *     storage such that the functions it references can be invoked when
 *     needed.
 *
 * @param init_handle
 *     The handle which identifies the client connection, typically referred to
 *     within the FreeRDP source as pInitHandle. This handle is also provided
 *     to the channel init event handler. The handle must eventually be used
 *     within the channel open event handler to obtain a handle to the channel
 *     itself.
 *
 * @return
 *     TRUE if the plugin has initialized successfully, FALSE otherwise.
 */
BOOL VirtualChannelEntryEx(PCHANNEL_ENTRY_POINTS_EX entry_points,
        PVOID init_handle) {

    CHANNEL_ENTRY_POINTS_FREERDP_EX* entry_points_ex =
        (CHANNEL_ENTRY_POINTS_FREERDP_EX*) entry_points;

    /* Get structure representing the Guacamole side of the SVC from plugin
     * parameters */
    guac_rdp_common_svc* svc = (guac_rdp_common_svc*) entry_points_ex->pExtendedData;

    /* Copy FreeRDP data into SVC structure for future reference */
    svc->_entry_points = *entry_points_ex;
    svc->_init_handle = init_handle;

    /* Complete initialization */
    if (svc->_entry_points.pVirtualChannelInitEx(svc, NULL, init_handle,
                &svc->_channel_def, 1, VIRTUAL_CHANNEL_VERSION_WIN2000,
                guac_rdp_common_svc_handle_init_event) != CHANNEL_RC_OK) {
        return FALSE;
    }

    return TRUE;

}

