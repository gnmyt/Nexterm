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

#ifndef GUAC_TERMINAL_COLOR_SCHEME_H
#define GUAC_TERMINAL_COLOR_SCHEME_H

/**
 * Definitions and functions related to color scheme handling.
 *
 * @file color-scheme.h
 */

#include "palette.h"

#include <guacamole/client.h>

#include <stdlib.h>
#include <string.h>

/**
 * The name of the color scheme having black foreground and white background.
 */
#define GUAC_TERMINAL_SCHEME_BLACK_WHITE "black-white"

/**
 * The name of the color scheme having gray foreground and black background.
 */
#define GUAC_TERMINAL_SCHEME_GRAY_BLACK "gray-black"

/**
 * The name of the color scheme having green foreground and black background.
 */
#define GUAC_TERMINAL_SCHEME_GREEN_BLACK "green-black"

/**
 * The name of the color scheme having white foreground and black background.
 */
#define GUAC_TERMINAL_SCHEME_WHITE_BLACK "white-black"

/**
 * Color name representing the foreground color.
 */
#define GUAC_TERMINAL_SCHEME_FOREGROUND "foreground"

/**
 * Color name representing the background color.
 */
#define GUAC_TERMINAL_SCHEME_BACKGROUND "background"

/**
 * Color name representing a numbered color.
 */
#define GUAC_TERMINAL_SCHEME_NUMBERED "color"

/**
 * Parse a color-scheme configuration string, and return specified
 * foreground/background colors and color palette.
 *
 * @param client
 *     The client that the terminal is connected to.
 *
 * @param color_scheme
 *     The name of a pre-defined color scheme (one of the
 *     names defined by the GUAC_TERMINAL_SCHEME_* constants), or
 *     semicolon-separated list of name-value pairs, i.e. "<name>: <value> [;
 *     <name>: <value> [; ...]]". For example, "color2: rgb:cc/33/22;
 *     background: color5".
 *
 *     If blank, the default scheme of GUAC_TERMINAL_SCHEME_GRAY_BLACK will be
 *     used. If invalid, a warning will be logged, and
 *     GUAC_TERMINAL_SCHEME_GRAY_BLACK will be used.
 *
 * @param[out] foreground
 *     Parsed foreground color.
 *
 * @param[out] background
 *     Parsed background color.
 *
 * @param[in,out] palette
 *     Parsed color palette. The caller is responsible for allocating a mutable
 *     array on entry. On return, the array contains the parsed palette.
 */
void guac_terminal_parse_color_scheme(guac_client* client,
        const char* color_scheme, guac_terminal_color* foreground,
        guac_terminal_color* background,
        guac_terminal_color (*palette)[256]);

#endif

