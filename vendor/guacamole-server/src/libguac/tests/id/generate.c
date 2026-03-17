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

#include "guacamole/mem.h"
#include "id.h"

#include <CUnit/CUnit.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>

/**
 * Test which verifies that each call to guac_generate_id() produces a
 * different string.
 */
void test_id__unique() {

    char* id1 = guac_generate_id('x');
    char* id2 = guac_generate_id('x');

    /* Neither string may be NULL */
    CU_ASSERT_PTR_NOT_NULL_FATAL(id1);
    CU_ASSERT_PTR_NOT_NULL_FATAL(id2);

    /* Both strings should be different */
    CU_ASSERT_STRING_NOT_EQUAL(id1, id2);

    guac_mem_free(id1);
    guac_mem_free(id2);

}

/**
 * Test which verifies that guac_generate_id() produces strings are in the
 * correct UUID-based format.
 */
void test_id__format() {

    unsigned int ignore;

    char* id = guac_generate_id('x');
    CU_ASSERT_PTR_NOT_NULL_FATAL(id);

    int items_read = sscanf(id, "x%08x-%04x-%04x-%04x-%08x%04x",
            &ignore, &ignore, &ignore, &ignore, &ignore, &ignore);

    CU_ASSERT_EQUAL(items_read, 6);
    CU_ASSERT_EQUAL(strlen(id), 37);

    guac_mem_free(id);

}

/**
 * Test which verifies that guac_generate_id() takes the specified prefix
 * character into account when generating the ID string.
 */
void test_id__prefix() {

    char* id;
    
    id = guac_generate_id('a');
    CU_ASSERT_PTR_NOT_NULL_FATAL(id);
    CU_ASSERT_EQUAL(id[0], 'a');
    guac_mem_free(id);

    id = guac_generate_id('b');
    CU_ASSERT_PTR_NOT_NULL_FATAL(id);
    CU_ASSERT_EQUAL(id[0], 'b');
    guac_mem_free(id);

}

