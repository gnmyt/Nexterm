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

#include "beep.h"
#include "rdp.h"
#include "settings.h"

#include <freerdp/freerdp.h>
#include <guacamole/audio.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <winpr/wtypes.h>

#include <inttypes.h>
#include <stdlib.h>
#include <string.h>

/**
 * Fills the given buffer with signed 8-bit, single-channel PCM at the given
 * sample rate which will produce a beep of the given frequency.
 *
 * @param buffer
 *     The buffer to fill with PCM data.
 *
 * @param frequency
 *     The frequency of the beep to generate, in hertz.
 *
 * @param rate
 *     The sample rate of the PCM to generate, in samples per second.
 *
 * @param buffer_size
 *     The number of bytes of PCM data to write to the given buffer.
 */
static void guac_rdp_beep_fill_triangle_wave(unsigned char* buffer,
        int frequency, int rate, int buffer_size) {

    /* With the distance between each positive/negative peak and zero being the
     * amplitude, and with the "bounce" between those peaks occurring once
     * every two periods, the number of distinct states that the triangle wave
     * function goes through is twice the peak-to-peak amplitude, or four times
     * the overall amplitude */
    const int wave_period = GUAC_RDP_BEEP_AMPLITUDE * 4;

    /* With the number of distinct states being the wave_period defined above,
     * the "bounce" point within that period is half the period */
    const int wave_bounce_offset = wave_period / 2;

    for (int position = 0; position < buffer_size; position++) {

        /* Calculate relative position within the repeating portion of the wave
         * (the portion with wave_period unique states) */
        int wave_position = (position * frequency * wave_period / rate) % wave_period;

        /* Calculate state of the triangle wave function at the calculated
         * offset, knowing in advance the relative location that the function
         * should "bounce" */
        *(buffer++) = abs(wave_position - wave_bounce_offset) - GUAC_RDP_BEEP_AMPLITUDE;

    }

}

/**
 * Writes PCM data to the given guac_audio_stream which produces a beep of the
 * given frequency and duration. The provided guac_audio_stream may be
 * configured for any sample rate but MUST be configured for single-channel,
 * 8-bit PCM.
 *
 * @param audio
 *     The guac_audio_stream which should receive the PCM data.
 *
 * @param frequency
 *     The frequency of the beep, in hertz.
 *
 * @param duration
 *     The duration of the beep, in milliseconds.
 */
static void guac_rdp_beep_write_pcm(guac_audio_stream* audio,
        int frequency, int duration) {

    size_t buffer_size = guac_mem_ckd_mul_or_die(audio->rate, duration) / 1000;
    unsigned char* buffer = guac_mem_alloc(buffer_size);

    /* Beep for given frequency/duration using a simple triangle wave */
    guac_rdp_beep_fill_triangle_wave(buffer, frequency, audio->rate, buffer_size);
    guac_audio_stream_write_pcm(audio, buffer, buffer_size);

    guac_mem_free(buffer);

}

BOOL guac_rdp_beep_play_sound(rdpContext* context,
        const PLAY_SOUND_UPDATE* play_sound) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_settings* settings = rdp_client->settings;

    /* Ignore if audio is not enabled */
    if (!settings->audio_enabled) {
        guac_client_log(client, GUAC_LOG_DEBUG, "Ignoring request to beep "
                "for %" PRIu32 " milliseconds at %" PRIu32 " Hz as audio is "
                "disabled.", play_sound->duration, play_sound->frequency);
        return TRUE;
    }

    /* Allocate audio stream which sends audio in a format supported by the
     * connected client(s) */
    guac_audio_stream* beep = guac_audio_stream_alloc(client, NULL,
            GUAC_RDP_BEEP_SAMPLE_RATE, 1, 8);

    /* Stream availability is not guaranteed */
    if (beep == NULL) {
        guac_client_log(client, GUAC_LOG_DEBUG, "Ignoring request to beep "
                "for %" PRIu32 " milliseconds at %" PRIu32 " Hz as no audio "
                "stream could be allocated.", play_sound->duration,
                play_sound->frequency);
        return TRUE;
    }

    /* Limit maximum duration of each beep */
    int duration = play_sound->duration;
    if (duration > GUAC_RDP_BEEP_MAX_DURATION)
        duration = GUAC_RDP_BEEP_MAX_DURATION;

    guac_rdp_beep_write_pcm(beep, play_sound->frequency, duration);
    guac_audio_stream_free(beep);

    return TRUE;

}

