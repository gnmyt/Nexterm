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

#ifndef GUAC_RAW_ENCODER_H
#define GUAC_RAW_ENCODER_H

#include "config.h"

#include "guacamole/audio.h"

/**
 * The number of bytes to send in each audio blob.
 */
#define GUAC_RAW_ENCODER_BLOB_SIZE 6048

/**
 * The size of the raw encoder output PCM buffer, in milliseconds. The
 * equivalent size in bytes will vary by PCM rate, number of channels, and bits
 * per sample.
 */
#define GUAC_RAW_ENCODER_BUFFER_SIZE 250

/**
 * The current state of the raw encoder. The raw encoder performs very minimal
 * processing, buffering provided PCM data only as necessary to ensure audio
 * packet sizes are reasonable.
 */
typedef struct raw_encoder_state {

    /**
     * Buffer of not-yet-written raw PCM data.
     */
    unsigned char* buffer;

    /**
     * Size of the PCM buffer, in bytes.
     */
    size_t length;

    /**
     * The current number of bytes stored within the PCM buffer.
     */
    int written;

} raw_encoder_state;

/**
 * Audio encoder which writes 8-bit raw PCM (one byte per sample).
 */
extern guac_audio_encoder* raw8_encoder;

/**
 * Audio encoder which writes 16-bit raw PCM (two bytes per sample).
 */
extern guac_audio_encoder* raw16_encoder;

#endif

