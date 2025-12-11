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

#include "terminal/color-scheme.h"
#include "terminal/palette.h"
#include "terminal/xparsecolor.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <guacamole/client.h>

/**
 * Compare a non-null-terminated string to a null-terminated literal, in the
 * same manner as strcmp().
 *
 * @param str_start
 *     Start of the non-null-terminated string.
 *
 * @param str_end
 *     End of the non-null-terminated string, after the last character.
 *
 * @param literal
 *     The null-terminated literal to compare against.
 *
 * @return
 *     Zero if the two strings are equal and non-zero otherwise.
 */
static int guac_terminal_color_scheme_compare_token(const char* str_start,
        const char* str_end, const char* literal) {

    const int result = strncmp(literal, str_start, str_end - str_start);
    if (result != 0)
        return result;

    /* At this point, literal is same length or longer than
     * | str_end - str_start |, so if the two are equal, literal should
     * have its null-terminator at | str_end - str_start |. */
    return (int) (unsigned char) literal[str_end - str_start];
}

/**
 * Strip the leading and trailing spaces of a bounded string.
 *
 * @param[in,out] str_start
 *     Address of a pointer to the start of the string. On return, the pointer
 *     is advanced to after any leading spaces.
 *
 * @param[in,out] str_end
 *     Address of a pointer to the end of the string, after the last character.
 *     On return, the pointer is moved back to before any trailing spaces.
 */
static void guac_terminal_color_scheme_strip_spaces(const char** str_start,
        const char** str_end) {

    /* Strip leading spaces. */
    while (*str_start < *str_end && isspace(**str_start))
        (*str_start)++;

    /* Strip trailing spaces. */
    while (*str_end > *str_start && isspace(*(*str_end - 1)))
        (*str_end)--;
}

/**
 * Parse the name part of the name-value pair within the color-scheme
 * configuration.
 *
 * @param client
 *     The client that the terminal is connected to.
 *
 * @param name_start
 *     Start of the name string.
 *
 * @param name_end
 *     End of the name string, after the last character.
 *
 * @param foreground
 *     Pointer to the foreground color.
 *
 * @param background
 *     Pointer to the background color.
 *
 * @param palette
 *     Pointer to the palette array.
 *
 * @param[out] target
 *     On return, pointer to the color struct that corresponds to the name.
 *
 * @return
 *     Zero if successful or non-zero otherwise.
 */
static int guac_terminal_parse_color_scheme_name(guac_client* client,
        const char* name_start, const char* name_end,
        guac_terminal_color* foreground, guac_terminal_color* background,
        guac_terminal_color (*palette)[256],
        guac_terminal_color** target) {

    guac_terminal_color_scheme_strip_spaces(&name_start, &name_end);

    if (!guac_terminal_color_scheme_compare_token(
            name_start, name_end, GUAC_TERMINAL_SCHEME_FOREGROUND)) {
        *target = foreground;
        return 0;
    }

    if (!guac_terminal_color_scheme_compare_token(
            name_start, name_end, GUAC_TERMINAL_SCHEME_BACKGROUND)) {
        *target = background;
        return 0;
    }

    /* Parse color<n> value. */
    int index = -1;
    if (sscanf(name_start, GUAC_TERMINAL_SCHEME_NUMBERED "%d", &index) &&
            index >= 0 && index <= 255) {
        *target = &(*palette)[index];
        return 0;
    }

    guac_client_log(client, GUAC_LOG_WARNING,
                    "Unknown color name: \"%.*s\".",
                    name_end - name_start, name_start);
    return 1;
}

/**
 * Parse the value part of the name-value pair within the color-scheme
 * configuration.
 *
 * @param client
 *     The client that the terminal is connected to.
 *
 * @param value_start
 *     Start of the value string.
 *
 * @param value_end
 *     End of the value string, after the last character.
 *
 * @param palette
 *     The current color palette.
 *
 * @param[out] target
 *     On return, the parsed color.
 *
 * @return
 *     Zero if successful or non-zero otherwise.
 */
static int guac_terminal_parse_color_scheme_value(guac_client* client,
        const char* value_start, const char* value_end,
        const guac_terminal_color (*palette)[256],
        guac_terminal_color* target) {

    guac_terminal_color_scheme_strip_spaces(&value_start, &value_end);

    /* Parse color<n> value. */
    int index = -1;
    if (sscanf(value_start, GUAC_TERMINAL_SCHEME_NUMBERED "%d", &index) &&
            index >= 0 && index <= 255) {
        *target = (*palette)[index];
        return 0;
    }

    /* Parse X11 value. */
    if (!guac_terminal_xparsecolor(value_start, target))
        return 0;

    guac_client_log(client, GUAC_LOG_WARNING,
                    "Invalid color value: \"%.*s\".",
                    value_end - value_start, value_start);
    return 1;
}

void guac_terminal_parse_color_scheme(guac_client* client,
        const char* color_scheme, guac_terminal_color* foreground,
        guac_terminal_color* background,
        guac_terminal_color (*palette)[256]) {

    /* Special cases. */
    if (color_scheme[0] == '\0') {
        /* guac_terminal_parse_color_scheme defaults to gray-black */
    }
    else if (strcmp(color_scheme, GUAC_TERMINAL_SCHEME_GRAY_BLACK) == 0) {
        color_scheme = "foreground:color7;background:color0";
    }
    else if (strcmp(color_scheme, GUAC_TERMINAL_SCHEME_BLACK_WHITE) == 0) {
        color_scheme = "foreground:color0;background:color15";
    }
    else if (strcmp(color_scheme, GUAC_TERMINAL_SCHEME_GREEN_BLACK) == 0) {
        color_scheme = "foreground:color2;background:color0";
    }
    else if (strcmp(color_scheme, GUAC_TERMINAL_SCHEME_WHITE_BLACK) == 0) {
        color_scheme = "foreground:color15;background:color0";
    }

    /* Set default gray-black color scheme and initial palette. */
    *foreground = GUAC_TERMINAL_INITIAL_PALETTE[GUAC_TERMINAL_COLOR_GRAY];
    *background = GUAC_TERMINAL_INITIAL_PALETTE[GUAC_TERMINAL_COLOR_BLACK];
    memcpy(palette, GUAC_TERMINAL_INITIAL_PALETTE,
            sizeof(GUAC_TERMINAL_INITIAL_PALETTE));

    /* Current char being parsed, or NULL if at end of parsing. */
    const char* cursor = color_scheme;

    while (cursor) {
        /* Start of the current "name: value" pair. */
        const char* pair_start = cursor;

        /* End of the current name-value pair. */
        const char* pair_end = strchr(pair_start, ';');
        if (pair_end) {
            cursor = pair_end + 1;
        }
        else {
            pair_end = pair_start + strlen(pair_start);
            cursor = NULL;
        }

        guac_terminal_color_scheme_strip_spaces(&pair_start, &pair_end);
        if (pair_start >= pair_end)
            /* Allow empty pairs, which happens, e.g., when the configuration
             * string ends in a semi-colon. */
            continue;

        /* End of the name part of the pair. */
        const char* name_end = memchr(pair_start, ':', pair_end - pair_start);
        if (name_end == NULL) {
            guac_client_log(client, GUAC_LOG_WARNING,
                            "Expecting colon: \"%.*s\".",
                            pair_end - pair_start, pair_start);
            return;
        }

        /* The color that the name corresponds to. */
        guac_terminal_color* color_target = NULL;

        if (guac_terminal_parse_color_scheme_name(
                client, pair_start, name_end, foreground, background,
                palette, &color_target))
            return; /* Parsing failed. */

        if (guac_terminal_parse_color_scheme_value(
                client, name_end + 1, pair_end,
                (const guac_terminal_color(*)[256]) palette, color_target))
            return; /* Parsing failed. */
    }

    /* Persist pseudo-index for foreground/background colors */
    foreground->palette_index = GUAC_TERMINAL_COLOR_FOREGROUND;
    background->palette_index = GUAC_TERMINAL_COLOR_BACKGROUND;

}

