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

#include "common/iconv.h"
#include "convert-test-data.h"

encoding_test_parameters test_params[NUM_SUPPORTED_ENCODINGS] = {

    /*
     * UTF-8
     */

    {
        "UTF-8",
        GUAC_READ_UTF8,  GUAC_READ_UTF8_NORMALIZED,
        GUAC_WRITE_UTF8, GUAC_WRITE_UTF8_CRLF,
        .test_mixed = TEST_STRING(
            "pap\xC3\xA0 \xC3\xA8 bello\n"
            "pap\xC3\xA0 \xC3\xA8 bello\r\n"
            "pap\xC3\xA0 \xC3\xA8 bello\n"
            "pap\xC3\xA0 \xC3\xA8 bello\r\n"
            "pap\xC3\xA0 \xC3\xA8 bello"
        ),
        .test_unix = TEST_STRING(
            "pap\xC3\xA0 \xC3\xA8 bello\n"
            "pap\xC3\xA0 \xC3\xA8 bello\n"
            "pap\xC3\xA0 \xC3\xA8 bello\n"
            "pap\xC3\xA0 \xC3\xA8 bello\n"
            "pap\xC3\xA0 \xC3\xA8 bello"
        ),
        .test_windows = TEST_STRING(
            "pap\xC3\xA0 \xC3\xA8 bello\r\n"
            "pap\xC3\xA0 \xC3\xA8 bello\r\n"
            "pap\xC3\xA0 \xC3\xA8 bello\r\n"
            "pap\xC3\xA0 \xC3\xA8 bello\r\n"
            "pap\xC3\xA0 \xC3\xA8 bello"
        )
    },

    /*
     * UTF-16
     */

    {
        "UTF-16",
        GUAC_READ_UTF16,  GUAC_READ_UTF16_NORMALIZED,
        GUAC_WRITE_UTF16, GUAC_WRITE_UTF16_CRLF,
        .test_mixed = TEST_STRING(
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\r\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\r\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00"
            "\x00"
        ),
        .test_unix = TEST_STRING(
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00"
            "\x00"
        ),
        .test_windows = TEST_STRING(
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\r\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\r\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\r\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00" "\r\x00" "\n\x00"
            "p\x00" "a\x00" "p\x00" "\xE0\x00" " \x00" "\xE8\x00" " \x00" "b\x00" "e\x00" "l\x00" "l\x00" "o\x00"
            "\x00"
        )
    },

    /*
     * ISO 8859-1
     */

    {
        "ISO 8859-1",
        GUAC_READ_ISO8859_1,  GUAC_READ_ISO8859_1_NORMALIZED,
        GUAC_WRITE_ISO8859_1, GUAC_WRITE_ISO8859_1_CRLF,
        .test_mixed = TEST_STRING(
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello"
        ),
        .test_unix = TEST_STRING(
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello"
        ),
        .test_windows = TEST_STRING(
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello"
        )
    },

    /*
     * CP-1252
     */

    {
        "CP-1252",
        GUAC_READ_CP1252,  GUAC_READ_CP1252_NORMALIZED,
        GUAC_WRITE_CP1252, GUAC_WRITE_CP1252_CRLF,
        .test_mixed = TEST_STRING(
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello"
        ),
        .test_unix = TEST_STRING(
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello\n"
            "pap\xE0 \xE8 bello"
        ),
        .test_windows = TEST_STRING(
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello\r\n"
            "pap\xE0 \xE8 bello"
        )
    }

};

