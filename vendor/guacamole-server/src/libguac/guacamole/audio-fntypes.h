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

#ifndef GUAC_AUDIO_FNTYPES_H
#define GUAC_AUDIO_FNTYPES_H

/**
 * Function type definitions related to simple streaming audio.
 *
 * @file audio-fntypes.h
 */

#include "audio-types.h"
#include "user-types.h"

/**
 * Handler which is called when the audio stream is opened.
 *
 * @param audio
 *     The audio stream being opened.
 */
typedef void guac_audio_encoder_begin_handler(guac_audio_stream* audio);

/**
 * Handler which is called when the audio stream needs to be flushed.
 *
 * @param audio
 *     The audio stream being flushed.
 */
typedef void guac_audio_encoder_flush_handler(guac_audio_stream* audio);

/**
 * Handler which is called when the audio stream is closed.
 *
 * @param audio
 *     The audio stream being closed.
 */
typedef void guac_audio_encoder_end_handler(guac_audio_stream* audio);

/**
 * Handler which is called when a new user has joined the Guacamole
 * connection associated with the audio stream.
 *
 * @param audio
 *     The audio stream associated with the Guacamole connection being
 *     joined.
 *
 * @param user
 *     The user that joined the connection.
 */
typedef void guac_audio_encoder_join_handler(guac_audio_stream* audio,
        guac_user* user);

/**
 * Handler which is called when PCM data is written to the audio stream. The
 * format of the PCM data is dictated by the properties of the audio stream.
 *
 * @param audio
 *     The audio stream to which data is being written.
 *
 * @param pcm_data
 *     A buffer containing the raw PCM data to be written.
 *
 * @param length
 *     The number of bytes within the buffer that should be written to the
 *     audio stream.
 */
typedef void guac_audio_encoder_write_handler(guac_audio_stream* audio,
        const unsigned char* pcm_data, int length);

#endif

