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
 * Verify guac_strnstr() behaviors:
 */
void test_string__strnstr() {
    char haystack[8] = {'a', 'h', 'i', ' ', 't', 'u', 'n', 'a'};
    char* result;

    /* needle exists at start of haystack */
    result = guac_strnstr(haystack, "ah", sizeof(haystack));
    CU_ASSERT_EQUAL(result, haystack);

    /* needle exists in the middle of haystack */
    result = guac_strnstr(haystack, "hi", sizeof(haystack));
    CU_ASSERT_EQUAL(result, haystack + 1);

    /* needle exists at end of haystack */
    result = guac_strnstr(haystack, "tuna", sizeof(haystack));
    CU_ASSERT_EQUAL(result, haystack + 4);

    /* needle doesn't exist in haystack, needle[0] isn't in haystack */
    result = guac_strnstr(haystack, "mahi", sizeof(haystack));
    CU_ASSERT_EQUAL(result, NULL);

    /*
     * needle doesn't exist in haystack, needle[0] is in haystack,
     *   length wouldn't allow needle to exist
     */
    result = guac_strnstr(haystack, "narwhal", sizeof(haystack));
    CU_ASSERT_EQUAL(result, NULL);

    /*
     * needle doesn't exist in haystack, needle[0] is in haystack,
     *   length would allow needle to exist
     */
    result = guac_strnstr(haystack, "taco", sizeof(haystack));
    CU_ASSERT_EQUAL(result, NULL);

    /*
     * needle doesn't exist in haystack, needle[0] is in haystack
     *   multiple times
     */
    result = guac_strnstr(haystack, "ahha", sizeof(haystack));
    CU_ASSERT_EQUAL(result, NULL);

    /* empty needle should return haystack according to API docs */
    result = guac_strnstr(haystack, "", sizeof(haystack));
    CU_ASSERT_EQUAL(result, haystack);
}
