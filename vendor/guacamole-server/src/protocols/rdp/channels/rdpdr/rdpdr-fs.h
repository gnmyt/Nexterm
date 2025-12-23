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

#ifndef GUAC_RDP_RDPDR_FS_H
#define GUAC_RDP_RDPDR_FS_H

/**
 * Functions and macros specific to filesystem handling and initialization
 * independent of RDP. The functions here may deal with the RDPDR device
 * directly, but their semantics must not deal with RDP protocol messaging.
 * Functions here represent a virtual Windows-style filesystem on top of UNIX
 * system calls and structures, using the guac_rdpdr_device structure as a home
 * for common data.
 *
 * @file rdpdr-fs.h 
 */

#include "channels/common-svc.h"
#include "channels/rdpdr/rdpdr.h"

#include <guacamole/pool.h>

/**
 * The UTF-16 string that should be sent as the label of the filesystem.
 */
#define GUAC_FILESYSTEM_LABEL "G\0U\0A\0C\0F\0I\0L\0E\0"

/**
 * The size of GUAC_FILESYSTEM_LABEL in bytes.
 */
#define GUAC_FILESYSTEM_LABEL_LENGTH 16

/**
 * Registers a new filesystem device within the RDPDR plugin. This must be done
 * before RDPDR connection finishes.
 * 
 * @param svc
 *     The static virtual channel instance being used for RDPDR.
 * 
 * @param drive_name
 *     The name of the redirected drive to display in the RDP connection.
 */
void guac_rdpdr_register_fs(guac_rdp_common_svc* svc, char* drive_name);

#endif

