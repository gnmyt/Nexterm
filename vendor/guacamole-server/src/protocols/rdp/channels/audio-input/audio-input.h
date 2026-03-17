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

#ifndef GUAC_RDP_CHANNELS_AUDIO_INPUT_H
#define GUAC_RDP_CHANNELS_AUDIO_INPUT_H

#include <freerdp/freerdp.h>
#include <guacamole/user.h>

/**
 * Handler for inbound audio data (audio input).
 */
guac_user_audio_handler guac_rdp_audio_handler;

/**
 * Handler for stream data related to audio input.
 */
guac_user_blob_handler guac_rdp_audio_blob_handler;

/**
 * Handler for end-of-stream related to audio input.
 */
guac_user_end_handler guac_rdp_audio_end_handler;

/**
 * Adds Guacamole's "guacai" plugin to the list of dynamic virtual channel
 * plugins to be loaded by FreeRDP's "drdynvc" plugin. The plugin will only
 * be loaded once the "drdynvc" plugin is loaded. The "guacai" plugin
 * ultimately adds support for the "AUDIO_INPUT" dynamic virtual channel.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 */
void guac_rdp_audio_load_plugin(rdpContext* context);

#endif

