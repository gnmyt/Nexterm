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

#ifndef GUAC_RDP_UPLOAD_H
#define GUAC_RDP_UPLOAD_H

#include "common/json.h"

#include <guacamole/protocol.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

#include <stdint.h>

/**
 * Structure which represents the current state of an upload.
 */
typedef struct guac_rdp_upload_status {

    /**
     * The overall offset within the file that the next write should
     * occur at.
     */
    uint64_t offset;

    /**
     * The ID of the file being written to.
     */
    int file_id;

} guac_rdp_upload_status;

/**
 * Handler for inbound files related to file uploads.
 */
guac_user_file_handler guac_rdp_upload_file_handler;

/**
 * Handler for stream data related to file uploads.
 */
guac_user_blob_handler guac_rdp_upload_blob_handler;

/**
 * Handler for end-of-stream related to file uploads.
 */
guac_user_end_handler guac_rdp_upload_end_handler;

/**
 * Handler for put messages. In context of uploads and the filesystem exposed
 * via the Guacamole protocol, put messages request write access to a file
 * within the filesystem.
 */
guac_user_put_handler guac_rdp_upload_put_handler;

#endif

