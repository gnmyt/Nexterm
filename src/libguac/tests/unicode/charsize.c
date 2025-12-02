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
 * Test which verifies that guac_utf8_charsize() correctly determines the
 * length of UTF-8 characters from the leading byte of that character.
 */
void test_unicode__utf8_charsize() {
    CU_ASSERT_EQUAL(1, guac_utf8_charsize('g'));
    CU_ASSERT_EQUAL(2, guac_utf8_charsize('\xC4'));
    CU_ASSERT_EQUAL(3, guac_utf8_charsize('\xE7'));
    CU_ASSERT_EQUAL(4, guac_utf8_charsize('\xF0'));
}

