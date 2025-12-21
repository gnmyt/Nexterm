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

#ifndef GUAC_RDP_CHANNELS_RDPDR_FS_MESSAGES_VOL_INFO_H
#define GUAC_RDP_CHANNELS_RDPDR_FS_MESSAGES_VOL_INFO_H

/**
 * Handlers for directory queries received over the RDPDR channel via the
 * IRP_MJ_DIRECTORY_CONTROL major function and the IRP_MN_QUERY_DIRECTORY minor
 * function.
 *
 * @file rdpdr-fs-messages-vol-info.h
 */

#include "channels/rdpdr/rdpdr.h"

#include <winpr/stream.h>

/**
 * Processes a query request for FileFsVolumeInformation. According to the
 * documentation, this is "used to query information for a volume on which a
 * file system is mounted."
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_volume_info;

/**
 * Processes a query request for FileFsSizeInformation.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_size_info;

/**
 * Processes a query request for FileFsAttributeInformation.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_attribute_info;

/**
 * Processes a query request for FileFsFullSizeInformation.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_full_size_info;

/**
 * Processes a query request for FileFsDeviceInformation.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_device_info;

#endif

