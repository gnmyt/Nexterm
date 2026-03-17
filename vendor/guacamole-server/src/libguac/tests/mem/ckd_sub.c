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
#include <guacamole/mem.h>
#include <stdint.h>

/**
 * Test which verifies that guac_mem_ckd_sub() calculates results correctly for
 * all inputs involving at least one zero value.
 */
void test_mem__ckd_sub_zero() {

    size_t result = SIZE_MAX;

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 0, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 0, 0, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 0, 0, 0, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 0, 0, 0, 0, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 1, 0));
    CU_ASSERT_EQUAL(result, 1);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 3, 2, 0));
    CU_ASSERT_EQUAL(result, 3 - 2);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 8, 5, 0, 1));
    CU_ASSERT_EQUAL(result, 8 - 5 - 1);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 99, 99, 0));
    CU_ASSERT_EQUAL(result, 0);

}

/**
 * Test which verifies that guac_mem_ckd_sub() successfully calculates expected
 * values for relatively small integer inputs, including inputs that cause
 * overflow beyond zero.
 */
void test_mem__ckd_sub_small() {

    size_t result = SIZE_MAX;

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 123));
    CU_ASSERT_EQUAL(result, 123);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 456, 123));
    CU_ASSERT_EQUAL(result, 456 - 123);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 789, 456, 123));
    CU_ASSERT_EQUAL(result, 789 - 456 - 123);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, 123, 123));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_TRUE_FATAL(guac_mem_ckd_sub(&result, 123, 123, 1));

}

/**
 * Test which verifies that guac_mem_ckd_sub() behaves as expected for
 * relatively large integer inputs, including inputs that cause overflow beyond
 * zero.
 */
void test_mem__ckd_sub_large() {

    size_t result = 0;

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, SIZE_MAX));
    CU_ASSERT_EQUAL(result, SIZE_MAX);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_sub(&result, SIZE_MAX, SIZE_MAX / 2));
    CU_ASSERT_EQUAL(result, SIZE_MAX - (SIZE_MAX / 2));

    CU_ASSERT_TRUE_FATAL(guac_mem_ckd_sub(&result, SIZE_MAX, SIZE_MAX, 1));
    CU_ASSERT_TRUE_FATAL(guac_mem_ckd_sub(&result, 0, SIZE_MAX));

}

