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

#include "url.h"

#include <CUnit/CUnit.h>
#include <stdlib.h>

/**
 * Verifies that guac_kubernetes_escape_url_component() correctly escapes
 * characters that would otherwise have special meaning within URLs.
 */
void test_url__escape_special() {

    char value[256];

    CU_ASSERT(!guac_kubernetes_escape_url_component(value, sizeof(value), "?foo%20bar\\1/2&3=4"));
    CU_ASSERT_STRING_EQUAL(value, "%3Ffoo%2520bar%5C1%2F2%263%3D4");

}

/**
 * Verifies that guac_kubernetes_escape_url_component() leaves strings
 * untouched if they contain no characters requiring escaping.
 */
void test_url__escape_nospecial() {

    char value[256];

    CU_ASSERT(!guac_kubernetes_escape_url_component(value, sizeof(value), "potato"));
    CU_ASSERT_STRING_EQUAL(value, "potato");

}

/**
 * Verifies that guac_kubernetes_escape_url_component() refuses to overflow the
 * bounds of the provided buffer.
 */
void test_url__escape_bounds() {

    char value[256];

    /* Escaping "?potato" (or "potato?") should fail for all buffer sizes with
     * 9 bytes or less, with a 9-byte buffer lacking space for the null
     * terminator */
    for (int length = 0; length <= 9; length++) {
        printf("Testing buffer with length %i ...\n", length);
        CU_ASSERT(guac_kubernetes_escape_url_component(value, length, "?potato"));
        CU_ASSERT(guac_kubernetes_escape_url_component(value, length, "potato?"));
    }

    /* A 10-byte buffer should be sufficient */
    CU_ASSERT(!guac_kubernetes_escape_url_component(value, 10, "?potato"));

}

