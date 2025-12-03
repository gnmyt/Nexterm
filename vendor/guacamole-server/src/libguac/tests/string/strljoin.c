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
 * Array of test elements containing the strings "Apache" and "Guacamole".
 */
const char* const apache_guacamole[] = { "Apache", "Guacamole" };

/**
 * Array of test elements containing the strings "This", "is", "a", and "test".
 */
const char* const this_is_a_test[] = { "This", "is", "a", "test" };

/**
 * Array of four test elements containing the strings "A" and "B", each
 * preceded by an empty string ("").
 */
const char* const empty_a_empty_b[] = { "", "A", "", "B" };

/**
 * Array of test elements containing ten empty strings.
 */
const char* const empty_x10[] = { "", "", "", "", "", "", "", "", "", "" };

/**
 * Verify guac_strljoin() behavior when the string fits the buffer without
 * truncation. The return value of each call should be the length of the
 * resulting string. Each resulting string should contain the full result of
 * the join operation, including null terminator.
 */
void test_string__strljoin() {

    char buffer[1024];

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, apache_guacamole, 2, " ", sizeof(buffer)), 16);
    CU_ASSERT_STRING_EQUAL(buffer, "Apache Guacamole");
    CU_ASSERT_EQUAL(buffer[17], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, this_is_a_test, 4, "", sizeof(buffer)), 11);
    CU_ASSERT_STRING_EQUAL(buffer, "Thisisatest");
    CU_ASSERT_EQUAL(buffer[12], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, this_is_a_test, 4, "-/-", sizeof(buffer)), 20);
    CU_ASSERT_STRING_EQUAL(buffer, "This-/-is-/-a-/-test");
    CU_ASSERT_EQUAL(buffer[21], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, empty_a_empty_b, 4, "/", sizeof(buffer)), 5);
    CU_ASSERT_STRING_EQUAL(buffer, "/A//B");
    CU_ASSERT_EQUAL(buffer[6], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, empty_x10, 10, "/", sizeof(buffer)), 9);
    CU_ASSERT_STRING_EQUAL(buffer, "/////////");
    CU_ASSERT_EQUAL(buffer[10], '\xFF');

}

/**
 * Verify guac_strljoin() behavior when the string must be truncated to fit the
 * buffer. The return value of each call should be the length that would result
 * from joining the strings given an infinite buffer, however only as many
 * characters as can fit should be appended to the string within the buffer,
 * and the buffer should be null-terminated.
 */
void test_string__strljoin_truncate() {

    char buffer[1024];

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, apache_guacamole, 2, " ", 9), 16);
    CU_ASSERT_STRING_EQUAL(buffer, "Apache G");
    CU_ASSERT_EQUAL(buffer[9], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, this_is_a_test, 4, "", 8), 11);
    CU_ASSERT_STRING_EQUAL(buffer, "Thisisa");
    CU_ASSERT_EQUAL(buffer[8], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, this_is_a_test, 4, "-/-", 12), 20);
    CU_ASSERT_STRING_EQUAL(buffer, "This-/-is-/");
    CU_ASSERT_EQUAL(buffer[12], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, empty_a_empty_b, 4, "/", 2), 5);
    CU_ASSERT_STRING_EQUAL(buffer, "/");
    CU_ASSERT_EQUAL(buffer[2], '\xFF');

    memset(buffer, 0xFF, sizeof(buffer));
    CU_ASSERT_EQUAL(guac_strljoin(buffer, empty_x10, 10, "/", 7), 9);
    CU_ASSERT_STRING_EQUAL(buffer, "//////");
    CU_ASSERT_EQUAL(buffer[7], '\xFF');

}

/**
 * Verify guac_strljoin() behavior with zero buffer sizes. The return value of
 * each call should be the size of the input string, while the buffer remains
 * untouched.
 */
void test_string__strljoin_nospace() {

    /* 0-byte buffer plus 1 guard byte (to test overrun) */
    char buffer[1] = { '\xFF' };

    CU_ASSERT_EQUAL(guac_strljoin(buffer, apache_guacamole, 2, " ", 0), 16);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strljoin(buffer, this_is_a_test, 4, "", 0), 11);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strljoin(buffer, this_is_a_test, 4, "-/-", 0), 20);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strljoin(buffer, empty_a_empty_b, 4, "/", 0), 5);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

    CU_ASSERT_EQUAL(guac_strljoin(buffer, empty_x10, 10, "/", 0), 9);
    CU_ASSERT_EQUAL(buffer[0], '\xFF');

}

