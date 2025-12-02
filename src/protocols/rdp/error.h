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

#ifndef GUAC_RDP_ERROR_H
#define GUAC_RDP_ERROR_H

#include <freerdp/freerdp.h>
#include <guacamole/client.h>

/**
 * Stops the current connection due to the RDP server disconnecting or the
 * connection attempt failing. If the RDP server or FreeRDP provided a reason
 * for for the failure/disconnect, that reason will be logged, and an
 * appropriate error code will be sent to the Guacamole client.
 *
 * @param client
 *     The Guacamole client to disconnect.
 *
 * @param rdp_inst
 *     The FreeRDP client instance handling the RDP connection that failed.
 */
void guac_rdp_client_abort(guac_client* client, freerdp* rdp_inst);

#endif

