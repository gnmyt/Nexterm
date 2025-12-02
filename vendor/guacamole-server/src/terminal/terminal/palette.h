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

#ifndef GUAC_TERMINAL_PALETTE_H
#define GUAC_TERMINAL_PALETTE_H

/**
 * Constants, structures, and function definitions related to the terminal color pallate.
 *
 * @file palette.h
 */

#include <stdint.h>

/**
 * The pseudo-index of the color set as the default foreground color for
 * the terminal. Regardless of what changes are made to the palette, this index
 * will always return the current default foreground color.
 */
#define GUAC_TERMINAL_COLOR_FOREGROUND -2

/**
 * The pseudo-index of the color set as the default background color for
 * the terminal. Regardless of what changes are made to the palette, this index
 * will always return the current default background color.
 */
#define GUAC_TERMINAL_COLOR_BACKGROUND -3

/**
 * The index of black within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_BLACK 0

/**
 * The index of low-intensity red within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_DARK_RED 1

/**
 * The index of low-intensity green within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_DARK_GREEN 2

/**
 * The index of brown within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_BROWN 3

/**
 * The index of low-intensity blue within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_DARK_BLUE 4

/**
 * The index of low-intensity magenta (purple) within the terminal color
 * palette.
 */
#define GUAC_TERMINAL_COLOR_PURPLE 5

/**
 * The index of low-intensity cyan (teal) within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_TEAL 6

/**
 * The index of low-intensity white (gray) within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_GRAY 7

/**
 * The index of bright black (dark gray) within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_DARK_GRAY 8

/**
 * The index of bright red within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_RED 9

/**
 * The index of bright green within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_GREEN 10

/**
 * The index of bright brown (yellow) within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_YELLOW 11

/**
 * The index of bright blue within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_BLUE 12

/**
 * The index of bright magenta within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_MAGENTA 13

/**
 * The index of bright cyan within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_CYAN 14

/**
 * The index of bright white within the terminal color palette.
 */
#define GUAC_TERMINAL_COLOR_WHITE 15

/**
 * The index of the first low-intensity color in the 16-color portion of the
 * palette.
 */
#define GUAC_TERMINAL_FIRST_DARK 0

/**
 * The index of the last low-intensity color in the 16-color portion of the
 * palette.
 */
#define GUAC_TERMINAL_LAST_DARK 7

/**
 * The index of the first high-intensity color in the 16-color portion of the
 * palette.
 */
#define GUAC_TERMINAL_FIRST_INTENSE 8

/**
 * The index of the last high-intensity color in the 16-color portion of the
 * palette.
 */
#define GUAC_TERMINAL_LAST_INTENSE 15

/**
 * The distance between the palette indices of the dark colors (0 through 7)
 * and the bright colors (8 - 15) in the 16-color portion of the palette.
 */
#define GUAC_TERMINAL_INTENSE_OFFSET 8

/**
 * An RGB color, where each component ranges from 0 to 255.
 */
typedef struct guac_terminal_color {

    /**
     * The index of this color within the terminal palette, or -1 if the color
     * does not exist within the terminal palette.
     */
    int palette_index;

    /**
     * The red component of this color.
     */
    uint8_t red;

    /**
     * The green component of this color.
     */
    uint8_t green;

    /**
     * The blue component of this color.
     */
    uint8_t blue;

} guac_terminal_color;

/**
 * Compares two colors, returning a negative value if the first color is less
 * than the second, a positive value if the first color is greater than the
 * second, and zero if the colors are identical. Only the color components are
 * compared (not the palette index). The red component is considered the
 * highest order component, followed by green, followed by blue.
 *
 * @param a
 *     The first color to compare.
 *
 * @param b
 *     The second color to compare.
 *
 * @return
 *    A negative value if the first color is less than the second, a positive
 *    value if the first color is greater than the second, and zero if the
 *    colors are identical.
 */
int guac_terminal_colorcmp(const guac_terminal_color* a,
        const guac_terminal_color* b);

/**
 * The initial state of the terminal color palette. The color palette used by
 * the terminal may modified after the terminal is created through console
 * codes.
 */
extern const guac_terminal_color GUAC_TERMINAL_INITIAL_PALETTE[256];

#endif

