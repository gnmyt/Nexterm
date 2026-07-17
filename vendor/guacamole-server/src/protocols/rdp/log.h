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

#ifndef GUAC_RDP_LOG_H
#define GUAC_RDP_LOG_H

#include <guacamole/client.h>

/**
 * Redirects the core FreeRDP logging facility, wLog, such that it logs all
 * messages at the debug level using guac_client_log().
 *
 * @param client
 *     The guac_client that should receive all log messages.
 */
void guac_rdp_redirect_wlog(guac_client* client);

/**
 * Stops FreeRDP log messages from being routed to the given guac_client, if
 * they currently are. This MUST be called before the given guac_client is
 * freed: FreeRDP's WLog root logger is global to the process, and would
 * otherwise continue to log through the freed client from any thread.
 *
 * @param client
 *     The guac_client which should no longer receive FreeRDP log messages.
 */
void guac_rdp_unredirect_wlog(guac_client* client);

#endif

