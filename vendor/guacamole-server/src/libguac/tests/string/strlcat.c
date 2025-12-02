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
 * Verify guac_strlcat() behavior when the string fits the buffer without
 * truncation. The return value of each call should be the length of the
 * resulting string. Each resulting string should contain the full result of
 * the concatenation, including null terminator.
 */
void test_string__strlcat() {

    char buffer[1024];

    memset(buffer, 0xFF, sizeof(buffer));
    strcpy(buffer, "Apache ");
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "Guacamole", sizeof(buffer)), 16);
    CU_ASSERT_STRING_EQUAL(buffer, "Apache Guacamole");
    CU_ASSERT_EQUAL(buffer[17], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    strcpy(buffer, "");
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "This is a test", sizeof(buffer)), 14);
    CU_ASSERT_STRING_EQUAL(buffer, "This is a test");
    CU_ASSERT_EQUAL(buffer[15], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    strcpy(buffer, "AB");
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "X", sizeof(buffer)), 3);
    CU_ASSERT_STRING_EQUAL(buffer, "ABX");
    CU_ASSERT_EQUAL(buffer[4], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    strcpy(buffer, "X");
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "", sizeof(buffer)), 1);
    CU_ASSERT_STRING_EQUAL(buffer, "X");
    CU_ASSERT_EQUAL(buffer[2], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    strcpy(buffer, "");
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "", sizeof(buffer)), 0);
    CU_ASSERT_STRING_EQUAL(buffer, "");
    CU_ASSERT_EQUAL(buffer[1], '\xFF');

}

/**
 * Verify guac_strlcat() behavior when the string must be truncated to fit the
 * buffer. The return value of each call should be the length that would result
 * from concatenating the strings given an infinite buffer, however only as
 * many characters as can fit should be appended to the string within the
 * buffer, and the buffer should be null-terminated.
 */
void test_string__strlcat_truncate() {

    char buffer[1024];

    memset(buffer, 0xFF, sizeof(buffer));
    strcpy(buffer, "Apache ");
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "Guacamole", 9), 16);
    CU_ASSERT_STRING_EQUAL(buffer, "Apache G");
    CU_ASSERT_EQUAL(buffer[9], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    strcpy(buffer, "");
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "This is a test", 10), 14);
    CU_ASSERT_STRING_EQUAL(buffer, "This is a");
    CU_ASSERT_EQUAL(buffer[10], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    strcpy(buffer, "This ");
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "is ANOTHER test", 6), 20);
    CU_ASSERT_STRING_EQUAL(buffer, "This ");
    CU_ASSERT_EQUAL(buffer[6], '\xFF');

}

/**
 * Verify guac_strlcat() behavior with zero buffer sizes. The return value of
 * each call should be the size of the input string, while the buffer remains
 * untouched.
 */
void test_string__strlcat_nospace() {

    /* 0-byte buffer plus 1 guard byte (to test overrun) */
    char buffer[1] = { '\xFF' };

    CU_ASSERT_EQUAL(guac_strlcat(buffer, "Guacamole", 0), 9);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strlcat(buffer, "This is a test", 0), 14);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strlcat(buffer, "X", 0), 1);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strlcat(buffer, "", 0), 0);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

}

/**
 * Verify guac_strlcat() behavior with unterminated buffers. With respect to
 * the return value, the length of the string in the buffer should be
 * considered equal to the size of the buffer, however the resulting buffer
 * should not be null-terminated.
 */
void test_string__strlcat_nonull() {

    char expected[1024];
    memset(expected, 0xFF, sizeof(expected));

    char buffer[1024];

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "Guacamole", 256), 265);
    CU_ASSERT_NSTRING_EQUAL(buffer, expected, sizeof(expected));

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "This is a test", 37), 51);
    CU_ASSERT_NSTRING_EQUAL(buffer, expected, sizeof(expected));

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "X", 12), 13);
    CU_ASSERT_NSTRING_EQUAL(buffer, expected, sizeof(expected));

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strlcat(buffer, "", 100), 100);
    CU_ASSERT_NSTRING_EQUAL(buffer, expected, sizeof(expected));

}

