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

#ifndef GUAC_RDP_PLUGINS_GUACAI_MESSAGES_H
#define GUAC_RDP_PLUGINS_GUACAI_MESSAGES_H

#include "channels/audio-input/audio-buffer.h"

#include <freerdp/dvc.h>
#include <guacamole/client.h>
#include <winpr/stream.h>
#include <winpr/wtypes.h>

/**
 * The format tag associated with raw wave audio (WAVE_FORMAT_PCM). This format
 * is required to be supported by all RDP servers.
 */
#define GUAC_RDP_WAVE_FORMAT_PCM 0x01

/**
 * The message ID associated with the AUDIO_INPUT Version PDU. The Version PDU
 * is sent by both the client and the server to indicate their version of the
 * AUDIO_INPUT channel protocol (which must always be 1).
 */
#define GUAC_RDP_MSG_SNDIN_VERSION 0x01

/**
 * The message ID associated with the AUDIO_INPUT Sound Formats PDU. The
 * Sound Formats PDU is sent by the client and the server to indicate the
 * formats of audio supported.
 */
#define GUAC_RDP_MSG_SNDIN_FORMATS 0x02

/**
 * The message ID associated with the AUDIO_INPUT Open PDU. The Open PDU is
 * sent by the server to inform the client that the AUDIO_INPUT channel is
 * now open.
 */
#define GUAC_RDP_MSG_SNDIN_OPEN 0x03

/**
 * The message ID associated with the AUDIO_INPUT Open Reply PDU. The Open
 * Reply PDU is sent by the client (after sending a Format Change PDU) to
 * acknowledge that the AUDIO_INPUT channel is open.
 */
#define GUAC_RDP_MSG_SNDIN_OPEN_REPLY 0x04

/**
 * The message ID associated with the AUDIO_INPUT Incoming Data PDU. The
 * Incoming Data PDU is sent by the client to inform the server of incoming
 * sound format or audio data.
 */
#define GUAC_RDP_MSG_SNDIN_DATA_INCOMING 0x05

/**
 * The message ID associated with the AUDIO_INPUT Data PDU. The Data PDU is
 * sent by the client and contains audio data read from the microphone.
 */
#define GUAC_RDP_MSG_SNDIN_DATA 0x06

/**
 * The message ID associated with the AUDIO_INPUT Format Change PDU. The Format
 * Change PDU is sent by the client to acknowledge the current sound format, or
 * by the server to request a different sound format.
 */
#define GUAC_RDP_MSG_SNDIN_FORMATCHANGE 0x07

/**
 * An AUDIO_INPUT format, analogous to the AUDIO_FORMAT structure defined
 * within Microsoft's RDP documentation.
 */
typedef struct guac_rdp_ai_format {

    /**
     * The "format tag" denoting the overall format of audio data received,
     * such as WAVE_FORMAT_PCM.
     */
    UINT16 tag;

    /**
     * The number of audio channels.
     */
    UINT16 channels;

    /**
     * The number of samples per second.
     */
    UINT32 rate;

    /**
     * The average number of bytes required for one second of audio.
     */
    UINT32 bytes_per_sec;

    /**
     * The absolute minimum number of bytes required to process audio in this
     * format.
     */
    UINT16 block_align;

    /**
     * The number of bits per sample.
     */
    UINT16 bps;

    /**
     * The size of the arbitrary data block, if any. The meaning of the data
     * within the arbitrary data block is determined by the format tag.
     * WAVE_FORMAT_PCM audio has no associated arbitrary data.
     */
    UINT16 data_size;

    /**
     * Optional arbitrary data whose meaning is determined by the format tag.
     * WAVE_FORMAT_PCM audio has no associated arbitrary data.
     */
    BYTE* data;

} guac_rdp_ai_format;

/**
 * Processes a Version PDU received from the RDP server. The Version PDU is
 * sent by the server to indicate its version of the AUDIO_INPUT channel
 * protocol (which must always be 1).
 *
 * @param client
 *     The guac_client associated with the current RDP connection.
 *
 * @param channel
 *     The IWTSVirtualChannel instance associated with the connected
 *     AUDIO_INPUT channel.
 *
 * @param stream
 *     The received PDU, with the read position just after the message ID field
 *     common to all AUDIO_INPUT PDUs.
 */
void guac_rdp_ai_process_version(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream);

/**
 * Processes a Sound Formats PDU received from the RDP server. The Sound
 * Formats PDU is sent by the server to indicate the formats of audio
 * supported.
 *
 * @param client
 *     The guac_client associated with the current RDP connection.
 *
 * @param channel
 *     The IWTSVirtualChannel instance associated with the connected
 *     AUDIO_INPUT channel.
 *
 * @param stream
 *     The received PDU, with the read position just after the message ID field
 *     common to all AUDIO_INPUT PDUs.
 */
void guac_rdp_ai_process_formats(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream);

/**
 * Processes a Open PDU received from the RDP server. The Open PDU is sent by
 * the server to inform the client that the AUDIO_INPUT channel is now open.
 *
 * @param client
 *     The guac_client associated with the current RDP connection.
 *
 * @param channel
 *     The IWTSVirtualChannel instance associated with the connected
 *     AUDIO_INPUT channel.
 *
 * @param stream
 *     The received PDU, with the read position just after the message ID field
 *     common to all AUDIO_INPUT PDUs.
 */
void guac_rdp_ai_process_open(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream);

/**
 * Processes a Format Change PDU received from the RDP server. The Format
 * Change PDU is sent by the server to request a different sound format.
 *
 * @param client
 *     The guac_client associated with the current RDP connection.
 *
 * @param channel
 *     The IWTSVirtualChannel instance associated with the connected
 *     AUDIO_INPUT channel.
 *
 * @param stream
 *     The received PDU, with the read position just after the message ID field
 *     common to all AUDIO_INPUT PDUs.
 */
void guac_rdp_ai_process_formatchange(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream);

/**
 * Audio buffer flush handler which sends audio data along the active audio
 * input channel using a Data Incoming PDU and Data PDU. The arbitrary data
 * provided to the handler by the audio buffer implementation is in this case
 * the IWTSVirtualChannel structure representing the active audio input
 * channel.
 */
guac_rdp_audio_buffer_flush_handler guac_rdp_ai_flush_packet;

#endif

