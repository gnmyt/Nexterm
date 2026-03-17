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

#include "channels/common-svc.h"
#include "plugins/channels.h"
#include "rdp.h"

#include <freerdp/settings.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/string.h>
#include <winpr/stream.h>
#include <winpr/wtsapi.h>
#include <winpr/wtypes.h>

#include <stdlib.h>

int guac_rdp_common_svc_load_plugin(rdpContext* context,
        char* name, ULONG channel_options,
        guac_rdp_common_svc_connect_handler* connect_handler,
        guac_rdp_common_svc_receive_handler* receive_handler,
        guac_rdp_common_svc_terminate_handler* terminate_handler) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;

    guac_rdp_common_svc* svc = guac_mem_zalloc(sizeof(guac_rdp_common_svc));
    svc->client = client;
    svc->name = svc->_channel_def.name;
    svc->_connect_handler = connect_handler;
    svc->_receive_handler = receive_handler;
    svc->_terminate_handler = terminate_handler;

    /* Init FreeRDP channel definition */
    int name_length = guac_strlcpy(svc->_channel_def.name, name, GUAC_RDP_SVC_MAX_LENGTH);
    svc->_channel_def.options =
          CHANNEL_OPTION_INITIALIZED
        | CHANNEL_OPTION_ENCRYPT_RDP
        | channel_options;

    /* Warn about name length */
    if (name_length >= GUAC_RDP_SVC_MAX_LENGTH)
        guac_client_log(client, GUAC_LOG_WARNING,
                "Static channel name \"%s\" exceeds maximum length of %i "
                "characters and will be truncated to \"%s\".",
                name, GUAC_RDP_SVC_MAX_LENGTH - 1, svc->name);

    /* Attempt to load the common SVC plugin for new static channel */
    int result = guac_freerdp_channels_load_plugin(context, "guac-common-svc", svc);
    if (result) {
        guac_client_log(client, GUAC_LOG_WARNING, "Cannot create static "
                "channel \"%s\": failed to load \"guac-common-svc\" plugin "
                "for FreeRDP.", svc->name);
        guac_mem_free(svc);
    }

    /* Store and log on success (SVC structure will be freed on channel termination) */
    else
        guac_client_log(client, GUAC_LOG_DEBUG, "Support for static channel "
                "\"%s\" loaded.", svc->name);

    return result;

}

void guac_rdp_common_svc_write(guac_rdp_common_svc* svc,
        wStream* output_stream) {

    /* Do not write if plugin not associated */
    if (!svc->_open_handle) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "%i bytes of data "
                "written to SVC \"%s\" are being dropped because the remote "
                "desktop side of that SVC is not yet connected.",
                Stream_Length(output_stream), svc->name);
        return;
    }

    guac_rdp_client* rdp_client = (guac_rdp_client*) svc->client->data;

    /* NOTE: The wStream sent via pVirtualChannelWriteEx will automatically be
     * freed later with a call to Stream_Free() when handling the
     * corresponding write cancel/completion event. */
    pthread_mutex_lock(&(rdp_client->message_lock));
    svc->_entry_points.pVirtualChannelWriteEx(svc->_init_handle,
            svc->_open_handle, Stream_Buffer(output_stream),
            Stream_GetPosition(output_stream), output_stream);
    pthread_mutex_unlock(&(rdp_client->message_lock));

}

