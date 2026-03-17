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

#ifndef GUAC_RDP_CLIENT_H
#define GUAC_RDP_CLIENT_H

#include <guacamole/client.h>

/**
 * The amount of time to wait for new messages from the RDP server before
 * moving on to internal matters, in milliseconds. This value must be kept
 * reasonably small such that a slow RDP server will not prevent external
 * events from being handled (such as the stop signal from guac_client_stop()),
 * but large enough that the message handling loop does not eat up CPU
 * spinning.
 */
#define GUAC_RDP_MESSAGE_CHECK_INTERVAL 1000

/**
 * The native resolution of most RDP connections. As Windows and other systems
 * rely heavily on forced 96 DPI, we must assume 96 DPI.
 */
#define GUAC_RDP_NATIVE_RESOLUTION 96

/**
 * The resolution of an RDP connection that would be considered high, but is
 * tolerable in the case that the client display would be unreasonably small
 * otherwise.
 */
#define GUAC_RDP_HIGH_RESOLUTION 120

/**
 * The smallest area, in pixels^2, that would be considered reasonable large
 * screen DPI needs to be adjusted.
 */
#define GUAC_RDP_REASONABLE_AREA (800*600)

/**
 * Initial rate of audio to stream, in Hz. If the RDP server uses a different
 * value, the Guacamole audio stream will simply be reset appropriately.
 */
#define GUAC_RDP_AUDIO_RATE 44100

/**
 * The number of channels to stream for audio. If the RDP server uses a
 * different value, the Guacamole audio stream will simply be reset
 * appropriately.
 */
#define GUAC_RDP_AUDIO_CHANNELS 2

/**
 * The number of bits per sample within the audio stream. If the RDP server
 * uses a different value, the Guacamole audio stream will simply be reset
 * appropriately.
 */
#define GUAC_RDP_AUDIO_BPS 16

/**
 * The maximum number of file descriptors which can be associated with an RDP
 * connection.
 */
#define GUAC_RDP_MAX_FILE_DESCRIPTORS 32

/**
 * Handler which frees all data associated with the guac_client.
 */
guac_client_free_handler guac_rdp_client_free_handler;

#endif
