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
#include <stdio.h>
#include <stdlib.h>

/**
 * Verifies that guac_kubernetes_append_endpoint_param() correctly appends
 * parameters to URLs that do not already have a query string.
 */
void test_url__append_no_query() {

    char url[256] = "http://example.net";

    CU_ASSERT(!guac_kubernetes_append_endpoint_param(url, sizeof(url), "foo", "100% test value"));
    CU_ASSERT_STRING_EQUAL(url, "http://example.net?foo=100%25%20test%20value");

}

/**
 * Verifies that guac_kubernetes_append_endpoint_param() correctly appends
 * parameters to URLs that already have a query string.
 */
void test_url__append_existing_query() {

    char url[256] = "http://example.net?foo=test%20value";

    CU_ASSERT(!guac_kubernetes_append_endpoint_param(url, sizeof(url), "foo2", "yet&another/test\\value"));
    CU_ASSERT_STRING_EQUAL(url, "http://example.net?foo=test%20value&foo2=yet%26another%2Ftest%5Cvalue");

}

/**
 * Verifies that guac_kubernetes_append_endpoint_param() refuses to overflow
 * the bounds of the provided buffer.
 */
void test_url__append_bounds() {

    char url[256];

    /* Appending "?a=1" to the 18-character string "http://example.net" should
     * fail for all buffer sizes with 22 bytes or less, with a 22-byte buffer
     * lacking space for the null terminator */
    for (int length = 18; length <= 22; length++) {
        strcpy(url, "http://example.net");
        printf("Testing buffer with length %i ...\n", length);
        CU_ASSERT(guac_kubernetes_append_endpoint_param(url, length, "a", "1"));
    }

    /* A 23-byte buffer should be sufficient */
    strcpy(url, "http://example.net");
    CU_ASSERT(!guac_kubernetes_append_endpoint_param(url, 23, "a", "1"));

}

