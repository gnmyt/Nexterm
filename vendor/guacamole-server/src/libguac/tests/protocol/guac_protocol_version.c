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
#include <guacamole/protocol-types.h>

/**
 * Test which verifies that conversion of the guac_protocol_version enum to
 * string values succeeds and produces the expected results.
 */
void test_guac_protocol__version_to_string() {
    
    guac_protocol_version version_a = GUAC_PROTOCOL_VERSION_1_5_0;
    guac_protocol_version version_b = GUAC_PROTOCOL_VERSION_1_0_0;
    guac_protocol_version version_c = GUAC_PROTOCOL_VERSION_UNKNOWN;
    
    CU_ASSERT_STRING_EQUAL(guac_protocol_version_to_string(version_a), "VERSION_1_5_0");
    CU_ASSERT_STRING_EQUAL(guac_protocol_version_to_string(version_b), "VERSION_1_0_0");
    CU_ASSERT_PTR_NULL(guac_protocol_version_to_string(version_c));
    
}

/**
 * Test which verifies that the version of String representations of Guacamole
 * protocol versions are successfully converted into their matching
 * guac_protocol_version enum values, and that versions that do not match
 * any version get the correct unknown value.
 */
void test_guac_protocol__string_to_version() {
    
    char* str_version_a = "VERSION_1_3_0";
    char* str_version_b = "VERSION_1_1_0";
    char* str_version_c = "AVACADO";
    char* str_version_d = "VERSION_31_4_1";
    
    CU_ASSERT_EQUAL(guac_protocol_string_to_version(str_version_a), GUAC_PROTOCOL_VERSION_1_3_0);
    CU_ASSERT_EQUAL(guac_protocol_string_to_version(str_version_b), GUAC_PROTOCOL_VERSION_1_1_0);
    CU_ASSERT_EQUAL(guac_protocol_string_to_version(str_version_c), GUAC_PROTOCOL_VERSION_UNKNOWN);
    CU_ASSERT_EQUAL(guac_protocol_string_to_version(str_version_d), GUAC_PROTOCOL_VERSION_UNKNOWN);
    
}

/**
 * Test which verifies that the comparisons between guac_protocol_version enum
 * values produces the expected results.
 */
void test_gauc_protocol__version_comparison() {
    
    CU_ASSERT_TRUE(GUAC_PROTOCOL_VERSION_1_3_0 > GUAC_PROTOCOL_VERSION_1_0_0);
    CU_ASSERT_TRUE(GUAC_PROTOCOL_VERSION_UNKNOWN < GUAC_PROTOCOL_VERSION_1_1_0);
    
}