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

#ifndef GUAC_RDP_CHANNELS_RDPDR_FS_MESSAGES_H
#define GUAC_RDP_CHANNELS_RDPDR_FS_MESSAGES_H

/**
 * Handlers for core drive I/O requests. Requests handled here may be simple
 * messages handled directly, or more complex multi-type messages handled
 * elsewhere.
 *
 * @file rdpdr-fs-messages.h
 */

#include "channels/rdpdr/rdpdr.h"

#include <winpr/stream.h>

/**
 * Handles a Server Create Drive Request. Despite its name, this request opens
 * a file.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_create;

/**
 * Handles a Server Close Drive Request. This request closes an open file.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_close;

/**
 * Handles a Server Drive Read Request. This request reads from a file.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_read;

/**
 * Handles a Server Drive Write Request. This request writes to a file.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_write;

/**
 * Handles a Server Drive Control Request. This request handles one of any
 * number of Windows FSCTL_* control functions.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_device_control;

/**
 * Handles a Server Drive Query Volume Information Request. This request
 * queries information about the redirected volume (drive). This request
 * has several query types which have their own handlers defined in a
 * separate file.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_volume_info;

/**
 * Handles a Server Drive Set Volume Information Request. Currently, this
 * RDPDR implementation does not support setting of volume information.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_set_volume_info;

/**
 * Handles a Server Drive Query Information Request. This request queries
 * information about a specific file. This request has several query types
 * which have their own handlers defined in a separate file.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_file_info;

/**
 * Handles a Server Drive Set Information Request. This request sets
 * information about a specific file. Currently, this RDPDR implementation does
 * not support setting of file information.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_set_file_info;

/**
 * Handles a Server Drive Query Directory Request. This request queries
 * information about a specific directory. This request has several query types
 * which have their own handlers defined in a separate file.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_query_directory;

/**
 * Handles a Server Drive NotifyChange Directory Request. This request requests
 * directory change notification.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_notify_change_directory;

/**
 * Handles a Server Drive Lock Control Request. This request locks or unlocks
 * portions of a file.
 */
guac_rdpdr_device_iorequest_handler guac_rdpdr_fs_process_lock_control;

#endif

