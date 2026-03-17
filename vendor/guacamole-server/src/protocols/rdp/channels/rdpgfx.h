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

#ifndef GUAC_RDP_CHANNELS_RDPGFX_H
#define GUAC_RDP_CHANNELS_RDPGFX_H

#include "settings.h"

#include <freerdp/client/rdpgfx.h>
#include <freerdp/freerdp.h>
#include <guacamole/client.h>

/**
 * Adds FreeRDP's "rdpgfx" plugin to the list of dynamic virtual channel plugins
 * to be loaded by FreeRDP's "drdynvc" plugin. The context of the plugin will
 * automatically be associated with the guac_rdp_rdpgfx instance pointed to by the
 * current guac_rdp_client. The plugin will only be loaded once the "drdynvc"
 * plugin is loaded. The "rdpgfx" plugin ultimately adds support for the RDP
 * Graphics Pipeline Extension.
 *
 * If failures occur, messages noting the specifics of those failures will be
 * logged.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * for Graphics Pipeline support to be loaded.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 */
void guac_rdp_rdpgfx_load_plugin(rdpContext* context);

#endif

