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
 * Test which verifies that guac_mem_ckd_mul() calculates zero values for all
 * inputs involving at least one zero value.
 */
void test_mem__ckd_mul_zero() {

    size_t result = SIZE_MAX;

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 0, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 0, 0, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 0, 0, 0, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 0, 0, 0, 0, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 0, 1));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 1, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 3, 2, 0));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 5, 0, 8, 9));
    CU_ASSERT_EQUAL(result, 0);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 99, 99, 99, 0, 99));
    CU_ASSERT_EQUAL(result, 0);

}

/**
 * Test which verifies that guac_mem_ckd_mul() successfully calculates expected
 * values for relatively small integer inputs.
 */
void test_mem__ckd_mul_small() {

    size_t result = SIZE_MAX;

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 123));
    CU_ASSERT_EQUAL(result, 123);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 123, 456));
    CU_ASSERT_EQUAL(result, 123 * 456);

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, 123, 456, 789));
    CU_ASSERT_EQUAL(result, 123 * 456 * 789);

}

/**
 * Test which verifies that guac_mem_ckd_mul() behaves as expected for
 * relatively large integer inputs, including inputs that cause overflow beyond
 * the capacity of a size_t.
 */
void test_mem__ckd_mul_large() {

    size_t result = 0;

    CU_ASSERT_FALSE_FATAL(guac_mem_ckd_mul(&result, SIZE_MAX));
    CU_ASSERT_EQUAL(result, SIZE_MAX);

    CU_ASSERT_TRUE_FATAL(guac_mem_ckd_mul(&result, 123, 456, SIZE_MAX));
    CU_ASSERT_TRUE_FATAL(guac_mem_ckd_mul(&result, SIZE_MAX / 2, SIZE_MAX / 2));

}

