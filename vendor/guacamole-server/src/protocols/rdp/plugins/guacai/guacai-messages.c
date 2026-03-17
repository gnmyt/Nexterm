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

#include "channels/audio-input/audio-buffer.h"
#include "plugins/guacai/guacai-messages.h"
#include "rdp.h"

#include <freerdp/dvc.h>
#include <guacamole/client.h>
#include <winpr/stream.h>

#include <stdlib.h>

/**
 * Reads AUDIO_FORMAT data from the given stream into the given struct.
 *
 * @param stream
 *     The stream to read AUDIO_FORMAT data from.
 *
 * @param format
 *     The structure to populate with data from the stream.
 * 
 * @return
 *     Zero on success or non-zero if an error occurs processing the format.
 */
static int guac_rdp_ai_read_format(wStream* stream,
        guac_rdp_ai_format* format) {

    /* Check that we have at least 18 bytes (5 x UINT16, 2 x UINT32) */
    if (Stream_GetRemainingLength(stream) < 18)
        return 1;
    
    /* Read audio format into structure */
    Stream_Read_UINT16(stream, format->tag); /* wFormatTag */
    Stream_Read_UINT16(stream, format->channels); /* nChannels */
    Stream_Read_UINT32(stream, format->rate); /* nSamplesPerSec */
    Stream_Read_UINT32(stream, format->bytes_per_sec); /* nAvgBytesPerSec */
    Stream_Read_UINT16(stream, format->block_align); /* nBlockAlign */
    Stream_Read_UINT16(stream, format->bps); /* wBitsPerSample */
    Stream_Read_UINT16(stream, format->data_size); /* cbSize */

    /* Read arbitrary data block (if applicable) and data is available. */
    if (format->data_size != 0) {
        
        /* Check to make sure Stream contains expected bytes. */
        if (Stream_GetRemainingLength(stream) < format->data_size)
            return 1;
        
        format->data = Stream_Pointer(stream); /* data */
        Stream_Seek(stream, format->data_size);
        
    }
    
    return 0;

}

/**
 * Writes AUDIO_FORMAT data to the given stream from the given struct.
 *
 * @param stream
 *     The stream to write AUDIO_FORMAT data to.
 *
 * @param format
 *     The structure containing the data that should be written to the stream.
 */
static void guac_rdp_ai_write_format(wStream* stream,
        guac_rdp_ai_format* format) {

    /* Write audio format into structure */
    Stream_Write_UINT16(stream, format->tag); /* wFormatTag */
    Stream_Write_UINT16(stream, format->channels); /* nChannels */
    Stream_Write_UINT32(stream, format->rate); /* nSamplesPerSec */
    Stream_Write_UINT32(stream, format->bytes_per_sec); /* nAvgBytesPerSec */
    Stream_Write_UINT16(stream, format->block_align); /* nBlockAlign */
    Stream_Write_UINT16(stream, format->bps); /* wBitsPerSample */
    Stream_Write_UINT16(stream, format->data_size); /* cbSize */

    /* Write arbitrary data block (if applicable) */
    if (format->data_size != 0)
        Stream_Write(stream, format->data, format->data_size);

}

/**
 * Sends a Data Incoming PDU along the given channel. A Data Incoming PDU is
 * used by the client to indicate to the server that format or audio data is
 * about to be sent.
 *
 * @param channel
 *     The channel along which the PDU should be sent.
 */
static void guac_rdp_ai_send_incoming_data(IWTSVirtualChannel* channel) {

    /* Build data incoming PDU */
    wStream* stream = Stream_New(NULL, 1);
    Stream_Write_UINT8(stream, GUAC_RDP_MSG_SNDIN_DATA_INCOMING); /* MessageId */

    /* Send stream */
    channel->Write(channel, (UINT32) Stream_GetPosition(stream),
            Stream_Buffer(stream), NULL);
    Stream_Free(stream, TRUE);

}

/**
 * Sends a Data PDU along the given channel. A Data PDU is used by the client
 * to send actual audio data following a Data Incoming PDU.
 *
 * @param channel
 *     The channel along which the PDU should be sent.
 *
 * @param buffer
 *     The audio data to send.
 *
 * @param length
 *     The number of bytes of audio data to send.
 */
static void guac_rdp_ai_send_data(IWTSVirtualChannel* channel,
        char* buffer, int length) {

    /* Build data PDU */
    wStream* stream = Stream_New(NULL, length + 1);
    Stream_Write_UINT8(stream, GUAC_RDP_MSG_SNDIN_DATA); /* MessageId */
    Stream_Write(stream, buffer, length); /* Data */

    /* Send stream */
    channel->Write(channel, (UINT32) Stream_GetPosition(stream),
            Stream_Buffer(stream), NULL);
    Stream_Free(stream, TRUE);

}

/**
 * Sends a Sound Formats PDU along the given channel. A Sound Formats PDU is
 * used by the client to indicate to the server which formats of audio it
 * supports (in response to the server sending exactly the same type of PDU).
 * This PDU MUST be preceded by the Data Incoming PDU.
 *
 * @param channel
 *     The channel along which the PDU should be sent.
 *
 * @param formats
 *     An array of all supported formats.
 *
 * @param num_formats
 *     The number of entries in the formats array.
 */
static void guac_rdp_ai_send_formats(IWTSVirtualChannel* channel,
        guac_rdp_ai_format* formats, int num_formats) {

    int index;
    int packet_size = 9;

    /* Calculate packet size */
    for (index = 0; index < num_formats; index++)
        packet_size += 18 + formats[index].data_size;

    wStream* stream = Stream_New(NULL, packet_size);

    /* Write header */
    Stream_Write_UINT8(stream, GUAC_RDP_MSG_SNDIN_FORMATS); /* MessageId */
    Stream_Write_UINT32(stream, num_formats); /* NumFormats */
    Stream_Write_UINT32(stream, packet_size); /* cbSizeFormatsPacket  */

    /* Write all formats */
    for (index = 0; index < num_formats; index++)
        guac_rdp_ai_write_format(stream, &(formats[index]));

    /* Send PDU */
    channel->Write(channel, (UINT32) Stream_GetPosition(stream),
            Stream_Buffer(stream), NULL);
    Stream_Free(stream, TRUE);

}

/**
 * Sends an Open Reply PDU along the given channel. An Open Reply PDU is
 * used by the client to acknowledge the successful opening of the AUDIO_INPUT
 * channel.
 *
 * @param channel
 *     The channel along which the PDU should be sent.
 *
 * @param result
 *     The HRESULT code to send to the server indicating success, failure, etc.
 */
static void guac_rdp_ai_send_open_reply(IWTSVirtualChannel* channel,
        UINT32 result) {

    /* Build open reply PDU */
    wStream* stream = Stream_New(NULL, 5);
    Stream_Write_UINT8(stream, GUAC_RDP_MSG_SNDIN_OPEN_REPLY); /* MessageId */
    Stream_Write_UINT32(stream, result); /* Result */

    /* Send stream */
    channel->Write(channel, (UINT32) Stream_GetPosition(stream),
            Stream_Buffer(stream), NULL);
    Stream_Free(stream, TRUE);

}

/**
 * Sends a Format Change PDU along the given channel. A Format Change PDU is
 * used by the client to acknowledge the format being used for data sent
 * along the AUDIO_INPUT channel.
 *
 * @param channel
 *     The channel along which the PDU should be sent.
 *
 * @param format
 *     The index of the format being acknowledged, which must be the index of
 *     the format within the original Sound Formats PDU received from the
 *     server.
 */
static void guac_rdp_ai_send_formatchange(IWTSVirtualChannel* channel,
        UINT32 format) {

    /* Build format change PDU */
    wStream* stream = Stream_New(NULL, 5);
    Stream_Write_UINT8(stream, GUAC_RDP_MSG_SNDIN_FORMATCHANGE); /* MessageId */
    Stream_Write_UINT32(stream, format); /* NewFormat */

    /* Send stream */
    channel->Write(channel, (UINT32) Stream_GetPosition(stream),
            Stream_Buffer(stream), NULL);
    Stream_Free(stream, TRUE);

}

void guac_rdp_ai_process_version(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Verify we have at least 4 bytes available (UINT32) */
    if (Stream_GetRemainingLength(stream) < 4) {
        guac_client_log(client, GUAC_LOG_WARNING, "Audio input Version PDU "
                "does not contain the expected number of bytes. Audio input "
                "redirection may not work as expected.");
        return;
    }
    
    UINT32 version;
    Stream_Read_UINT32(stream, version);

    /* Warn if server's version number is incorrect */
    if (version != 1)
        guac_client_log(client, GUAC_LOG_WARNING,
                "Server reports AUDIO_INPUT version %i, not 1", version);

    /* Build response version PDU */
    wStream* response = Stream_New(NULL, 5);
    Stream_Write_UINT8(response,  GUAC_RDP_MSG_SNDIN_VERSION); /* MessageId */
    Stream_Write_UINT32(response, 1); /* Version */

    /* Send response */
    pthread_mutex_lock(&(rdp_client->message_lock));
    channel->Write(channel, (UINT32) Stream_GetPosition(response), Stream_Buffer(response), NULL);
    pthread_mutex_unlock(&(rdp_client->message_lock));
    Stream_Free(response, TRUE);

}

void guac_rdp_ai_process_formats(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_audio_buffer* audio_buffer = rdp_client->audio_input;

    /* Verify we have at least 8 bytes available (2 x UINT32) */
    if (Stream_GetRemainingLength(stream) < 8) {
        guac_client_log(client, GUAC_LOG_WARNING, "Audio input Sound Formats "
                "PDU does not contain the expected number of bytes. Audio "
                "input redirection may not work as expected.");
        return;
    }
    
    UINT32 num_formats;
    Stream_Read_UINT32(stream, num_formats); /* NumFormats */
    Stream_Seek_UINT32(stream); /* cbSizeFormatsPacket (MUST BE IGNORED) */
    
    UINT32 index;
    for (index = 0; index < num_formats; index++) {

        guac_rdp_ai_format format;
        if (guac_rdp_ai_read_format(stream, &format)) {
            guac_client_log(client, GUAC_LOG_WARNING, "Error occurred "
                    "processing audio input formats.  Audio input redirection "
                    "may not work as expected.");
            return;
        }

        /* Ignore anything but WAVE_FORMAT_PCM */
        if (format.tag != GUAC_RDP_WAVE_FORMAT_PCM)
            continue;

        /* Set output format of internal audio buffer to match RDP server */
        guac_rdp_audio_buffer_set_output(audio_buffer, format.rate,
                format.channels, format.bps / 8);

        /* Accept single format */
        pthread_mutex_lock(&(rdp_client->message_lock));
        guac_rdp_ai_send_incoming_data(channel);
        guac_rdp_ai_send_formats(channel, &format, 1);
        pthread_mutex_unlock(&(rdp_client->message_lock));
        return;

    }

    /* No formats available */
    guac_client_log(client, GUAC_LOG_WARNING, "AUDIO_INPUT: No WAVE format.");
    pthread_mutex_lock(&(rdp_client->message_lock));
    guac_rdp_ai_send_incoming_data(channel);
    guac_rdp_ai_send_formats(channel, NULL, 0);
    pthread_mutex_unlock(&(rdp_client->message_lock));

}

void guac_rdp_ai_flush_packet(guac_rdp_audio_buffer* audio_buffer, int length) {

    guac_client* client = audio_buffer->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    IWTSVirtualChannel* channel = (IWTSVirtualChannel*) audio_buffer->data;

    /* Send data over channel */
    pthread_mutex_lock(&(rdp_client->message_lock));
    guac_rdp_ai_send_incoming_data(channel);
    guac_rdp_ai_send_data(channel, audio_buffer->packet, length);
    pthread_mutex_unlock(&(rdp_client->message_lock));

}

void guac_rdp_ai_process_open(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_audio_buffer* audio_buffer = rdp_client->audio_input;

    /* Verify we have at least 8 bytes available (2 x UINT32) */
    if (Stream_GetRemainingLength(stream) < 8) {
        guac_client_log(client, GUAC_LOG_WARNING, "Audio input Open PDU does "
                "not contain the expected number of bytes. Audio input "
                "redirection may not work as expected.");
        return;
    }
    
    UINT32 packet_frames;
    UINT32 initial_format;

    Stream_Read_UINT32(stream, packet_frames); /* FramesPerPacket */
    Stream_Read_UINT32(stream, initial_format); /* InitialFormat */

    guac_client_log(client, GUAC_LOG_DEBUG, "RDP server is accepting audio "
            "input as %i-channel, %i Hz PCM audio at %i bytes/sample.",
            audio_buffer->out_format.channels,
            audio_buffer->out_format.rate,
            audio_buffer->out_format.bps);

    /* Success */
    pthread_mutex_lock(&(rdp_client->message_lock));
    guac_rdp_ai_send_formatchange(channel, initial_format);
    guac_rdp_ai_send_open_reply(channel, 0);
    pthread_mutex_unlock(&(rdp_client->message_lock));

    /* Begin receiving audio data */
    guac_rdp_audio_buffer_begin(audio_buffer, packet_frames,
            guac_rdp_ai_flush_packet, channel);

}

void guac_rdp_ai_process_formatchange(guac_client* client,
        IWTSVirtualChannel* channel, wStream* stream) {

    /* Should not be called as we only accept one format */
    guac_client_log(client, GUAC_LOG_DEBUG,
            "RDP server requesting AUDIO_INPUT format change despite only one "
            "format available.");

}

