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

#include "channels/rdpdr/rdpdr-fs-messages-dir-info.h"
#include "channels/rdpdr/rdpdr.h"
#include "fs.h"
#include "unicode.h"

#include <guacamole/client.h>
#include <guacamole/unicode.h>
#include <winpr/nt.h>
#include <winpr/stream.h>

#include <stddef.h>
#include <stddef.h>

void guac_rdpdr_fs_process_query_directory_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        const char* entry_name, int entry_file_id) {

    guac_rdp_fs_file* file;

    wStream* output_stream;
    int length = guac_utf8_strlen(entry_name);
    int utf16_length = length*2;

    unsigned char utf16_entry_name[256];
    guac_rdp_utf8_to_utf16((const unsigned char*) entry_name, length,
            (char*) utf16_entry_name, sizeof(utf16_entry_name));

    /* Get file */
    file = guac_rdp_fs_get_file((guac_rdp_fs*) device->data, entry_file_id);
    if (file == NULL)
        return;

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i (entry_name=\"%s\")]",
            __func__, entry_file_id, entry_name);

    output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS,
            4 + 64 + utf16_length + 2);

    Stream_Write_UINT32(output_stream,
            64 + utf16_length + 2); /* Length */

    Stream_Write_UINT32(output_stream, 0); /* NextEntryOffset */
    Stream_Write_UINT32(output_stream, 0); /* FileIndex */
    Stream_Write_UINT64(output_stream, file->ctime); /* CreationTime */
    Stream_Write_UINT64(output_stream, file->atime); /* LastAccessTime */
    Stream_Write_UINT64(output_stream, file->mtime); /* LastWriteTime */
    Stream_Write_UINT64(output_stream, file->mtime); /* ChangeTime */
    Stream_Write_UINT64(output_stream, file->size);  /* EndOfFile */
    Stream_Write_UINT64(output_stream, file->size);  /* AllocationSize */
    Stream_Write_UINT32(output_stream, file->attributes);   /* FileAttributes */
    Stream_Write_UINT32(output_stream, utf16_length+2); /* FileNameLength*/

    Stream_Write(output_stream, utf16_entry_name, utf16_length); /* FileName */
    Stream_Write(output_stream, "\0\0", 2);

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_query_full_directory_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        const char* entry_name, int entry_file_id) {

    guac_rdp_fs_file* file;

    wStream* output_stream;
    int length = guac_utf8_strlen(entry_name);
    int utf16_length = length*2;

    unsigned char utf16_entry_name[256];
    guac_rdp_utf8_to_utf16((const unsigned char*) entry_name, length,
            (char*) utf16_entry_name, sizeof(utf16_entry_name));

    /* Get file */
    file = guac_rdp_fs_get_file((guac_rdp_fs*) device->data, entry_file_id);
    if (file == NULL)
        return;

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i (entry_name=\"%s\")]",
            __func__, entry_file_id, entry_name);

    output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS,
            4 + 68 + utf16_length + 2);

    Stream_Write_UINT32(output_stream,
            68 + utf16_length + 2); /* Length */

    Stream_Write_UINT32(output_stream, 0); /* NextEntryOffset */
    Stream_Write_UINT32(output_stream, 0); /* FileIndex */
    Stream_Write_UINT64(output_stream, file->ctime); /* CreationTime */
    Stream_Write_UINT64(output_stream, file->atime); /* LastAccessTime */
    Stream_Write_UINT64(output_stream, file->mtime); /* LastWriteTime */
    Stream_Write_UINT64(output_stream, file->mtime); /* ChangeTime */
    Stream_Write_UINT64(output_stream, file->size);  /* EndOfFile */
    Stream_Write_UINT64(output_stream, file->size);  /* AllocationSize */
    Stream_Write_UINT32(output_stream, file->attributes);   /* FileAttributes */
    Stream_Write_UINT32(output_stream, utf16_length+2); /* FileNameLength*/
    Stream_Write_UINT32(output_stream, 0); /* EaSize */

    Stream_Write(output_stream, utf16_entry_name, utf16_length); /* FileName */
    Stream_Write(output_stream, "\0\0", 2);

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_query_both_directory_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        const char* entry_name, int entry_file_id) {

    guac_rdp_fs_file* file;

    wStream* output_stream;
    int length = guac_utf8_strlen(entry_name);
    int utf16_length = length*2;

    unsigned char utf16_entry_name[256];
    guac_rdp_utf8_to_utf16((const unsigned char*) entry_name, length,
            (char*) utf16_entry_name, sizeof(utf16_entry_name));

    /* Get file */
    file = guac_rdp_fs_get_file((guac_rdp_fs*) device->data, entry_file_id);
    if (file == NULL)
        return;

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i (entry_name=\"%s\")]",
            __func__, entry_file_id, entry_name);

    output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS,
            4 + 69 + 24 + utf16_length + 2);

    Stream_Write_UINT32(output_stream,
            69 + 24 + utf16_length + 2); /* Length */

    Stream_Write_UINT32(output_stream, 0); /* NextEntryOffset */
    Stream_Write_UINT32(output_stream, 0); /* FileIndex */
    Stream_Write_UINT64(output_stream, file->ctime); /* CreationTime */
    Stream_Write_UINT64(output_stream, file->atime); /* LastAccessTime */
    Stream_Write_UINT64(output_stream, file->mtime); /* LastWriteTime */
    Stream_Write_UINT64(output_stream, file->mtime); /* ChangeTime */
    Stream_Write_UINT64(output_stream, file->size);  /* EndOfFile */
    Stream_Write_UINT64(output_stream, file->size);  /* AllocationSize */
    Stream_Write_UINT32(output_stream, file->attributes);   /* FileAttributes */
    Stream_Write_UINT32(output_stream, utf16_length+2); /* FileNameLength*/
    Stream_Write_UINT32(output_stream, 0); /* EaSize */
    Stream_Write_UINT8(output_stream,  0); /* ShortNameLength */

    /* Apparently, the reserved byte here must be skipped ... */

    Stream_Zero(output_stream, 24); /* FileName */
    Stream_Write(output_stream, utf16_entry_name, utf16_length); /* FileName */
    Stream_Write(output_stream, "\0\0", 2);

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_query_names_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        const char* entry_name, int entry_file_id) {

    guac_rdp_fs_file* file;

    wStream* output_stream;
    int length = guac_utf8_strlen(entry_name);
    int utf16_length = length*2;

    unsigned char utf16_entry_name[256];
    guac_rdp_utf8_to_utf16((const unsigned char*) entry_name, length,
            (char*) utf16_entry_name, sizeof(utf16_entry_name));

    /* Get file */
    file = guac_rdp_fs_get_file((guac_rdp_fs*) device->data, entry_file_id);
    if (file == NULL)
        return;

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i (entry_name=\"%s\")]",
            __func__, entry_file_id, entry_name);

    output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS,
            4 + 12 + utf16_length + 2);

    Stream_Write_UINT32(output_stream,
            12 + utf16_length + 2); /* Length */

    Stream_Write_UINT32(output_stream, 0); /* NextEntryOffset */
    Stream_Write_UINT32(output_stream, 0); /* FileIndex */
    Stream_Write_UINT32(output_stream, utf16_length+2); /* FileNameLength*/
    Stream_Write(output_stream, utf16_entry_name, utf16_length); /* FileName */
    Stream_Write(output_stream, "\0\0", 2);

    guac_rdp_common_svc_write(svc, output_stream);

}

