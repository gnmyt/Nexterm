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
 * Test which verifies that guac_mem_realloc_or_die() returns NULL for all
 * inputs involving at least one zero value (reallocation to zero bytes is not
 * an error but equivalent freeing the memory).
 */
void test_mem__realloc_or_die_success_zero() {

    void* ptr;

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 0));

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 0, 0));

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 0, 0, 0));

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 0, 0, 0, 0));

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 0, 0, 0, 0, 0));

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 1, 0));

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 3, 2, 0));

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 5, 0, 8, 9));

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    CU_ASSERT_PTR_NULL(guac_mem_realloc_or_die(ptr, 99, 99, 99, 0, 99));

}

/**
 * Test which verifies that guac_mem_realloc_or_die() successfully allocates
 * blocks of memory for inputs that can reasonably be expected to succeed.
 */
void test_mem__realloc_or_die_success() {

    void* ptr;

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    ptr = guac_mem_realloc_or_die(ptr, 123);
    CU_ASSERT_PTR_NOT_NULL(ptr);
    guac_mem_free(ptr);

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    ptr = guac_mem_realloc_or_die(ptr, 123, 456);
    CU_ASSERT_PTR_NOT_NULL(ptr);
    guac_mem_free(ptr);

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    ptr = guac_mem_realloc_or_die(ptr, 123, 456, 789);
    CU_ASSERT_PTR_NOT_NULL(ptr);
    guac_mem_free(ptr);

}

/**
 * Test which verifies that guac_mem_realloc_or_die() fails to allocate blocks of
 * memory that exceed the capacity of a size_t.
 */
void test_mem__realloc_or_die_fail_large() {

    void* ptr;

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    ASSERT_SIGNALLED(SIGABRT, guac_mem_realloc_or_die(ptr, 123, 456, SIZE_MAX));
    guac_mem_free(ptr);

    ptr = guac_mem_alloc(1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(ptr);
    ASSERT_SIGNALLED(SIGABRT, guac_mem_realloc_or_die(ptr, SIZE_MAX / 2, SIZE_MAX / 2));
    guac_mem_free(ptr);

}

