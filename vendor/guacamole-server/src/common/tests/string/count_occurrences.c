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

#include "common/string.h"

#include <CUnit/CUnit.h>

/**
 * Test which verifies that guac_count_occurrences() counts the number of
 * occurrences of an arbitrary character within a given string.
 */
void test_string__guac_count_occurrences() {
    CU_ASSERT_EQUAL(4, guac_count_occurrences("this is a test string", 's'));
    CU_ASSERT_EQUAL(3, guac_count_occurrences("this is a test string", 'i'));
    CU_ASSERT_EQUAL(0, guac_count_occurrences("", 's'));
}

