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
#include "channels/rdpdr/rdpdr-fs-messages-dir-info.h"
#include "channels/rdpdr/rdpdr-fs-messages-file-info.h"
#include "channels/rdpdr/rdpdr-fs-messages-vol-info.h"
#include "channels/rdpdr/rdpdr-fs-messages.h"
#include "channels/rdpdr/rdpdr.h"
#include "download.h"
#include "fs.h"
#include "unicode.h"

#include <freerdp/channels/rdpdr.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <winpr/nt.h>
#include <winpr/stream.h>
#include <winpr/wtypes.h>

#include <stdint.h>
#include <stdlib.h>
#include <string.h>

void guac_rdpdr_fs_process_create(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    wStream* output_stream;
    int file_id;

    int desired_access, file_attributes;
    int create_disposition, create_options, path_length;
    char path[GUAC_RDP_FS_MAX_PATH];

    /* Check remaining stream data prior to reading. */
    if (Stream_GetRemainingLength(input_stream) < 32) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Create Drive "
                "Request PDU does not contain the expected number of bytes. "
                "Drive redirection may not work as expected.");
        return;
    }
    
    /* Read "create" information */
    Stream_Read_UINT32(input_stream, desired_access);
    Stream_Seek_UINT64(input_stream); /* allocation size */
    Stream_Read_UINT32(input_stream, file_attributes);
    Stream_Seek_UINT32(input_stream); /* shared access */
    Stream_Read_UINT32(input_stream, create_disposition);
    Stream_Read_UINT32(input_stream, create_options);
    Stream_Read_UINT32(input_stream, path_length);

    /* Check to make sure the stream contains path_length bytes. */
    if(Stream_GetRemainingLength(input_stream) < path_length) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Create Drive "
                "Request PDU does not contain the expected number of bytes. "
                "Drive redirection may not work as expected.");
        return;
    }
    
    /* Convert path to UTF-8 */
    guac_rdp_utf16_to_utf8(Stream_Pointer(input_stream), path_length/2 - 1,
            path, sizeof(path));

    /* Open file */
    file_id = guac_rdp_fs_open((guac_rdp_fs*) device->data, path,
            desired_access, file_attributes,
            create_disposition, create_options);

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i] "
             "desired_access=0x%x, file_attributes=0x%x, "
             "create_disposition=0x%x, create_options=0x%x, path=\"%s\"",
             __func__, file_id,
             desired_access, file_attributes,
             create_disposition, create_options, path);

    /* If an error occurred, notify server */
    if (file_id < 0) {
        guac_client_log(svc->client, GUAC_LOG_ERROR,
                "File open refused (%i): \"%s\"", file_id, path);

        output_stream = guac_rdpdr_new_io_completion(device,
                iorequest->completion_id, guac_rdp_fs_get_status(file_id), 5);
        Stream_Write_UINT32(output_stream, 0); /* fileId */
        Stream_Write_UINT8(output_stream,  0); /* information */
    }

    /* Otherwise, open succeeded */
    else {

        guac_rdp_fs_file* file;

        output_stream = guac_rdpdr_new_io_completion(device,
                iorequest->completion_id, STATUS_SUCCESS, 5);
        Stream_Write_UINT32(output_stream, file_id);    /* fileId */
        Stream_Write_UINT8(output_stream,  0);          /* information */

        /* Create \Download if it doesn't exist */
        file = guac_rdp_fs_get_file((guac_rdp_fs*) device->data, file_id);
        if (file != NULL && strcmp(file->absolute_path, "\\") == 0) {
            
            /* Only create Download folder if downloads are enabled. */
            if (!((guac_rdp_fs*) device->data)->disable_download) {
                int download_id =
                    guac_rdp_fs_open((guac_rdp_fs*) device->data, "\\Download",
                        GENERIC_READ, 0, FILE_OPEN_IF, FILE_DIRECTORY_FILE);
                
                if (download_id >= 0)
                    guac_rdp_fs_close((guac_rdp_fs*) device->data, download_id);
            }

        }

    }

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_read(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    UINT32 length;
    UINT64 offset;
    char* buffer;
    int bytes_read;

    wStream* output_stream;

    /* Check remaining bytes before reading stream. */
    if (Stream_GetRemainingLength(input_stream) < 12) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Drive Read "
                "Request PDU does not contain the expected number of bytes. "
                "Drive redirection may not work as expected.");
        return;
    }
    
    /* Read packet */
    Stream_Read_UINT32(input_stream, length);
    Stream_Read_UINT64(input_stream, offset);

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i] length=%i, offset=%" PRIu64,
             __func__, iorequest->file_id, length, (uint64_t) offset);

    /* Ensure buffer size does not exceed a safe maximum */
    if (length > GUAC_RDP_MAX_READ_BUFFER)
        length = GUAC_RDP_MAX_READ_BUFFER;

    /* Allocate buffer */
    buffer = guac_mem_alloc(length);

    /* Attempt read */
    bytes_read = guac_rdp_fs_read((guac_rdp_fs*) device->data,
            iorequest->file_id, offset, buffer, length);

    /* If error, return invalid parameter */
    if (bytes_read < 0) {
        output_stream = guac_rdpdr_new_io_completion(device,
                iorequest->completion_id, guac_rdp_fs_get_status(bytes_read), 4);
        Stream_Write_UINT32(output_stream, 0); /* Length */
    }

    /* Otherwise, send bytes read */
    else {
        output_stream = guac_rdpdr_new_io_completion(device,
                iorequest->completion_id, STATUS_SUCCESS, 4+bytes_read);
        Stream_Write_UINT32(output_stream, bytes_read);  /* Length */
        Stream_Write(output_stream, buffer, bytes_read); /* ReadData */
    }

    guac_rdp_common_svc_write(svc, output_stream);
    guac_mem_free(buffer);

}

void guac_rdpdr_fs_process_write(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    UINT32 length;
    UINT64 offset;
    int bytes_written;

    wStream* output_stream;

    /* Check remaining length. */
    if (Stream_GetRemainingLength(input_stream) < 32) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Drive Write "
                "Request PDU does not contain the expected number of bytes. "
                "Drive redirection may not work as expected.");
        return;
    }
    
    /* Read packet */
    Stream_Read_UINT32(input_stream, length);
    Stream_Read_UINT64(input_stream, offset);
    Stream_Seek(input_stream, 20); /* Padding */

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i] length=%i, offset=%" PRIu64,
             __func__, iorequest->file_id, length, (uint64_t) offset);

    /* Check to make sure stream contains at least length bytes */
    if (Stream_GetRemainingLength(input_stream) < length) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Drive Write "
                "Request PDU does not contain the expected number of bytes. "
                "Drive redirection may not work as expected.");
        return;
    }
    
    /* Attempt write */
    bytes_written = guac_rdp_fs_write((guac_rdp_fs*) device->data,
            iorequest->file_id, offset, Stream_Pointer(input_stream), length);

    /* If error, return invalid parameter */
    if (bytes_written < 0) {
        output_stream = guac_rdpdr_new_io_completion(device,
                iorequest->completion_id, guac_rdp_fs_get_status(bytes_written), 5);
        Stream_Write_UINT32(output_stream, 0); /* Length */
        Stream_Write_UINT8(output_stream, 0);  /* Padding */
    }

    /* Otherwise, send success */
    else {
        output_stream = guac_rdpdr_new_io_completion(device,
                iorequest->completion_id, STATUS_SUCCESS, 5);
        Stream_Write_UINT32(output_stream, bytes_written); /* Length */
        Stream_Write_UINT8(output_stream, 0);              /* Padding */
    }

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_close(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    wStream* output_stream;
    guac_rdp_fs_file* file;

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i]",
            __func__, iorequest->file_id);

    /* Get file */
    file = guac_rdp_fs_get_file((guac_rdp_fs*) device->data, iorequest->file_id);
    if (file == NULL)
        return;

    /* If file was written to, and it's in the \Download folder, start stream */
    if (file->bytes_written > 0
            && strncmp(file->absolute_path, "\\Download\\", 10) == 0
			&& !((guac_rdp_fs*) device->data)->disable_download) {
        guac_client_for_owner(svc->client, guac_rdp_download_to_user, file->absolute_path);
        guac_rdp_fs_delete((guac_rdp_fs*) device->data, iorequest->file_id);
    }

    /* Close file */
    guac_rdp_fs_close((guac_rdp_fs*) device->data, iorequest->file_id);

    output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_SUCCESS, 4);
    Stream_Write(output_stream, "\0\0\0\0", 4); /* Padding */

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_volume_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    int fs_information_class;

    /* Check remaining length */
    if (Stream_GetRemainingLength(input_stream) < 4) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Drive Query "
                "Volume Information PDU does not contain the expected number "
                "of bytes. Drive redirection may not work as expected.");
        return;
    }
    
    Stream_Read_UINT32(input_stream, fs_information_class);

    /* Dispatch to appropriate class-specific handler */
    switch (fs_information_class) {

        case FileFsVolumeInformation:
            guac_rdpdr_fs_process_query_volume_info(svc, device, iorequest, input_stream);
            break;

        case FileFsSizeInformation:
            guac_rdpdr_fs_process_query_size_info(svc, device, iorequest, input_stream);
            break;

        case FileFsDeviceInformation:
            guac_rdpdr_fs_process_query_device_info(svc, device, iorequest, input_stream);
            break;

        case FileFsAttributeInformation:
            guac_rdpdr_fs_process_query_attribute_info(svc, device, iorequest, input_stream);
            break;

        case FileFsFullSizeInformation:
            guac_rdpdr_fs_process_query_full_size_info(svc, device, iorequest, input_stream);
            break;

        default:
            guac_client_log(svc->client, GUAC_LOG_DEBUG,
                    "Unknown volume information class: 0x%x", fs_information_class);
    }

}

void guac_rdpdr_fs_process_file_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    int fs_information_class;

    /* Check remaining length */
    if (Stream_GetRemainingLength(input_stream) < 4) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Drive Query "
                "Information PDU does not contain the expected number of "
                "bytes. Drive redirection may not work as expected.");
        return;
    }
    
    Stream_Read_UINT32(input_stream, fs_information_class);

    /* Dispatch to appropriate class-specific handler */
    switch (fs_information_class) {

        case FileBasicInformation:
            guac_rdpdr_fs_process_query_basic_info(svc, device, iorequest, input_stream);
            break;

        case FileStandardInformation:
            guac_rdpdr_fs_process_query_standard_info(svc, device, iorequest, input_stream);
            break;

        case FileAttributeTagInformation:
            guac_rdpdr_fs_process_query_attribute_tag_info(svc, device, iorequest, input_stream);
            break;

        default:
            guac_client_log(svc->client, GUAC_LOG_DEBUG,
                    "Unknown file information class: 0x%x", fs_information_class);
    }

}

void guac_rdpdr_fs_process_set_volume_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_NOT_SUPPORTED, 0);

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i] Set volume info not supported",
            __func__, iorequest->file_id);

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_set_file_info(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    int fs_information_class;
    int length;

    /* Check remaining length */
    if (Stream_GetRemainingLength(input_stream) < 32) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Drive Set "
                "Information PDU does not contain the expected number of "
                "bytes. Drive redirection may not work as expected.");
        return;
    }
    
    Stream_Read_UINT32(input_stream, fs_information_class);
    Stream_Read_UINT32(input_stream, length); /* Length */
    Stream_Seek(input_stream, 24);            /* Padding */

    /* Dispatch to appropriate class-specific handler */
    switch (fs_information_class) {

        case FileBasicInformation:
            guac_rdpdr_fs_process_set_basic_info(svc, device, iorequest, length, input_stream);
            break;

        case FileEndOfFileInformation:
            guac_rdpdr_fs_process_set_end_of_file_info(svc, device, iorequest, length, input_stream);
            break;

        case FileDispositionInformation:
            guac_rdpdr_fs_process_set_disposition_info(svc, device, iorequest, length, input_stream);
            break;

        case FileRenameInformation:
            guac_rdpdr_fs_process_set_rename_info(svc, device, iorequest, length, input_stream);
            break;

        case FileAllocationInformation:
            guac_rdpdr_fs_process_set_allocation_info(svc, device, iorequest, length, input_stream);
            break;

        default:
            guac_client_log(svc->client, GUAC_LOG_DEBUG,
                    "Unknown file information class: 0x%x",
                    fs_information_class);
    }

}

void guac_rdpdr_fs_process_device_control(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_INVALID_PARAMETER, 4);

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i] IGNORED",
            __func__, iorequest->file_id);

    /* No content for now */
    Stream_Write_UINT32(output_stream, 0);

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_notify_change_directory(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i] Not "
            "implemented", __func__, iorequest->file_id);

}

void guac_rdpdr_fs_process_query_directory(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    wStream* output_stream;

    guac_rdp_fs_file* file;
    int fs_information_class, initial_query;
    int path_length;

    const char* entry_name;

    /* Get file */
    file = guac_rdp_fs_get_file((guac_rdp_fs*) device->data, iorequest->file_id);
    if (file == NULL)
        return;

    if (Stream_GetRemainingLength(input_stream) < 9) {
        guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Drive Query "
                "Directory PDU does not contain the expected number of bytes. "
                "Drive redirection may not work as expected.");
        return;
    }
    
    /* Read main header */
    Stream_Read_UINT32(input_stream, fs_information_class);
    Stream_Read_UINT8(input_stream,  initial_query);
    Stream_Read_UINT32(input_stream, path_length);

    /* If this is the first query, the path is included after padding */
    if (initial_query) {

        /*
         * Check to make sure Stream has at least the 23 padding bytes in it
         * prior to seeking.
         */
        if (Stream_GetRemainingLength(input_stream) < (23 + path_length)) {
            guac_client_log(svc->client, GUAC_LOG_WARNING, "Server Drive Query "
                    "Directory PDU does not contain the expected number of "
                    "bytes. Drive redirection may not work as expected.");
            return;
        }
        
        Stream_Seek(input_stream, 23);       /* Padding */
        
        /* Convert path to UTF-8 */
        guac_rdp_utf16_to_utf8(Stream_Pointer(input_stream), path_length/2 - 1,
                file->dir_pattern, sizeof(file->dir_pattern));

    }

    guac_client_log(svc->client, GUAC_LOG_DEBUG, "%s: [file_id=%i] "
            "initial_query=%i, dir_pattern=\"%s\"", __func__,
            iorequest->file_id, initial_query, file->dir_pattern);

    /* Find first matching entry in directory */
    while ((entry_name = guac_rdp_fs_read_dir((guac_rdp_fs*) device->data,
                    iorequest->file_id)) != NULL) {

        /* Convert to absolute path */
        char entry_path[GUAC_RDP_FS_MAX_PATH];
        if (guac_rdp_fs_convert_path(file->absolute_path,
                    entry_name, entry_path) == 0) {

            int entry_file_id;

            /* Pattern defined and match fails, continue with next file */
            if (guac_rdp_fs_matches(entry_path, file->dir_pattern))
                continue;

            /* Open directory entry */
            entry_file_id = guac_rdp_fs_open((guac_rdp_fs*) device->data,
                    entry_path, FILE_READ_DATA, 0, FILE_OPEN, 0);

            if (entry_file_id >= 0) {

                /* Dispatch to appropriate class-specific handler */
                switch (fs_information_class) {

                    case FileDirectoryInformation:
                        guac_rdpdr_fs_process_query_directory_info(svc, device,
                                iorequest, entry_name, entry_file_id);
                        break;

                    case FileFullDirectoryInformation:
                        guac_rdpdr_fs_process_query_full_directory_info(svc,
                                device, iorequest, entry_name, entry_file_id);
                        break;

                    case FileBothDirectoryInformation:
                        guac_rdpdr_fs_process_query_both_directory_info(svc,
                                device, iorequest, entry_name, entry_file_id);
                        break;

                    case FileNamesInformation:
                        guac_rdpdr_fs_process_query_names_info(svc, device,
                                iorequest, entry_name, entry_file_id);
                        break;

                    default:
                        guac_client_log(svc->client, GUAC_LOG_DEBUG,
                                "Unknown dir information class: 0x%x",
                                fs_information_class);
                }

                guac_rdp_fs_close((guac_rdp_fs*) device->data, entry_file_id);
                return;

            } /* end if file exists */
        } /* end if path valid */
    } /* end if entry exists */

    /*
     * Handle errors as a lack of files.
     */

    output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_NO_MORE_FILES, 5);

    Stream_Write_UINT32(output_stream, 0); /* Length */
    Stream_Write_UINT8(output_stream, 0);  /* Padding */

    guac_rdp_common_svc_write(svc, output_stream);

}

void guac_rdpdr_fs_process_lock_control(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        wStream* input_stream) {

    wStream* output_stream = guac_rdpdr_new_io_completion(device,
            iorequest->completion_id, STATUS_NOT_SUPPORTED, 5);

    guac_client_log(svc->client, GUAC_LOG_DEBUG,
            "%s: [file_id=%i] Lock not supported",
            __func__, iorequest->file_id);

    Stream_Zero(output_stream, 5); /* Padding */

    guac_rdp_common_svc_write(svc, output_stream);

}

