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
 * Test which verifies that guac_mem_zalloc() returns NULL for all inputs involving
 * at least one zero value.
 */
void test_mem__zalloc_fail_zero() {

    CU_ASSERT_PTR_NULL(guac_mem_zalloc(0));
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(0, 0));
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(0, 0, 0));
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(0, 0, 0, 0));
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(0, 0, 0, 0, 0));

    CU_ASSERT_PTR_NULL(guac_mem_zalloc(1, 0));
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(3, 2, 0));
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(5, 0, 8, 9));
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(99, 99, 99, 0, 99));

}

/**
 * Returns whether all bytes within the given memory region are zero.
 *
 * @param ptr
 *     The first byte of the memory region to test.
 *
 * @param length
 *     The number of bytes within the memory region.
 *
 * @returns
 *     Non-zero if all bytes within the memory region have the value of zero,
 *     zero otherwise.
 */
static int is_all_zeroes(void* ptr, size_t length) {

    int result = 0;

    unsigned char* current = (unsigned char*) ptr;
    for (size_t i = 0; i < length; i++)
        result |= *(current++);

    return !result;

}

/**
 * Test which verifies that guac_mem_zalloc() successfully allocates blocks of
 * memory for inputs that can reasonably be expected to succeed, and that each
 * block is zeroed out.
 */
void test_mem__zalloc_success() {

    void* ptr;

    ptr = guac_mem_zalloc(123);
    CU_ASSERT_PTR_NOT_NULL(ptr);
    CU_ASSERT(is_all_zeroes(ptr, 123));
    guac_mem_free(ptr);

    ptr = guac_mem_zalloc(123, 456);
    CU_ASSERT_PTR_NOT_NULL(ptr);
    CU_ASSERT(is_all_zeroes(ptr, 123 * 456));
    guac_mem_free(ptr);

    ptr = guac_mem_zalloc(123, 456, 789);
    CU_ASSERT_PTR_NOT_NULL(ptr);
    CU_ASSERT(is_all_zeroes(ptr, 123 * 456 * 789));
    guac_mem_free(ptr);

}

/**
 * Test which verifies that guac_mem_zalloc() fails to allocate blocks of memory
 * that exceed the capacity of a size_t.
 */
void test_mem__zalloc_fail_large() {
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(123, 456, SIZE_MAX));
    CU_ASSERT_PTR_NULL(guac_mem_zalloc(SIZE_MAX / 2, SIZE_MAX / 2));
}

