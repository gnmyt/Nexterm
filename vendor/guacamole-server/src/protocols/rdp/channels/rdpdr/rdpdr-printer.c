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

#include "channels/rdpdr/rdpdr-printer.h"
#include "channels/rdpdr/rdpdr.h"
#include "print-job.h"
#include "rdp.h"
#include "unicode.h"

#include <freerdp/channels/rdpdr.h>
#include <freerdp/settings.h>
#include <guacamole/client.h>
#include <guacamole/unicode.h>
#include <winpr/nt.h>
#include <winpr/stream.h>

#include <stdlib.h>

void guac_rdpdr_process_print_job_create(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    guac_client* client = svc->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Log creation of print job */
    guac_client_log(client, GUAC_LOG_INFO, "Print job created");

    /* Create print job */
    rdp_client->active_job = guac_client_for_owner(client,
            guac_rdp_print_job_alloc, NULL);

    /* Respond with success */
    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS, 4);

    Stream_Write_UINT32(output_stream, 0); /* fileId */
    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_process_print_job_write(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    guac_client* client = svc->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_print_job* job = (guac_rdp_print_job*) rdp_client->active_job;

    unsigned char* buffer;
    int length;
    int status;

    /* Verify that Stream contains at least 32 bytes (UINT32 + 8 + 20) */
    if (Stream_GetRemainingLength(input_stream) < 32) {
        guac_client_log(client, GUAC_LOG_WARNING, "Print job write stream does "
                "not contain the expected number of bytes. Printer redirection "
                "may not work as expected.");
        return;
    }
    
    /* Read buffer of print data */
    Stream_Read_UINT32(input_stream, length);
    Stream_Seek(input_stream, 8);  /* Offset */
    Stream_Seek(input_stream, 20); /* Padding */
    buffer = Stream_Pointer(input_stream);

    /* Verify the stream has at least length number of bytes remaining. */
    if (Stream_GetRemainingLength(input_stream) < length) {
        guac_client_log(client, GUAC_LOG_WARNING, "Print job write stream does "
                "not contain the expected number of bytes. Printer redirection "
                "may not work as expected.");
        return;
    }
    
    /* Write data only if job exists, translating status for RDP */
    if (job != NULL && (length = guac_rdp_print_job_write(job,
                    buffer, length)) >= 0) {
        status = STATUS_SUCCESS;
    }

    /* Report device offline if write fails */
    else {
        status = STATUS_DEVICE_OFF_LINE;
        length = 0;
    }

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, status, 5);

    Stream_Write_UINT32(output_stream, length);
    Stream_Write_UINT8(output_stream, 0); /* Padding */

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_process_print_job_close(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    guac_client* client = svc->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_print_job* job = (guac_rdp_print_job*) rdp_client->active_job;

    /* End print job */
    if (job != NULL) {
        guac_rdp_print_job_free(job);
        rdp_client->active_job = NULL;
    }

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS, 4);

    Stream_Write_UINT32(output_stream, 0); /* Padding */
    guac_rdp_common_svc_write(svc, output_stream);

    /* Log end of print job */
    guac_client_log(client, GUAC_LOG_INFO, "Print job closed");

}

void guac_rdpdr_device_printer_iorequest_handler(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    switch (iorequest->major_func) {

        /* Print job create */
        case IRP_MJ_CREATE:
            guac_rdpdr_process_print_job_create(svc, device, iorequest, input_stream);
            break;

        /* Printer job write */
        case IRP_MJ_WRITE:
            guac_rdpdr_process_print_job_write(svc, device, iorequest, input_stream);
            break;

        /* Printer job close */
        case IRP_MJ_CLOSE:
            guac_rdpdr_process_print_job_close(svc, device, iorequest, input_stream);
            break;

        /* Log unknown */
        default:
            guac_client_log(svc->client, GUAC_LOG_ERROR, "Unknown printer "
                    "I/O request function: 0x%x/0x%x", iorequest->major_func,
                    iorequest->minor_func);

    }

}

void guac_rdpdr_device_printer_free_handler(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device) {

    Stream_Free(device->device_announce, 1);

}

void guac_rdpdr_register_printer(guac_rdp_common_svc* svc, char* printer_name) {

    guac_rdpdr* rdpdr = (guac_rdpdr*) svc->data;
    int id = rdpdr->devices_registered++;

    /* Get new device */
    guac_rdpdr_device* device = &(rdpdr->devices[id]);

    /* Init device */
    device->device_id   = id;
    device->device_name = printer_name;
    int device_name_len = guac_utf8_strlen(device->device_name);
    device->device_type = RDPDR_DTYP_PRINT;
    device->dos_name = "PRN1\0\0\0\0";
    
    /* Set up device announce stream */
    int prt_name_len = (device_name_len + 1) * 2;
    device->device_announce_len = 44 + prt_name_len
            + GUAC_PRINTER_DRIVER_LENGTH;
    device->device_announce = Stream_New(NULL, device->device_announce_len);
    
    /* Write common information. */
    Stream_Write_UINT32(device->device_announce, device->device_type);
    Stream_Write_UINT32(device->device_announce, device->device_id);
    Stream_Write(device->device_announce, device->dos_name, 8);
    
    /* DeviceDataLength */
    Stream_Write_UINT32(device->device_announce, 24 +  prt_name_len + GUAC_PRINTER_DRIVER_LENGTH);
    
    /* Begin printer-specific information */
    Stream_Write_UINT32(device->device_announce,
              RDPDR_PRINTER_ANNOUNCE_FLAG_DEFAULTPRINTER
            | RDPDR_PRINTER_ANNOUNCE_FLAG_NETWORKPRINTER); /* Printer flags */
    Stream_Write_UINT32(device->device_announce, 0); /* Reserved - must be 0. */
    Stream_Write_UINT32(device->device_announce, 0); /* PnPName Length - ignored. */
    Stream_Write_UINT32(device->device_announce, GUAC_PRINTER_DRIVER_LENGTH);
    Stream_Write_UINT32(device->device_announce, prt_name_len);
    Stream_Write_UINT32(device->device_announce, 0); /* CachedFields length. */
    
    Stream_Write(device->device_announce, GUAC_PRINTER_DRIVER, GUAC_PRINTER_DRIVER_LENGTH);
    guac_rdp_utf8_to_utf16((const unsigned char*) device->device_name,
            device_name_len + 1, (char*) Stream_Pointer(device->device_announce),
            prt_name_len);
    Stream_Seek(device->device_announce, prt_name_len);

    /* Set handlers */
    device->iorequest_handler = guac_rdpdr_device_printer_iorequest_handler;
    device->free_handler      = guac_rdpdr_device_printer_free_handler;

}

