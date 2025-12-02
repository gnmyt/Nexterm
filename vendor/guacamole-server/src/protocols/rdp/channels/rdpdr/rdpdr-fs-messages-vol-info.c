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
#include "channels/rdpdr/rdpdr-fs-messages-vol-info.h"
#include "channels/rdpdr/rdpdr-fs.h"
#include "channels/rdpdr/rdpdr.h"
#include "fs.h"

#include <guacamole/client.h>
#include <guacamole/unicode.h>
#include <winpr/file.h>
#include <winpr/io.h>
#include <winpr/nt.h>
#include <winpr/stream.h>
#include <winpr/wtypes.h>

void guac_rdpdr_fs_process_query_volume_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS, 21 + GUAC_FILESYSTEM_LABEL_LENGTH);

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i]", __func__,
            iorequest->file_id);

    Stream_Write_UINT32(output_stream, 17 + GUAC_FILESYSTEM_LABEL_LENGTH);
    Stream_Write_UINT64(output_stream, 0); /* VolumeCreationTime */
    Stream_Write_UINT32(output_stream, 0); /* VolumeSerialNumber */
    Stream_Write_UINT32(output_stream, GUAC_FILESYSTEM_LABEL_LENGTH);
    Stream_Write_UINT8(output_stream, FALSE); /* SupportsObjects */
    /* Reserved field must not be sent */
    Stream_Write(output_stream, GUAC_FILESYSTEM_LABEL, GUAC_FILESYSTEM_LABEL_LENGTH);

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_query_size_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    guac_rdp_fs_info info = {0};
    guac_rdp_fs_get_info((guac_rdp_fs*) device->data, &info);

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS, 28);

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i]", __func__,
            iorequest->file_id);

    Stream_Write_UINT32(output_stream, 24);
    Stream_Write_UINT64(output_stream, info.blocks_total);     /* TotalAllocationUnits */
    Stream_Write_UINT64(output_stream, info.blocks_available); /* AvailableAllocationUnits */
    Stream_Write_UINT32(output_stream, 1);                     /* SectorsPerAllocationUnit */
    Stream_Write_UINT32(output_stream, info.block_size);       /* BytesPerSector */

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_query_device_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS, 12);

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i]", __func__,
            iorequest->file_id);

    Stream_Write_UINT32(output_stream, 8);
    Stream_Write_UINT32(output_stream, FILE_DEVICE_DISK); /* DeviceType */
    Stream_Write_UINT32(output_stream, 0); /* Characteristics */

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_query_attribute_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    int name_len = guac_utf8_strlen(device->device_name);
    
    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS, 16 + name_len);

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i]", __func__,
            iorequest->file_id);

    Stream_Write_UINT32(output_stream, 12 + name_len);
    Stream_Write_UINT32(output_stream,
              FILE_UNICODE_ON_DISK
            | FILE_CASE_SENSITIVE_SEARCH
            | FILE_CASE_PRESERVED_NAMES); /* FileSystemAttributes */
    Stream_Write_UINT32(output_stream, GUAC_RDP_FS_MAX_PATH ); /* MaximumComponentNameLength */
    Stream_Write_UINT32(output_stream, name_len);
    Stream_Write(output_stream, device->device_name, name_len);

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_query_full_size_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    guac_rdp_fs_info info = {0};
    guac_rdp_fs_get_info((guac_rdp_fs*) device->data, &info);

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS, 36);

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i]", __func__,
            iorequest->file_id);

    Stream_Write_UINT32(output_stream, 32);
    Stream_Write_UINT64(output_stream, info.blocks_total);     /* TotalAllocationUnits */
    Stream_Write_UINT64(output_stream, info.blocks_available); /* CallerAvailableAllocationUnits */
    Stream_Write_UINT64(output_stream, info.blocks_available); /* ActualAvailableAllocationUnits */
    Stream_Write_UINT32(output_stream, 1);                     /* SectorsPerAllocationUnit */
    Stream_Write_UINT32(output_stream, info.block_size);       /* BytesPerSector */

    guac_rdp_common_svc_write(svc, output_stream);

}

