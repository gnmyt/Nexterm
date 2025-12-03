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

#include "terminal/common.h"
#include "terminal/types.h"

#include <guacamole/assert.h>

#include <stdbool.h>
#include <unistd.h>

int guac_terminal_fit_to_range(int value, int min, int max) {

    /* This should never happen outside a logic error in the caller, but best
     * to bail out here where debugging will be less onerous  */
    GUAC_ASSERT(min <= max);

    if (value < min) return min;
    if (value > max) return max;

    return value;

}

int guac_terminal_encode_utf8(int codepoint, char* utf8) {

    int i;
    int mask, bytes;

    /* Determine size and initial byte mask */
    if (codepoint <= 0x007F) {
        mask  = 0x00;
        bytes = 1;
    }
    else if (codepoint <= 0x7FF) {
        mask  = 0xC0;
        bytes = 2;
    }
    else if (codepoint <= 0xFFFF) {
        mask  = 0xE0;
        bytes = 3;
    }
    else if (codepoint <= 0x1FFFFF) {
        mask  = 0xF0;
        bytes = 4;
    }

    /* Otherwise, invalid codepoint */
    else {
        *(utf8++) = '?';
        return 1;
    }

    /* Offset buffer by size */
    utf8 += bytes - 1;

    /* Add trailing bytes, if any */
    for (i=1; i<bytes; i++) {
        *(utf8--) = 0x80 | (codepoint & 0x3F);
        codepoint >>= 6;
    }

    /* Set initial byte */
    *utf8 = mask | codepoint;

    /* Done */
    return bytes;

}

bool guac_terminal_has_glyph(int codepoint) {
    return
           codepoint != 0
        && codepoint != ' '
        && codepoint != GUAC_CHAR_CONTINUATION;
}

int guac_terminal_write_all(int fd, const char* buffer, int size) {

    int remaining = size;
    while (remaining > 0) {

        /* Attempt to write data */
        int ret_val = write(fd, buffer, remaining);
        if (ret_val <= 0)
            return -1;

        /* If successful, continue with what data remains (if any) */
        remaining -= ret_val;
        buffer += ret_val;

    }

    return size;

}

