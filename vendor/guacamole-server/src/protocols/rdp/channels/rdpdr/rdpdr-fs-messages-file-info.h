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

#ifndef GUAC_RDP_CHANNELS_RDPDR_FS_MESSAGES_FILE_INFO_H
#define GUAC_RDP_CHANNELS_RDPDR_FS_MESSAGES_FILE_INFO_H

/**
 * Handlers for file queries received over the RDPDR channel via the
 * IRP_MJ_QUERY_INFORMATION major function.
 *
 * @file rdpdr-fs-messages-file-info.h
 */

#include "channels/common-svc.h"
#include "channels/rdpdr/rdpdr.h"

#include <winpr/stream.h>

/**
 * Handler for Device I/O Requests which set/update file information.
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
 * @param length
 *     The length of the SetBuffer field of the I/O request, in bytes. Whether
 *     the SetBuffer field is applicable to a particular request, as well as
 *     the specific contents of that field, depend on the type of request.
 *
 * @param input_stream
 *     The remaining data within the received PDU, following the common RDPDR
 *     Device I/O Request header and length field. If the SetBuffer field is
 *     used for this request, the first byte of SetBuffer will be the first
 *     byte read from this stream.
 */
typedef void guac_rdpdr_set_information_request_handler(guac_rdp_common_svc* svc,
        guac_rdpdr_device* device, guac_rdpdr_iorequest* iorequest,
        int length, wStream* input_stream);

/**
 * Processes a query for FileBasicInformation. From the documentation, this is
 * "used to query a file for the times of creation, last access, last write,
 * and change, in addition to file attribute information."
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_basic_info;

/**
 * Processes a query for FileStandardInformation. From the documentation, this
 * is "used to query for file information such as allocation size, end-of-file
 * position, and number of links."
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_standard_info;

/**
 * Processes a query for FileAttributeTagInformation. From the documentation
 * this is "used to query for file attribute and reparse tag information."
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_attribute_tag_info;

/**
 * Process a set operation for FileRenameInformation. From the documentation,
 * this operation is used to rename a file.
 */
guac_rdpdr_set_information_request_handler guac_rdpdr_fs_process_set_rename_info;

/**
 * Process a set operation for FileAllocationInformation. From the
 * documentation, this operation is used to set a file's allocation size.
 */
guac_rdpdr_set_information_request_handler guac_rdpdr_fs_process_set_allocation_info;

/**
 * Process a set operation for FileDispositionInformation. From the
 * documentation, this operation is used to mark a file for deletion.
 */
guac_rdpdr_set_information_request_handler guac_rdpdr_fs_process_set_disposition_info;

/**
 * Process a set operation for FileEndOfFileInformation. From the
 * documentation, this operation is used "to set end-of-file information for
 * a file."
 */
guac_rdpdr_set_information_request_handler guac_rdpdr_fs_process_set_end_of_file_info;

/**
 * Process a set operation for FileBasicInformation. From the documentation,
 * this is "used to set file information such as the times of creation, last
 * access, last write, and change, in addition to file attributes."
 */
guac_rdpdr_set_information_request_handler guac_rdpdr_fs_process_set_basic_info;

#endif
