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

#ifndef _GUAC_TERMINAL_TYPES_H
#define _GUAC_TERMINAL_TYPES_H

/**
 * Structures and function definitions related to individual characters
 * within the terminal.
 *
 * @file types.h
 */

#include "palette.h"

#include <stdbool.h>
#include <stdint.h>

/**
 * A character which is not truly a character, but rather part of an
 * existing character which spans multiple columns. The original
 * character will be somewhere earlier in the row, separated from
 * this character by a contiguous string of zero of more
 * GUAC_CHAR_CONTINUATION characters.
 */
#define GUAC_CHAR_CONTINUATION -1

/**
 * The ASCII code of space.
 */
#define GUAC_CHAR_SPACE 32

/**
 * Terminal attributes, as can be applied to a single character.
 */
typedef struct guac_terminal_attributes {

    /**
     * Whether the character should be rendered bold.
     */
    bool bold : 1;

    /**
     * Whether the character should be rendered with half brightness (faint
     * or low intensity).
     */
    bool half_bright : 1;

    /**
     * Whether the associated character is highlighted by the cursor.
     */
    bool cursor : 1;

    /**
     * Whether the character should be rendered with reversed colors
     * (background becomes foreground and vice-versa).
     */
    bool reverse : 1;

    /**
     * Whether to render the character with underscore.
     */
    bool underscore : 1;

    /**
     * The foreground color of this character.
     */
    guac_terminal_color foreground;

    /**
     * The background color of this character.
     */
    guac_terminal_color background;

} guac_terminal_attributes;

/**
 * Represents a single character for display in a terminal, including actual
 * character value, foreground color, and background color.
 */
typedef struct guac_terminal_char {

    /**
     * The Unicode codepoint of the character to display, or
     * GUAC_CHAR_CONTINUATION if this character is part of
     * another character which spans multiple columns.
     */
    int value;

    /**
     * The attributes of the character to display.
     */
    guac_terminal_attributes attributes;

    /**
     * The number of columns this character occupies. If the character is
     * GUAC_CHAR_CONTINUATION, this value is undefined and not applicable.
     */
    int width;

} guac_terminal_char;

#endif

