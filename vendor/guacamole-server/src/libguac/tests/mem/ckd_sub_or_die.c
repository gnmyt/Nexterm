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

#include "assert-signal.h"

#include <CUnit/CUnit.h>
#include <guacamole/mem.h>
#include <stdint.h>

/**
 * Test which verifies that guac_mem_ckd_sub_or_die() calculates results
 * correctly for all inputs involving at least one zero value.
 */
void test_mem__ckd_sub_or_die_zero() {

    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(0), 0);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(0, 0), 0);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(0, 0, 0), 0);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(0, 0, 0, 0), 0);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(0, 0, 0, 0, 0), 0);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(1, 0), 1);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(3, 2, 0), 3 - 2);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(8, 5, 0, 1), 8 - 5 - 1);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(99, 99, 0), 0);

}

/**
 * Test which verifies that guac_mem_ckd_sub_or_die() successfully calculates
 * expected values for relatively small integer inputs, including inputs that
 * cause overflow beyond zero.
 */
void test_mem__ckd_sub_or_die_small() {

    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(123), 123);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(456, 123), 456 - 123);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(789, 456, 123), 789 - 456 - 123);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(123, 123), 0);

    ASSERT_SIGNALLED(SIGABRT, guac_mem_ckd_sub_or_die(123, 123, 1));

}

/**
 * Test which verifies that guac_mem_ckd_sub_or_die() behaves as expected for
 * relatively large integer inputs, including inputs that cause overflow beyond
 * zero.
 */
void test_mem__ckd_sub_or_die_large() {

    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(SIZE_MAX), SIZE_MAX);
    CU_ASSERT_EQUAL(guac_mem_ckd_sub_or_die(SIZE_MAX, SIZE_MAX / 2), SIZE_MAX - (SIZE_MAX / 2));

    ASSERT_SIGNALLED(SIGABRT, guac_mem_ckd_sub_or_die(SIZE_MAX, SIZE_MAX, 1));
    ASSERT_SIGNALLED(SIGABRT, guac_mem_ckd_sub_or_die(0, SIZE_MAX));

}

