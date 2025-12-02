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

#include "channels/rdpdr/rdpdr-fs.h"
#include "channels/rdpdr/rdpdr-fs-messages.h"
#include "channels/rdpdr/rdpdr.h"
#include "rdp.h"

#include <freerdp/channels/rdpdr.h>
#include <freerdp/settings.h>
#include <guacamole/client.h>
#include <guacamole/unicode.h>
#include <winpr/stream.h>

#include <stddef.h>

void guac_rdpdr_device_fs_iorequest_handler(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    switch (iorequest->major_func) {

        /* File open */
        case IRP_MJ_CREATE:
            guac_rdpdr_fs_process_create(svc, device, iorequest, input_stream);
            break;

        /* File close */
        case IRP_MJ_CLOSE:
            guac_rdpdr_fs_process_close(svc, device, iorequest, input_stream);
            break;

        /* File read */
        case IRP_MJ_READ:
            guac_rdpdr_fs_process_read(svc, device, iorequest, input_stream);
            break;

        /* File write */
        case IRP_MJ_WRITE:
            guac_rdpdr_fs_process_write(svc, device, iorequest, input_stream);
            break;

        /* Device control request (Windows FSCTL_ control codes) */
        case IRP_MJ_DEVICE_CONTROL:
            guac_rdpdr_fs_process_device_control(svc, device, iorequest, input_stream);
            break;

        /* Query volume (drive) information */
        case IRP_MJ_QUERY_VOLUME_INFORMATION:
            guac_rdpdr_fs_process_volume_info(svc, device, iorequest, input_stream);
            break;

        /* Set volume (drive) information */
        case IRP_MJ_SET_VOLUME_INFORMATION:
            guac_rdpdr_fs_process_set_volume_info(svc, device, iorequest, input_stream);
            break;

        /* Query file information */
        case IRP_MJ_QUERY_INFORMATION:
            guac_rdpdr_fs_process_file_info(svc, device, iorequest, input_stream);
            break;

        /* Set file information */
        case IRP_MJ_SET_INFORMATION:
            guac_rdpdr_fs_process_set_file_info(svc, device, iorequest, input_stream);
            break;

        case IRP_MJ_DIRECTORY_CONTROL:

            /* Enumerate directory contents */
            if (iorequest->minor_func == IRP_MN_QUERY_DIRECTORY)
                guac_rdpdr_fs_process_query_directory(svc, device, iorequest,
                        input_stream);

            /* Request notification of changes to directory */
            else if (iorequest->minor_func == IRP_MN_NOTIFY_CHANGE_DIRECTORY)
                guac_rdpdr_fs_process_notify_change_directory(svc, device,
                        iorequest, input_stream);

            break;

        /* Lock/unlock portions of a file */
        case IRP_MJ_LOCK_CONTROL:
            guac_rdpdr_fs_process_lock_control(svc, device, iorequest, input_stream);
            break;

        default:
            guac_client_log(svc->client, GUAC_LOG_DEBUG,
                    "Unknown filesystem I/O request function: 0x%x/0x%x",
                    iorequest->major_func, iorequest->minor_func);
    }

}

void guac_rdpdr_device_fs_free_handler(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device) {

    Stream_Free(device->device_announce, 1);
    
}

void guac_rdpdr_register_fs(guac_rdp_common_svc* svc, char* drive_name) {

    guac_client* client = svc->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    guac_rdpdr* rdpdr = (guac_rdpdr*) svc->data;
    int id = rdpdr->devices_registered++;

    /* Get new device */
    guac_rdpdr_device* device = &(rdpdr->devices[id]);

    /* Init device */
    device->device_id   = id;
    device->device_name = drive_name;
    int device_name_len = guac_utf8_strlen(device->device_name);
    device->device_type = RDPDR_DTYP_FILESYSTEM;
    device->dos_name = "GUACFS\0\0";

    /* Set up the device announcement */
    device->device_announce_len = 20 + device_name_len;
    device->device_announce = Stream_New(NULL, device->device_announce_len);
    Stream_Write_UINT32(device->device_announce, device->device_type);
    Stream_Write_UINT32(device->device_announce, device->device_id);
    Stream_Write(device->device_announce, device->dos_name, 8);
    Stream_Write_UINT32(device->device_announce, device_name_len);
    Stream_Write(device->device_announce, device->device_name, device_name_len);
    

    /* Set handlers */
    device->iorequest_handler = guac_rdpdr_device_fs_iorequest_handler;
    device->free_handler      = guac_rdpdr_device_fs_free_handler;

    /* Init data */
    device->data = rdp_client->filesystem;

}

