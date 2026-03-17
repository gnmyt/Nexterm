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

#ifndef __GUAC_AUDIO_H
#define __GUAC_AUDIO_H

/**
 * Provides functions and structures used for providing simple streaming audio.
 *
 * @file audio.h
 */

#include "audio-fntypes.h"
#include "audio-types.h"
#include "client-types.h"
#include "stream-types.h"

struct guac_audio_encoder {

    /**
     * The mimetype of the audio data encoded by this audio
     * encoder.
     */
    const char* mimetype;

    /**
     * Handler which will be called when the audio stream is first created.
     */
    guac_audio_encoder_begin_handler* begin_handler;

    /**
     * Handler which will be called when PCM data is written to the audio
     * stream for encoding.
     */
    guac_audio_encoder_write_handler* write_handler;

    /**
     * Handler which will be called when the audio stream is flushed.
     */
    guac_audio_encoder_flush_handler* flush_handler;

    /**
     * Handler which will be called when the audio stream is closed.
     */
    guac_audio_encoder_end_handler* end_handler;

    /**
     * Handler which will be called when a new user joins the Guacamole
     * connection associated with an audio stream.
     */
    guac_audio_encoder_join_handler* join_handler;

};

struct guac_audio_stream {

    /**
     * Arbitrary codec encoder which will receive raw PCM data.
     */
    guac_audio_encoder* encoder;

    /**
     * The client associated with this audio stream.
     */
    guac_client* client;

    /**
     * The actual stream associated with this audio stream.
     */
    guac_stream* stream;

    /**
     * The number of samples per second of PCM data sent to this stream.
     */
    int rate;

    /**
     * The number of audio channels per sample of PCM data. Legal values are
     * 1 or 2.
     */
    int channels;

    /**
     * The number of bits per sample per channel for PCM data. Legal values are
     * 8 or 16.
     */
    int bps;

    /**
     * Encoder-specific state data.
     */
    void* data;

};

/**
 * Allocates a new audio stream at the client level which encodes audio data
 * using the given encoder. If NULL is specified for the encoder, an
 * appropriate encoder will be selected based on the encoders built into
 * libguac and the level of support declared by users associated with the
 * given guac_client. The PCM format specified here (via rate, channels, and
 * bps) must be the format used for all PCM data provided to the audio stream.
 * The format may only be changed using guac_audio_stream_reset().
 *
 * If a new user joins the connection after the audio stream is created, that
 * user will not be aware of the existence of the audio stream, and
 * guac_audio_stream_add_user() will need to be invoked to recreate the stream
 * for the new user.
 *
 * @param client
 *     The guac_client for which this audio stream is being allocated. The
 *     connection owner is given priority when determining the level of audio
 *     support. It is currently assumed that all other joining users on the
 *     connection will have the same level of audio support.
 *
 * @param encoder
 *     The guac_audio_encoder to use when encoding audio, or NULL if libguac
 *     should select an appropriate built-in encoder on its own.
 *
 * @param rate
 *     The number of samples per second of PCM data sent to this stream.
 *
 * @param channels
 *     The number of audio channels per sample of PCM data. Legal values are
 *     1 or 2.
 *
 * @param bps
 *     The number of bits per sample per channel for PCM data. Legal values are
 *     8 or 16.
 *
 * @return
 *     The newly allocated guac_audio_stream, or NULL if no audio stream could
 *     be allocated due to lack of support on the part of the connecting
 *     Guacamole client or due to reaching the maximum number of active
 *     streams.
 */
guac_audio_stream* guac_audio_stream_alloc(guac_client* client,
        guac_audio_encoder* encoder, int rate, int channels, int bps);

/**
 * Resets the given audio stream, switching to the given encoder, rate,
 * channels, and bits per sample. If NULL is specified for the encoder, the
 * encoder is left unchanged. If the encoder, rate, channels, and bits per
 * sample are all identical to the current settings, this function has no
 * effect.
 *
 * @param audio
 *     The guac_audio_stream to reset.
 *
 * @param encoder
 *     The guac_audio_encoder to use when encoding audio, or NULL to leave this
 *     unchanged.
 *
 * @param rate
 *     The number of samples per second of PCM data sent to this stream.
 *
 * @param channels
 *     The number of audio channels per sample of PCM data. Legal values are
 *     1 or 2.
 *
 * @param bps
 *     The number of bits per sample per channel for PCM data. Legal values are
 *     8 or 16.
 */
void guac_audio_stream_reset(guac_audio_stream* audio,
        guac_audio_encoder* encoder, int rate, int channels, int bps);

/**
 * Notifies the given audio stream that a user has joined the connection. The
 * audio stream itself may need to be restarted. and the audio stream will need
 * to be created for the new user to ensure they can properly handle future
 * data received along the stream.
 *
 * @param audio
 *     The guac_audio_stream associated with the Guacamole connection being
 *     joined.
 *
 * @param user
 *     The user that has joined the Guacamole connection.
 */
void guac_audio_stream_add_user(guac_audio_stream* audio, guac_user* user);

/**
 * Closes and frees the given audio stream.
 *
 * @param stream
 *     The guac_audio_stream to free.
 */
void guac_audio_stream_free(guac_audio_stream* stream);

/**
 * Writes PCM data to the given audio stream. This PCM data will be
 * automatically encoded by the audio encoder associated with this stream. The
 * PCM data must be 2-channel, 44100 Hz, with signed 16-bit samples.
 *
 * @param stream
 *     The guac_audio_stream to write PCM data through.
 *
 * @param data
 *     The PCM data to write.
 *
 * @param length
 *     The number of bytes of PCM data provided.
 */
void guac_audio_stream_write_pcm(guac_audio_stream* stream,
        const unsigned char* data, int length);

/**
 * Flushes the underlying audio buffer, if any, ensuring that all audio
 * previously written via guac_audio_stream_write_pcm() has been encoded and
 * sent to the client.
 *
 * @param stream
 *     The guac_audio_stream whose audio buffers should be flushed.
 */
void guac_audio_stream_flush(guac_audio_stream* stream);

#endif

