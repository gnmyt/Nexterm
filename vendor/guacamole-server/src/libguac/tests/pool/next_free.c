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
#include <guacamole/pool.h>

/**
 * The number of unique integers to provide through the guac_pool instance
 * being tested.
 */
#define POOL_SIZE 128

/**
 * Test which verifies that guac_pool provides access to a given number of
 * unique integers, never repeating a retrieved integer until that integer
 * is returned to the pool.
 */
void test_pool__next_free() {

    guac_pool* pool;

    int i;
    int seen[POOL_SIZE] = {0};
    int value;

    /* Get pool */
    pool = guac_pool_alloc(POOL_SIZE);
    CU_ASSERT_PTR_NOT_NULL_FATAL(pool);

    /* Fill pool */
    for (i=0; i<POOL_SIZE; i++) {

        /* Get value from pool */
        value = guac_pool_next_int(pool);

        /* Value should be within pool size */
        CU_ASSERT_FATAL(value >= 0);
        CU_ASSERT_FATAL(value <  POOL_SIZE);

        /* This should be an integer we have not seen yet */
        CU_ASSERT_EQUAL(0, seen[value]);
        seen[value]++;

        /* Return value to pool */
        guac_pool_free_int(pool, value);

    }

    /* Now that pool is filled, we should get ONLY previously seen integers */
    for (i=0; i<POOL_SIZE; i++) {

        /* Get value from pool */
        value = guac_pool_next_int(pool);

        /* Value should be within pool size */
        CU_ASSERT_FATAL(value >= 0);
        CU_ASSERT_FATAL(value <  POOL_SIZE);

        /* This should be an integer we have seen only once */
        CU_ASSERT_EQUAL(1, seen[value]);
        seen[value]++;

    }

    /* Pool is filled to minimum now. Next value should be equal to size. */
    value = guac_pool_next_int(pool);

    CU_ASSERT_EQUAL(POOL_SIZE, value);

    /* Free pool */
    guac_pool_free(pool);

}

