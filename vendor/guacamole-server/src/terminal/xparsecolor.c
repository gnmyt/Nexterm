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

#include "terminal/named-colors.h"
#include "terminal/palette.h"

#include <stdio.h>

int guac_terminal_xparsecolor(const char* spec,
        guac_terminal_color* color) {

    int red;
    int green;
    int blue;

    /* 12-bit RGB ("rgb:h/h/h"), zero-padded to 24-bit */
    if (sscanf(spec, "rgb:%1x/%1x/%1x", &red, &green, &blue) == 3) {
        color->palette_index = -1; /* Not from palette. */
        color->red   = red   << 4;
        color->green = green << 4;
        color->blue  = blue  << 4;
        return 0;
    }

    /* 24-bit RGB ("rgb:hh/hh/hh") */
    if (sscanf(spec, "rgb:%2x/%2x/%2x", &red, &green, &blue) == 3) {
        color->palette_index = -1; /* Not from palette. */
        color->red   = red;
        color->green = green;
        color->blue  = blue;
        return 0;
    }

    /* 36-bit RGB ("rgb:hhh/hhh/hhh"), truncated to 24-bit */
    if (sscanf(spec, "rgb:%3x/%3x/%3x", &red, &green, &blue) == 3) {
        color->palette_index = -1; /* Not from palette. */
        color->red   = red   >> 4;
        color->green = green >> 4;
        color->blue  = blue  >> 4;
        return 0;
    }

    /* 48-bit RGB ("rgb:hhhh/hhhh/hhhh"), truncated to 24-bit */
    if (sscanf(spec, "rgb:%4x/%4x/%4x", &red, &green, &blue) == 3) {
        color->palette_index = -1; /* Not from palette. */
        color->red   = red   >> 8;
        color->green = green >> 8;
        color->blue  = blue  >> 8;
        return 0;
    }

    /* If not RGB, search for color by name */
    return guac_terminal_find_color(spec, color);

}

