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

#ifndef GUAC_PULSE_H
#define GUAC_PULSE_H

#include "config.h"

#include <guacamole/audio.h>
#include <guacamole/client.h>
#include <guacamole/user.h>
#include <pulse/pulseaudio.h>

/**
 * The number of bytes to request for the audio fragments received from
 * PulseAudio.
 */
#define GUAC_PULSE_AUDIO_FRAGMENT_SIZE 8192

/**
 * The minimum number of PCM bytes to wait for before flushing an audio
 * packet. The current value is 48K, which works out to be around 280ms.
 */
#define GUAC_PULSE_PCM_WRITE_RATE 49152

/**
 * Rate of audio to stream, in Hz.
 */
#define GUAC_PULSE_AUDIO_RATE 44100

/**
 * The number of channels to stream.
 */
#define GUAC_PULSE_AUDIO_CHANNELS 2

/**
 * The number of bits per sample.
 */
#define GUAC_PULSE_AUDIO_BPS 16

/**
 * An audio stream which connects to a PulseAudio server and streams the
 * received audio through a guac_client.
 */
typedef struct guac_pa_stream {

    /**
     * The client associated with the audio stream.
     */
    guac_client* client;

    /**
     * Audio output stream.
     */
    guac_audio_stream* audio;

    /**
     * PulseAudio event loop.
     */
    pa_threaded_mainloop* pa_mainloop;

} guac_pa_stream;

/**
 * Allocates a new PulseAudio audio stream for the given Guacamole client and
 * begins streaming.
 *
 * @param client
 *     The client to stream audio to.
 *
 * @param server_name
 *     The hostname of the PulseAudio server to connect to, or NULL to connect
 *     to the default (local) server.
 *
 * @return
 *     A newly-allocated PulseAudio stream, or NULL if audio cannot be
 *     streamed.
 */
guac_pa_stream* guac_pa_stream_alloc(guac_client* client,
        const char* server_name);

/**
 * Notifies the given PulseAudio stream that a user has joined the connection.
 * The audio stream itself may need to be restarted. and the audio stream will
 * need to be created for the new user to ensure they can properly handle
 * future data received along the stream.
 *
 * @param stream
 *     The guac_pa_stream associated with the Guacamole connection being
 *     joined.
 *
 * @param user
 *     The user that has joined the Guacamole connection.
 */
void guac_pa_stream_add_user(guac_pa_stream* stream, guac_user* user);

/**
 * Stops streaming audio from the given PulseAudio stream, freeing all
 * associated resources.
 *
 * @param stream
 *     The PulseAudio stream to free.
 */
void guac_pa_stream_free(guac_pa_stream* stream);

#endif

