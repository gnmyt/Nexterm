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

#ifndef GUACENC_ENCODE_H
#define GUACENC_ENCODE_H

#include "config.h"

#include <stdbool.h>

/**
 * Encodes the given Guacamole protocol dump as video. A read lock will be
 * acquired on the input file to ensure that in-progress recordings are not
 * encoded. This behavior can be overridden by specifying true for the force
 * parameter.
 *
 * @param path
 *     The path to the file containing the raw Guacamole protocol dump.
 *
 * @param out_path
 *     The full path to the file in which encoded video should be written.
 *
 * @param codec
 *     The name of the codec to use for the video encoding, as defined by
 *     ffmpeg / libavcodec.
 *
 * @param width
 *     The width of the desired video, in pixels.
 *
 * @param height
 *     The height of the desired video, in pixels.
 *
 * @param bitrate
 *     The desired overall bitrate of the resulting encoded video, in bits per
 *     second.
 *
 * @param force
 *     Perform the encoding, even if the input file appears to be an
 *     in-progress recording (has an associated lock).
 *
 * @return
 *     Zero on success, non-zero if an error prevented successful encoding of
 *     the video.
 */
int guacenc_encode(const char* path, const char* out_path, const char* codec,
        int width, int height, int bitrate, bool force);

#endif

