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

#ifndef GUACENC_H
#define GUACENC_H

#include "config.h"

#include <guacamole/client.h>

/**
 * The width of the output video, in pixels, if no other width is given on the
 * command line. Note that different codecs will have different restrictions
 * regarding legal widths.
 */
#define GUACENC_DEFAULT_WIDTH 640

/**
 * The height of the output video, in pixels, if no other height is given on the
 * command line. Note that different codecs will have different restrictions
 * regarding legal heights.
 */
#define GUACENC_DEFAULT_HEIGHT 480

/**
 * The desired bitrate of the output video, in bits per second, if no other
 * bitrate is given on the command line.
 */
#define GUACENC_DEFAULT_BITRATE 2000000

/**
 * The default log level below which no messages should be logged.
 */
#define GUACENC_DEFAULT_LOG_LEVEL GUAC_LOG_INFO

#endif

