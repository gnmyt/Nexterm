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
#include <guacamole/protocol.h>

/**
 * Tests that libguac's in-place base64 decoding function properly decodes
 * valid base64 and fails for invalid base64.
 */
void test_protocol__decode_base64() {

    /* Test strings */
    char test_HELLO[]     = "SEVMTE8=";
    char test_AVOCADO[]   = "QVZPQ0FETw==";
    char test_GUACAMOLE[] = "R1VBQ0FNT0xF";

    /* Invalid strings */
    char invalid1[] = "====";
    char invalid2[] = "";

    /* Test one character of padding */
    CU_ASSERT_EQUAL(guac_protocol_decode_base64(test_HELLO), 5);
    CU_ASSERT_NSTRING_EQUAL(test_HELLO, "HELLO", 5);

    /* Test two characters of padding */
    CU_ASSERT_EQUAL(guac_protocol_decode_base64(test_AVOCADO), 7);
    CU_ASSERT_NSTRING_EQUAL(test_AVOCADO, "AVOCADO", 7);

    /* Test three characters of padding */
    CU_ASSERT_EQUAL(guac_protocol_decode_base64(test_GUACAMOLE), 9);
    CU_ASSERT_NSTRING_EQUAL(test_GUACAMOLE, "GUACAMOLE", 9);

    /* Verify invalid strings stop early as expected */
    CU_ASSERT_EQUAL(guac_protocol_decode_base64(invalid1), 0);
    CU_ASSERT_EQUAL(guac_protocol_decode_base64(invalid2), 0);

}

