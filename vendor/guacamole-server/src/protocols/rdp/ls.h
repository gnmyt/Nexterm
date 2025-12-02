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

#ifndef GUAC_RDP_LS_H
#define GUAC_RDP_LS_H

#include "common/json.h"
#include "fs.h"

#include <guacamole/protocol.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

#include <stdint.h>

/**
 * The current state of a directory listing operation.
 */
typedef struct guac_rdp_ls_status {

    /**
     * The filesystem associated with the directory being listed.
     */
    guac_rdp_fs* fs;

    /**
     * The file ID of the directory being listed.
     */
    int file_id;

    /**
     * The absolute path of the directory being listed.
     */
    char directory_name[GUAC_RDP_FS_MAX_PATH];

    /**
     * The current state of the JSON directory object being written.
     */
    guac_common_json_state json_state;

} guac_rdp_ls_status;

/**
 * Handler for ack messages received due to receipt of a "body" or "blob"
 * instruction associated with a directory list operation.
 */
guac_user_ack_handler guac_rdp_ls_ack_handler;

#endif

