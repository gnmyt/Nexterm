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

#include "config.h"

#include "guacamole/mem.h"
#include "guacamole/audio.h"
#include "guacamole/client.h"
#include "guacamole/protocol.h"
#include "guacamole/socket.h"
#include "guacamole/user.h"
#include "raw_encoder.h"

#include <stdlib.h>
#include <stdio.h>
#include <string.h>

static void raw_encoder_send_audio(guac_audio_stream* audio,
        guac_socket* socket) {

    char mimetype[256];

    /* Produce mimetype string from format info */
    snprintf(mimetype, sizeof(mimetype), "audio/L%i;rate=%i,channels=%i",
            audio->bps, audio->rate, audio->channels);

    /* Associate stream */
    guac_protocol_send_audio(socket, audio->stream, mimetype);

}

static void raw_encoder_begin_handler(guac_audio_stream* audio) {

    raw_encoder_state* state;

    /* Broadcast existence of stream */
    raw_encoder_send_audio(audio, audio->client->socket);

    /* Allocate and init encoder state */
    audio->data = state = guac_mem_alloc(sizeof(raw_encoder_state));
    state->written = 0;
    state->length = guac_mem_ckd_mul_or_die(GUAC_RAW_ENCODER_BUFFER_SIZE,
            audio->rate, audio->channels, audio->bps) / 8 / 1000;

    state->buffer = guac_mem_alloc(state->length);

}

static void raw_encoder_join_handler(guac_audio_stream* audio,
        guac_user* user) {

    /* Notify user of existence of stream */
    raw_encoder_send_audio(audio, user->socket);

}

static void raw_encoder_end_handler(guac_audio_stream* audio) {

    raw_encoder_state* state = (raw_encoder_state*) audio->data;

    /* Send end of stream */
    guac_protocol_send_end(audio->client->socket, audio->stream);

    /* Free state information */
    guac_mem_free(state->buffer);
    guac_mem_free(state);

}

static void raw_encoder_write_handler(guac_audio_stream* audio, 
        const unsigned char* pcm_data, int length) {

    raw_encoder_state* state = (raw_encoder_state*) audio->data;

    while (length > 0) {

        /* Prefer to copy a chunk of equal size to available buffer space */
        int chunk_size = state->length - state->written;

        /* If no space remains, flush and retry */
        if (chunk_size == 0) {
            guac_audio_stream_flush(audio);
            continue;
        }

        /* Do not copy more data than is available in source PCM */
        if (chunk_size > length)
            chunk_size = length;

        /* Copy block of PCM data into buffer */
        memcpy(state->buffer + state->written, pcm_data, chunk_size);

        /* Advance to next block */
        state->written += chunk_size;
        pcm_data += chunk_size;
        length -= chunk_size;

    }

}

static void raw_encoder_flush_handler(guac_audio_stream* audio) {

    raw_encoder_state* state = (raw_encoder_state*) audio->data;
    guac_socket* socket = audio->client->socket;
    guac_stream* stream = audio->stream;

    /* Flush all data in buffer as blobs */
    guac_protocol_send_blobs(socket, stream, state->buffer, state->written);

    /* All data has been flushed */
    state->written = 0;

}

/* 8-bit raw encoder handlers */
guac_audio_encoder _raw8_encoder = {
    .mimetype      = "audio/L8",
    .begin_handler = raw_encoder_begin_handler,
    .write_handler = raw_encoder_write_handler,
    .flush_handler = raw_encoder_flush_handler,
    .join_handler  = raw_encoder_join_handler,
    .end_handler   = raw_encoder_end_handler
};

/* 16-bit raw encoder handlers */
guac_audio_encoder _raw16_encoder = {
    .mimetype      = "audio/L16",
    .begin_handler = raw_encoder_begin_handler,
    .write_handler = raw_encoder_write_handler,
    .flush_handler = raw_encoder_flush_handler,
    .join_handler  = raw_encoder_join_handler,
    .end_handler   = raw_encoder_end_handler
};

/* Actual encoder definitions */
guac_audio_encoder* raw8_encoder  = &_raw8_encoder;
guac_audio_encoder* raw16_encoder = &_raw16_encoder;

