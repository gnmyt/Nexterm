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

#ifndef GUAC_RDP_BEEP_H
#define GUAC_RDP_BEEP_H

#include <freerdp/freerdp.h>
#include <winpr/wtypes.h>

/**
 * The sample rate of the each generated beep, in samples per second.
 */
#define GUAC_RDP_BEEP_SAMPLE_RATE 8000

/**
 * The amplitude (volume) of each beep. As the beep is generated as 8-bit
 * signed PCM, this should be kept between 0 and 127 inclusive.
 */
#define GUAC_RDP_BEEP_AMPLITUDE 64

/**
 * The maximum duration of each beep, in milliseconds. This value should be
 * kept relatively small to ensure the amount of data sent for each beep is
 * minimal.
 */
#define GUAC_RDP_BEEP_MAX_DURATION 500

/**
 * Processes a Play Sound PDU received from the RDP server, beeping for the
 * requested duration and at the requested frequency. If audio has been
 * disabled for the connection, the Play Sound PDU will be silently ignored,
 * and this function has no effect. Beeps in excess of the maximum specified
 * by GUAC_RDP_BEEP_MAX_DURATION will be truncated.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @param play_sound
 *     The PLAY_SOUND_UPDATE structure representing the received Play Sound
 *     PDU.
 *
 * @return
 *     TRUE if successful, FALSE otherwise.
 */
BOOL guac_rdp_beep_play_sound(rdpContext* context,
        const PLAY_SOUND_UPDATE* play_sound);

#endif

