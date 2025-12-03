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

#ifndef GUAC_RDP_DOWNLOAD_H
#define GUAC_RDP_DOWNLOAD_H

#include "common/json.h"

#include <guacamole/protocol.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

#include <stdint.h>

/**
 * The transfer status of a file being downloaded.
 */
typedef struct guac_rdp_download_status {

    /**
     * The file ID of the file being downloaded.
     */
    int file_id;

    /**
     * The current position within the file.
     */
    uint64_t offset;

} guac_rdp_download_status;

/**
 * Handler for acknowledgements of receipt of data related to file downloads.
 */
guac_user_ack_handler guac_rdp_download_ack_handler;

/**
 * Handler for get messages. In context of downloads and the filesystem exposed
 * via the Guacamole protocol, get messages request the body of a file within
 * the filesystem.
 */
guac_user_get_handler guac_rdp_download_get_handler;

/**
 * Callback for guac_client_for_user() and similar functions which initiates a
 * file download to a specific user if that user is still connected. The path
 * for the file to be downloaded must be passed as the arbitrary data parameter
 * for the function invoking this callback.
 */
guac_user_callback guac_rdp_download_to_user;

#endif

