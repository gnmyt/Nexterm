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
 * Test which verifies that guac_mem_free() sets the provided pointer to NULL after
 * freeing.
 */
void test_mem__free_assigns_null() {
    void* ptr = guac_mem_alloc(123);
    CU_ASSERT_PTR_NOT_NULL(ptr);
    guac_mem_free(ptr);
    CU_ASSERT_PTR_NULL(ptr);
}

/**
 * Test which verifies that guac_mem_free_const() can be used to free constant
 * pointers, but that those pointers are not set to NULL after freeing.
 */
void test_mem__free_const() {
    const void* ptr = guac_mem_alloc(123);
    CU_ASSERT_PTR_NOT_NULL(ptr);
    guac_mem_free_const(ptr);
    CU_ASSERT_PTR_NOT_NULL(ptr);
}

/**
 * Test which verifies that guac_mem_free() does nothing if provided a NULL
 * pointer.
 */
void test_mem__free_null() {
    void* ptr = NULL;
    guac_mem_free(ptr);
}

/**
 * Test which verifies that guac_mem_free_const() does nothing if provided a NULL
 * pointer.
 */
void test_mem__free_null_const() {
    const void* ptr = NULL;
    guac_mem_free_const(ptr);
}

