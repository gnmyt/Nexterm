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

#ifndef __GUAC_VNC_CLIENT_H
#define __GUAC_VNC_CLIENT_H

#include <guacamole/client.h>

/**
 * The amount of time to wait for new messages from the VNC server before
 * moving on to internal matters, in milliseconds. This value must be kept
 * reasonably small such that a slow VNC server will not prevent external
 * events from being handled (such as the stop signal from guac_client_stop()),
 * but large enough that the message handling loop does not eat up CPU
 * spinning.
 */
#define GUAC_VNC_MESSAGE_CHECK_INTERVAL 1000

/**
 * The number of milliseconds to wait between connection attempts.
 */
#define GUAC_VNC_CONNECT_INTERVAL 1000

/**
 * Handler which frees all data associated with the guac_client.
 */
guac_client_free_handler guac_vnc_client_free_handler;

#endif

