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

#ifndef GUAC_RDP_CHANNELS_RDPSND_H
#define GUAC_RDP_CHANNELS_RDPSND_H

#include "channels/common-svc.h"

#include <freerdp/freerdp.h>
#include <guacamole/client.h>

/**
 * The maximum number of PCM formats to accept during the initial RDPSND
 * handshake with the RDP server.
 */
#define GUAC_RDP_MAX_FORMATS 16

/**
 * Abstract representation of a PCM format, including the sample rate, number
 * of channels, and bits per sample.
 */
typedef struct guac_rdpsnd_pcm_format {

    /**
     * The sample rate of this PCM format.
     */
    int rate;

    /**
     * The number off channels used by this PCM format. This will typically
     * be 1 or 2.
     */
    int channels;

    /**
     * The number of bits per sample within this PCM format. This should be
     * either 8 or 16.
     */
    int bps;

} guac_rdpsnd_pcm_format;

/**
 * Structure representing the current state of the Guacamole RDPSND plugin for
 * FreeRDP.
 */
typedef struct guac_rdpsnd {

    /**
     * The block number of the last SNDC_WAVE (WaveInfo) PDU received.
     */
    int waveinfo_block_number;

    /**
     * Whether the next PDU coming is a SNDWAVE (Wave) PDU. Wave PDUs do not
     * have headers, and are indicated by the receipt of a WaveInfo PDU.
     */
    int next_pdu_is_wave;

    /**
     * The wave data received within the last SNDC_WAVE (WaveInfo) PDU.
     */
    unsigned char initial_wave_data[4];

    /**
     * The size, in bytes, of the wave data in the coming Wave PDU, if any.
     * This does not include the initial wave data received within the last
     * SNDC_WAVE (WaveInfo) PDU, which is always the first four bytes of the
     * actual wave data block.
     */
    int incoming_wave_size;

    /**
     * The last received server timestamp.
     */
    int server_timestamp;

    /**
     * All formats agreed upon by server and client during the initial format
     * exchange. All of these formats will be PCM, which is the only format
     * guaranteed to be supported (based on the official RDP documentation).
     */
    guac_rdpsnd_pcm_format formats[GUAC_RDP_MAX_FORMATS];

    /**
     * The total number of formats.
     */
    int format_count;

} guac_rdpsnd;

/**
 * Initializes audio output support for RDP and handling of the RDPSND channel.
 * If failures occur, messages noting the specifics of those failures will be
 * logged, and the RDP side of audio output support will not be functional.
 *
 * This MUST be called within the PreConnect callback of the freerdp instance
 * for RDPSND support to be loaded.
 *
 * @param context
 *     The rdpContext associated with the FreeRDP side of the RDP connection.
 */
void guac_rdpsnd_load_plugin(rdpContext* context);

/**
 * Handler which is invoked when the RDPSND channel is connected to the RDP
 * server.
 */
guac_rdp_common_svc_connect_handler guac_rdpsnd_process_connect;

/**
 * Handler which is invoked when the RDPSND channel has received data from the
 * RDP server.
 */
guac_rdp_common_svc_receive_handler guac_rdpsnd_process_receive;

/**
 * Handler which is invoked when the RDPSND channel has disconnected and is
 * about to be freed.
 */
guac_rdp_common_svc_terminate_handler guac_rdpsnd_process_terminate;

#endif

