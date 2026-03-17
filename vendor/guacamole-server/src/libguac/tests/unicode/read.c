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

#include <CUnit/CUnit.h>
#include <guacamole/unicode.h>

/**
 * Test which verifies that guac_utf8_read() properly parses UTF-8.
 */
void test_unicode__utf8_read() {

    int codepoint;

    char buffer[16] =
        /* U+0065  */ "\x65"
        /* U+0654  */ "\xD9\x94"
        /* U+0876  */ "\xE0\xA1\xB6"
        /* U+12345 */ "\xF0\x92\x8D\x85";

    CU_ASSERT_EQUAL(1, guac_utf8_read(&(buffer[0]), 10, &codepoint));
    CU_ASSERT_EQUAL(0x0065, codepoint);

    CU_ASSERT_EQUAL(2, guac_utf8_read(&(buffer[1]),  9, &codepoint));
    CU_ASSERT_EQUAL(0x0654, codepoint);

    CU_ASSERT_EQUAL(3, guac_utf8_read(&(buffer[3]),  7, &codepoint));
    CU_ASSERT_EQUAL(0x0876, codepoint);

    CU_ASSERT_EQUAL(4, guac_utf8_read(&(buffer[6]),  4, &codepoint));
    CU_ASSERT_EQUAL(0x12345, codepoint);

    CU_ASSERT_EQUAL(0, guac_utf8_read(&(buffer[10]), 0, &codepoint));
    CU_ASSERT_EQUAL(0x12345, codepoint);

}

