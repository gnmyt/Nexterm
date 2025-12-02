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
#include <guacamole/mem.h>

#include <stdlib.h>

/**
 * Test which verifies that guac_split() splits a string on occurrences of a
 * given character.
 */
void test_string__split() {

    /* Split test string */
    char** tokens = guac_split("this is a test string", ' ');
    CU_ASSERT_PTR_NOT_NULL(tokens);

    /* Check resulting tokens */
    CU_ASSERT_PTR_NOT_NULL_FATAL(tokens[0]);
    CU_ASSERT_STRING_EQUAL("this", tokens[0]);

    CU_ASSERT_PTR_NOT_NULL_FATAL(tokens[1]);
    CU_ASSERT_STRING_EQUAL("is", tokens[1]);

    CU_ASSERT_PTR_NOT_NULL_FATAL(tokens[2]);
    CU_ASSERT_STRING_EQUAL("a", tokens[2]);

    CU_ASSERT_PTR_NOT_NULL_FATAL(tokens[3]);
    CU_ASSERT_STRING_EQUAL("test", tokens[3]);

    CU_ASSERT_PTR_NOT_NULL_FATAL(tokens[4]);
    CU_ASSERT_STRING_EQUAL("string", tokens[4]);

    CU_ASSERT_PTR_NULL(tokens[5]);

    /* Clean up */
    guac_mem_free(tokens[0]);
    guac_mem_free(tokens[1]);
    guac_mem_free(tokens[2]);
    guac_mem_free(tokens[3]);
    guac_mem_free(tokens[4]);
    guac_mem_free(tokens);

}

