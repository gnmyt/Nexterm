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

#ifndef __GUAC_AUDIO_TYPES_H
#define __GUAC_AUDIO_TYPES_H

/**
 * Type definitions related to simple streaming audio.
 *
 * @file audio-types.h
 */

/**
 * Basic audio stream. PCM data is added to the stream. When the stream is
 * flushed, a write handler receives PCM data packets and, presumably, streams
 * them to the guac_stream provided.
 */
typedef struct guac_audio_stream guac_audio_stream;

/**
 * Arbitrary audio codec encoder.
 */
typedef struct guac_audio_encoder guac_audio_encoder;

#endif

