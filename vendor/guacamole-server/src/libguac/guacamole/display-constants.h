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

#ifndef GUAC_DISPLAY_CONSTANTS_H
#define GUAC_DISPLAY_CONSTANTS_H

/**
 * @addtogroup display
 * @{
 */

/**
 * Provides constants related to the abstract display implementation
 * (guac_display).
 *
 * @file display-constants.h
 */

/**
 * The maximum width of any guac_display, in pixels.
 */
#define GUAC_DISPLAY_MAX_WIDTH 8192

/**
 * The maximum height of any guac_display, in pixels.
 */
#define GUAC_DISPLAY_MAX_HEIGHT 8192

/**
 * The number of bytes in each pixel of raw image data within a
 * guac_display_layer, as made accessible through a call to
 * guac_display_layer_open_raw().
 */
#define GUAC_DISPLAY_LAYER_RAW_BPP 4

/**
 * @}
 */

#endif
