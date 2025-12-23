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

#ifndef GUAC_RDP_CHANNELS_RDPDR_FS_MESSAGES_DIR_INFO_H
#define GUAC_RDP_CHANNELS_RDPDR_FS_MESSAGES_DIR_INFO_H

/**
 * Handlers for directory queries received over the RDPDR channel via the
 * IRP_MJ_DIRECTORY_CONTROL major function and the IRP_MN_QUERY_DIRECTORY minor
 * function.
 *
 * @file rdpdr-fs-messages-dir-info.h
 */

#include "channels/common-svc.h"
#include "channels/rdpdr/rdpdr.h"

#include <winpr/stream.h>

/**
 * Handler for Device I/O Requests which query information about the files
 * within a directory.
 *
 * @param svc
 *     The guac_rdp_common_svc representing the static virtual channel being
 *     used for RDPDR.
 *
 * @param device
 *     The guac_rdpdr_device of the relevant device, as dictated by the
 *     deviceId field of the common RDPDR header within the received PDU.
 *     Within the guac_rdpdr_iorequest structure, the deviceId field is stored
 *     within device_id.
 *
 * @param iorequest
 *     The contents of the common RDPDR Device I/O Request header shared by all
 *     RDPDR devices.
 *
 * @param entry_name
 *     The filename of the file being queried.
 *
 * @param entry_file_id
 *     The ID of the file being queried.
 */
typedef void guac_rdpdr_directory_query_handler(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        const char* entry_name, int entry_file_id);

/**
 * Processes a query request for FileDirectoryInformation. From the
 * documentation this is "defined as the file's name, time stamp, and size, or its
 * attributes."
 */
guac_rdpdr_directory_query_handler guac_rdpdr_fs_process_query_directory_info;

/**
 * Processes a query request for FileFullDirectoryInformation. From the
 * documentation, this is "defined as all the basic information, plus extended
 * attribute size."
 */
guac_rdpdr_directory_query_handler guac_rdpdr_fs_process_query_full_directory_info;

/**
 * Processes a query request for FileBothDirectoryInformation. From the
 * documentation, this absurdly-named request is "basic information plus
 * extended attribute size and short name about a file or directory."
 */
guac_rdpdr_directory_query_handler guac_rdpdr_fs_process_query_both_directory_info;

/**
 * Processes a query request for FileNamesInformation. From the documentation,
 * this is "detailed information on the names of files in a directory."
 */
guac_rdpdr_directory_query_handler guac_rdpdr_fs_process_query_names_info;

#endif

