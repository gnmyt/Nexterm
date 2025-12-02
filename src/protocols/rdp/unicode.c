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

#include <guacamole/unicode.h>

#include <stdint.h>

void guac_rdp_utf16_to_utf8(const unsigned char* utf16, int length,
        char* utf8, int size) {

    int i;
    const uint16_t* in_codepoint = (const uint16_t*) utf16;

    /* For each UTF-16 character */
    for (i=0; i<length; i++) {

        /* Get next codepoint */
        uint16_t codepoint = *(in_codepoint++);

        /* Save codepoint as UTF-8 */
        int bytes_written = guac_utf8_write(codepoint, utf8, size);
        size -= bytes_written;
        utf8 += bytes_written;

    }

    /* Save NULL terminator */
    *(utf8++) = 0;

}

void guac_rdp_utf8_to_utf16(const unsigned char* utf8, int length,
        char* utf16, int size) {

    int i;
    uint16_t* out_codepoint = (uint16_t*) utf16;

    /* For each UTF-8 character */
    for (i=0; i<length; i++) {

        /* Get next codepoint */
        int codepoint;
        utf8 += guac_utf8_read((const char*) utf8, 4, &codepoint);

        /* Save codepoint as UTF-16 */
        *(out_codepoint++) = codepoint;

        /* Stop if buffer full */
        size -= 2;
        if (size < 2)
            break;

    }

}

