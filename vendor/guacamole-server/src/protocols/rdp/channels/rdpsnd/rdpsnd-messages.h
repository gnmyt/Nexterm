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

#ifndef GUAC_RDP_CHANNELS_RDPSND_MESSAGES_H
#define GUAC_RDP_CHANNELS_RDPSND_MESSAGES_H

#include "channels/common-svc.h"

#include <winpr/stream.h>

/**
 * The header common to all RDPSND PDUs.
 */
typedef struct guac_rdpsnd_pdu_header {

    /**
     * The type of message represented by this PDU (SNDC_WAVE, etc.)
     */
    int message_type;

    /**
     * The size of the remainder of the message.
     */
    int body_size;

} guac_rdpsnd_pdu_header;

/**
 * Handler for the SNDC_FORMATS (Server Audio Formats and Version) PDU. The
 * SNDC_FORMATS PDU describes all audio formats supported by the RDP server, as
 * well as the version of RDPSND implemented.
 *
 * @param svc
 *     The RDPSND channel receiving the SNDC_FORMATS PDU.
 *
 * @param input_stream
 *     The FreeRDP input stream containing the remaining raw bytes (after the
 *     common header) of the SNDC_FORMATS PDU.
 *
 * @param header
 *     The header content of the SNDC_FORMATS PDU. All RDPSND messages contain
 *     the same header information.
 */
void guac_rdpsnd_formats_handler(guac_rdp_common_svc* svc,
        wStream* input_stream, guac_rdpsnd_pdu_header* header);

/**
 * Handler for the SNDC_TRAINING (Training) PDU. The SNDC_TRAINING PDU is used
 * to by RDP servers to test audio streaming latency, etc. without actually
 * sending audio data. See:
 *
 * https://msdn.microsoft.com/en-us/library/cc240961.aspx
 *
 * @param svc
 *     The RDPSND channel receiving the SNDC_TRAINING PDU.
 *
 * @param input_stream
 *     The FreeRDP input stream containing the remaining raw bytes (after the
 *     common header) of the SNDC_TRAINING PDU.
 *
 * @param header
 *     The header content of the SNDC_TRAINING PDU. All RDPSND messages contain
 *     the same header information.
 */
void guac_rdpsnd_training_handler(guac_rdp_common_svc* svc,
        wStream* input_stream, guac_rdpsnd_pdu_header* header);

/**
 * Handler for the SNDC_WAVE (WaveInfo) PDU. The SNDC_WAVE immediately precedes
 * a SNDWAV PDU and describes the data about to be received. It also (very
 * strangely) contains exactly 4 bytes of audio data. The following SNDWAV PDU
 * then contains 4 bytes of padding prior to the audio data where it would make
 * perfect sense for this data to go. See:
 *
 * https://msdn.microsoft.com/en-us/library/cc240963.aspx
 *
 * @param svc
 *     The RDPSND channel receiving the SNDC_WAVE PDU.
 *
 * @param input_stream
 *     The FreeRDP input stream containing the remaining raw bytes (after the
 *     common header) of the SNDC_WAVE PDU.
 *
 * @param header
 *     The header content of the SNDC_WAVE PDU. All RDPSND messages contain
 *     the same header information.
 */
void guac_rdpsnd_wave_info_handler(guac_rdp_common_svc* svc,
        wStream* input_stream, guac_rdpsnd_pdu_header* header);

/**
 * Handler for the SNDWAV (Wave) PDU which follows any WaveInfo PDU. The SNDWAV
 * PDU contains the actual audio data, less the four bytes of audio data
 * included in the SNDC_WAVE PDU.
 *
 * @param svc
 *     The RDPSND channel receiving the SNDWAV PDU.
 *
 * @param input_stream
 *     The FreeRDP input stream containing the remaining raw bytes (after the
 *     common header) of the SNDWAV PDU.
 *
 * @param header
 *     The header content of the SNDWAV PDU. All RDPSND messages contain
 *     the same header information.
 */
void guac_rdpsnd_wave_handler(guac_rdp_common_svc* svc,
        wStream* input_stream, guac_rdpsnd_pdu_header* header);

/**
 * Handler for the SNDC_CLOSE (Close) PDU. This PDU is sent when audio
 * streaming has stopped. This PDU is currently ignored by Guacamole. See:
 *
 * https://msdn.microsoft.com/en-us/library/cc240970.aspx
 *
 * @param svc
 *     The RDPSND channel receiving the SNDC_CLOSE PDU.
 *
 * @param input_stream
 *     The FreeRDP input stream containing the remaining raw bytes (after the
 *     common header) of the SNDC_CLOSE PDU.
 *
 * @param header
 *     The header content of the SNDC_CLOSE PDU. All RDPSND messages contain
 *     the same header information.
 */
void guac_rdpsnd_close_handler(guac_rdp_common_svc* svc,
        wStream* input_stream, guac_rdpsnd_pdu_header* header);

#endif

