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
 * A single Unicode character encoded as one byte with UTF-8.
 */
#define UTF8_1b "g"

/**
 * A single Unicode character encoded as two bytes with UTF-8.
 */
#define UTF8_2b "\xc4\xa3"

/**
 * A single Unicode character encoded as three bytes with UTF-8.
 */
#define UTF8_3b "\xe7\x8a\xac"

/**
 * A single Unicode character encoded as four bytes with UTF-8.
 */
#define UTF8_4b "\xf0\x90\x84\xa3"

/**
 * Test which verifies that guac_utf8_strlen() properly calculates the length
 * of UTF-8 strings.
 */
void test_unicode__utf8_strlen() {
    CU_ASSERT_EQUAL(0, guac_utf8_strlen(""));
    CU_ASSERT_EQUAL(1, guac_utf8_strlen(UTF8_4b));
    CU_ASSERT_EQUAL(2, guac_utf8_strlen(UTF8_4b UTF8_1b));
    CU_ASSERT_EQUAL(2, guac_utf8_strlen(UTF8_2b UTF8_3b));
    CU_ASSERT_EQUAL(3, guac_utf8_strlen(UTF8_1b UTF8_3b UTF8_4b));
    CU_ASSERT_EQUAL(3, guac_utf8_strlen(UTF8_2b UTF8_1b UTF8_3b));
    CU_ASSERT_EQUAL(3, guac_utf8_strlen(UTF8_4b UTF8_2b UTF8_1b));
    CU_ASSERT_EQUAL(3, guac_utf8_strlen(UTF8_3b UTF8_4b UTF8_2b));
    CU_ASSERT_EQUAL(5, guac_utf8_strlen("hello"));
    CU_ASSERT_EQUAL(9, guac_utf8_strlen("guacamole"));
}

