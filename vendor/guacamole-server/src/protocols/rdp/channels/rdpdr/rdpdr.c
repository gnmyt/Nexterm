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

#include "channels/rdpdr/rdpdr.h"
#include "channels/rdpdr/rdpdr-fs.h"
#include "channels/rdpdr/rdpdr-messages.h"
#include "channels/rdpdr/rdpdr-printer.h"
#include "rdp.h"
#include "settings.h"

#include <freerdp/channels/rdpdr.h>
#include <freerdp/freerdp.h>
#include <freerdp/settings.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <winpr/stream.h>

#include <stdlib.h>

void guac_rdpdr_process_receive(guac_rdp_common_svc* svc,
        wStream* input_stream) {

    int component;
    int packet_id;

    /* 
     * Check that device redirection stream contains at least 4 bytes
     * (UINT16 + UINT16).
     */
    if (Stream_GetRemainingLength(input_stream) < 4) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Device redirection "
                "channel PDU header does not contain the expected number of "
                "bytes. Device redirection may not function as expected.");
        return;
    }
    
    /* Read header */
    Stream_Read_UINT16(input_stream, component);
    Stream_Read_UINT16(input_stream, packet_id);

    /* Core component */
    if (component == RDPDR_CTYP_CORE) {

        /* Dispatch handlers based on packet ID */
        switch (packet_id) {

            case PAKID_CORE_SERVER_ANNOUNCE:
                guac_rdpdr_process_server_announce(svc, input_stream);
                break;

            case PAKID_CORE_CLIENTID_CONFIRM:
                guac_rdpdr_process_clientid_confirm(svc, input_stream);
                break;

            case PAKID_CORE_DEVICE_REPLY:
                guac_rdpdr_process_device_reply(svc, input_stream);
                break;

            case PAKID_CORE_DEVICE_IOREQUEST:
                guac_rdpdr_process_device_iorequest(svc, input_stream);
                break;

            case PAKID_CORE_SERVER_CAPABILITY:
                guac_rdpdr_process_server_capability(svc, input_stream);
                break;

            case PAKID_CORE_USER_LOGGEDON:
                guac_rdpdr_process_user_loggedon(svc, input_stream);
                break;

            default:
                guac_client_log(svc->client, GUAC_LOG_DEBUG, "Ignoring "
                        "RDPDR core packet with unexpected ID: 0x%04x",
                        packet_id);

        }

    } /* end if core */

    /* Printer component */
    else if (component == RDPDR_CTYP_PRN) {

        /* Dispatch handlers based on packet ID */
        switch (packet_id) {

            case PAKID_PRN_CACHE_DATA:
                guac_rdpdr_process_prn_cache_data(svc, input_stream);
                break;

            case PAKID_PRN_USING_XPS:
                guac_rdpdr_process_prn_using_xps(svc, input_stream);
                break;

            default:
                guac_client_log(svc->client, GUAC_LOG_DEBUG, "Ignoring RDPDR "
                        "printer packet with unexpected ID: 0x%04x",
                        packet_id);

        }

    } /* end if printer */

    else
        guac_client_log(svc->client, GUAC_LOG_DEBUG, "Ignoring packet for "
                "unknown RDPDR component: 0x%04x", component);

}

wStream* guac_rdpdr_new_io_completion(guac_rdpdr_device* device,
        unsigned int completion_id, unsigned int status, int size) {

    wStream* output_stream = Stream_New(NULL, 16+size);

    /* Write header */
    Stream_Write_UINT16(output_stream, RDPDR_CTYP_CORE);
    Stream_Write_UINT16(output_stream, PAKID_CORE_DEVICE_IOCOMPLETION);

    /* Write content */
    Stream_Write_UINT32(output_stream, device->device_id);
    Stream_Write_UINT32(output_stream, completion_id);
    Stream_Write_UINT32(output_stream, status);

    return output_stream;

}

void guac_rdpdr_process_connect(guac_rdp_common_svc* svc) {

    /* Get data from client */
    guac_client* client = svc->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    guac_rdpdr* rdpdr = (guac_rdpdr*) guac_mem_zalloc(sizeof(guac_rdpdr));
    svc->data = rdpdr;

    /* Register printer if enabled */
    if (rdp_client->settings->printing_enabled)
        guac_rdpdr_register_printer(svc, rdp_client->settings->printer_name);

    /* Register drive if enabled */
    if (rdp_client->settings->drive_enabled)
        guac_rdpdr_register_fs(svc, rdp_client->settings->drive_name);

}

void guac_rdpdr_process_terminate(guac_rdp_common_svc* svc) {

    guac_rdpdr* rdpdr = (guac_rdpdr*) svc->data;
    if (rdpdr == NULL)
        return;

    int i;

    for (i=0; i<rdpdr->devices_registered; i++) {
        guac_rdpdr_device* device = &(rdpdr->devices[i]);
        guac_client_log(svc->client, GUAC_LOG_DEBUG, "Unloading device %i "
                "(%s)", device->device_id, device->device_name);
        device->free_handler(svc, device);
    }

    guac_mem_free(svc->data); /* rdpdr */

}

void guac_rdpdr_load_plugin(rdpContext* context) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;

    /* Load support for RDPDR */
    if (guac_rdp_common_svc_load_plugin(context, "rdpdr",
                CHANNEL_OPTION_COMPRESS_RDP, guac_rdpdr_process_connect,
                guac_rdpdr_process_receive, guac_rdpdr_process_terminate)) {
        guac_client_log(client, GUAC_LOG_WARNING, "Support for the RDPDR "
                "channel (device redirection) could not be loaded. Drive "
                "redirection and printing will not work. Sound MAY not work.");
    }

}

