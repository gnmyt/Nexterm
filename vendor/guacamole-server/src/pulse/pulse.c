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

#include "pulse/pulse.h"

#include <guacamole/audio.h>
#include <guacamole/mem.h>
#include <guacamole/client.h>
#include <guacamole/user.h>
#include <pulse/pulseaudio.h>

/**
 * Returns whether the given buffer contains only silence (only null bytes).
 *
 * @param buffer
 *     The audio buffer to check.
 *
 * @param length
 *     The length of the buffer to check.
 *
 * @return
 *     Non-zero if the audio buffer contains silence, zero otherwise.
 */
static int guac_pa_is_silence(const void* buffer, size_t length) {

    int i;

    const unsigned char* current = (const unsigned char*) buffer;

    /* For each byte in buffer */
    for (i = 0; i < length; i++) {

        /* If current value non-zero, then not silence */
        if (*(current++))
            return 0;

    }

    /* Otherwise, the buffer contains 100% silence */
    return 1;

}

/**
 * Callback invoked by PulseAudio when PCM data is available for reading
 * from the given stream. The PCM data can be read using pa_stream_peek().
 *
 * @param stream
 *     The PulseAudio stream which has PCM data available.
 *
 * @param length
 *     The number of bytes of PCM data available on the given stream.
 *
 * @param data
 *     A pointer to the guac_pa_stream structure associated with the Guacamole
 *     stream receiving audio data from PulseAudio.
 */
static void __stream_read_callback(pa_stream* stream, size_t length,
        void* data) {

    guac_pa_stream* guac_stream = (guac_pa_stream*) data;
    guac_audio_stream* audio = guac_stream->audio;

    const void* buffer;

    /* Read data */
    pa_stream_peek(stream, &buffer, &length);

    /* Continuously write received PCM data */
    if (!guac_pa_is_silence(buffer, length))
        guac_audio_stream_write_pcm(audio, buffer, length);

    /* Flush upon silence */
    else
        guac_audio_stream_flush(audio);

    /* Advance buffer */
    pa_stream_drop(stream);

}

/**
 * Callback invoked by PulseAudio when the audio stream has changed state. The
 * new state can be retrieved using pa_stream_get_state().
 *
 * @param stream
 *     The PulseAudio stream which has changed state.
 *
 * @param data
 *     A pointer to the guac_pa_stream structure associated with the Guacamole
 *     stream receiving audio data from PulseAudio.
 */
static void __stream_state_callback(pa_stream* stream, void* data) {

    guac_pa_stream* guac_stream = (guac_pa_stream*) data;
    guac_client* client = guac_stream->client;

    switch (pa_stream_get_state(stream)) {

        case PA_STREAM_UNCONNECTED:
            guac_client_log(client, GUAC_LOG_INFO,
                    "PulseAudio stream currently unconnected");
            break;

        case PA_STREAM_CREATING:
            guac_client_log(client, GUAC_LOG_INFO, "PulseAudio stream being created...");
            break;

        case PA_STREAM_READY:
            guac_client_log(client, GUAC_LOG_INFO, "PulseAudio stream now ready");
            break;

        case PA_STREAM_FAILED:
            guac_client_log(client, GUAC_LOG_INFO, "PulseAudio stream connection failed");
            break;

        case PA_STREAM_TERMINATED:
            guac_client_log(client, GUAC_LOG_INFO, "PulseAudio stream terminated");
            break;

        default:
            guac_client_log(client, GUAC_LOG_INFO,
                    "Unknown PulseAudio stream state: 0x%x",
                    pa_stream_get_state(stream));

    }

}

/**
 * Callback invoked by PulseAudio when the audio sink information has been
 * retrieved. The callback is invoked repeatedly, once for each available
 * sink, followed by one final invocation with the is_last flag set. The final
 * invocation (with is_last set) does not describe a sink; it serves as a
 * terminator only.
 *
 * @param context 
 *     The PulseAudio context which is providing the sink information.
 *
 * @param info
 *     Information describing an available audio sink.
 *
 * @param is_last
 *     Non-zero if this invocation is the final invocation of this callback for
 *     all currently-available sinks (and this invocation does not describe a
 *     sink), zero otherwise.
 *
 * @param data
 *     A pointer to the guac_pa_stream structure associated with the Guacamole
 *     stream receiving audio data from PulseAudio.
 */
static void __context_get_sink_info_callback(pa_context* context,
        const pa_sink_info* info, int is_last, void* data) {

    guac_pa_stream* guac_stream = (guac_pa_stream*) data;
    guac_client* client = guac_stream->client;

    pa_stream* stream;
    pa_sample_spec spec;
    pa_buffer_attr attr;

    /* Stop if end of list reached */
    if (is_last)
        return;

    guac_client_log(client, GUAC_LOG_INFO, "Starting streaming from \"%s\"",
            info->description);

    /* Set format */
    spec.format   = PA_SAMPLE_S16LE;
    spec.rate     = GUAC_PULSE_AUDIO_RATE;
    spec.channels = GUAC_PULSE_AUDIO_CHANNELS;

    attr.maxlength = -1;
    attr.fragsize  = GUAC_PULSE_AUDIO_FRAGMENT_SIZE;

    /* Create stream */
    stream = pa_stream_new(context, "Guacamole Audio", &spec, NULL);

    /* Set stream callbacks */
    pa_stream_set_state_callback(stream, __stream_state_callback, guac_stream);
    pa_stream_set_read_callback(stream, __stream_read_callback, guac_stream);

    /* Start stream */
    pa_stream_connect_record(stream, info->monitor_source_name, &attr,
                PA_STREAM_DONT_INHIBIT_AUTO_SUSPEND
              | PA_STREAM_ADJUST_LATENCY);

}

/**
 * Callback invoked by PulseAudio when server information has been retrieved.
 *
 * @param context 
 *     The PulseAudio context which is providing the sink information.
 *
 * @param info
 *     Information describing the PulseAudio server.
 *
 * @param data
 *     A pointer to the guac_pa_stream structure associated with the Guacamole
 *     stream receiving audio data from PulseAudio.
 */
static void __context_get_server_info_callback(pa_context* context,
        const pa_server_info* info, void* data) {

    guac_pa_stream* guac_stream = (guac_pa_stream*) data;
    guac_client* client = guac_stream->client;

    /* If no default sink, cannot continue */
    if (info->default_sink_name == NULL) {
        guac_client_log(client, GUAC_LOG_ERROR, "No default sink. Cannot stream audio.");
        return;
    }

    guac_client_log(client, GUAC_LOG_INFO, "Will use default sink: \"%s\"",
            info->default_sink_name);

    /* Wait for default sink information */
    pa_operation_unref(
            pa_context_get_sink_info_by_name(context,
                info->default_sink_name, __context_get_sink_info_callback,
                guac_stream));

}

/**
 * Callback invoked by PulseAudio when the overall audio context has changed
 * state. The new state can be retrieved using pa_context_get_state().
 *
 * @param context 
 *     The PulseAudio context which has changed state.
 *
 * @param data
 *     A pointer to the guac_pa_stream structure associated with the Guacamole
 *     stream receiving audio data from PulseAudio.
 */
static void __context_state_callback(pa_context* context, void* data) {

    guac_pa_stream* guac_stream = (guac_pa_stream*) data;
    guac_client* client = guac_stream->client;

    switch (pa_context_get_state(context)) {

        case PA_CONTEXT_UNCONNECTED:
            guac_client_log(client, GUAC_LOG_INFO,
                    "PulseAudio reports it is unconnected");
            break;

        case PA_CONTEXT_CONNECTING:
            guac_client_log(client, GUAC_LOG_INFO, "Connecting to PulseAudio...");
            break;

        case PA_CONTEXT_AUTHORIZING:
            guac_client_log(client, GUAC_LOG_INFO,
                    "Authorizing PulseAudio connection...");
            break;

        case PA_CONTEXT_SETTING_NAME:
            guac_client_log(client, GUAC_LOG_INFO, "Sending client name...");
            break;

        case PA_CONTEXT_READY:
            guac_client_log(client, GUAC_LOG_INFO, "PulseAudio now ready");
            pa_operation_unref(pa_context_get_server_info(context,
                        __context_get_server_info_callback, guac_stream));
            break;

        case PA_CONTEXT_FAILED:
            guac_client_log(client, GUAC_LOG_INFO, "PulseAudio connection failed");
            break;

        case PA_CONTEXT_TERMINATED:
            guac_client_log(client, GUAC_LOG_INFO, "PulseAudio connection terminated");
            break;

        default:
            guac_client_log(client, GUAC_LOG_INFO,
                    "Unknown PulseAudio context state: 0x%x",
                    pa_context_get_state(context));

    }

}

guac_pa_stream* guac_pa_stream_alloc(guac_client* client,
        const char* server_name) {

    guac_audio_stream* audio = guac_audio_stream_alloc(client, NULL,
            GUAC_PULSE_AUDIO_RATE, GUAC_PULSE_AUDIO_CHANNELS,
            GUAC_PULSE_AUDIO_BPS);

    /* Abort if audio stream cannot be created */
    if (audio == NULL)
        return NULL;

    /* Init main loop */
    guac_pa_stream* stream = guac_mem_alloc(sizeof(guac_pa_stream));
    stream->client = client;
    stream->audio = audio;
    stream->pa_mainloop = pa_threaded_mainloop_new();

    /* Create context */
    pa_context* context = pa_context_new(
            pa_threaded_mainloop_get_api(stream->pa_mainloop),
            "Guacamole Audio");

    /* Set up context */
    pa_context_set_state_callback(context, __context_state_callback, stream);
    pa_context_connect(context, server_name, PA_CONTEXT_NOAUTOSPAWN, NULL);

    /* Start loop */
    pa_threaded_mainloop_start(stream->pa_mainloop);

    return stream;

}

void guac_pa_stream_add_user(guac_pa_stream* stream, guac_user* user) {
    guac_audio_stream_add_user(stream->audio, user);
}

void guac_pa_stream_free(guac_pa_stream* stream) {

    /* Stop loop */
    pa_threaded_mainloop_stop(stream->pa_mainloop);

    /* Free underlying audio stream */
    guac_audio_stream_free(stream->audio);

    /* Stream now ended */
    guac_client_log(stream->client, GUAC_LOG_INFO, "Audio stream finished");
    guac_mem_free(stream);

}

