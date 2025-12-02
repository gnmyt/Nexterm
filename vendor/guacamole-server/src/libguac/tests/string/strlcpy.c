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
#include <guacamole/string.h>

#include <stdlib.h>
#include <string.h>

/**
 * Verify guac_strlcpy() behavior when the string fits the buffer without
 * truncation.
 */
void test_string__strlcpy() {

    char buffer[1024];

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "Guacamole", sizeof(buffer)), 9);
    CU_ASSERT_STRING_EQUAL(buffer, "Guacamole");
    CU_ASSERT_EQUAL(buffer[10], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "This is a test", sizeof(buffer)), 14);
    CU_ASSERT_STRING_EQUAL(buffer, "This is a test");
    CU_ASSERT_EQUAL(buffer[15], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "X", sizeof(buffer)), 1);
    CU_ASSERT_STRING_EQUAL(buffer, "X");
    CU_ASSERT_EQUAL(buffer[2], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "", sizeof(buffer)), 0);
    CU_ASSERT_STRING_EQUAL(buffer, "");
    CU_ASSERT_EQUAL(buffer[1], '\xFF');

}

/**
 * Verify guac_strlcpy() behavior when the string must be truncated to fit the
 * buffer.
 */
void test_string__strlcpy_truncate() {

    char buffer[1024];

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "Guacamole", 6), 9);
    CU_ASSERT_STRING_EQUAL(buffer, "Guaca");
    CU_ASSERT_EQUAL(buffer[6], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "This is a test", 10), 14);
    CU_ASSERT_STRING_EQUAL(buffer, "This is a");
    CU_ASSERT_EQUAL(buffer[10], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "This is ANOTHER test", 2), 20);
    CU_ASSERT_STRING_EQUAL(buffer, "T");
    CU_ASSERT_EQUAL(buffer[2], '\xFF');

}

/**
 * Verify guac_strlcpy() behavior with zero buffer sizes.
 */
void test_string__strlcpy_nospace() {

    /* 0-byte buffer plus 1 guard byte (to test overrun) */
    char buffer[1] = { '\xFF' };

    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "Guacamole", 0), 9);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "This is a test", 0), 14);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "X", 0), 1);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strlcpy(buffer, "", 0), 0);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

}

