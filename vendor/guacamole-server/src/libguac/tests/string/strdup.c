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
#include <guacamole/string.h>

#include <stdlib.h>
#include <string.h>

/**
 * Source test string for copying.
 */
const char* source_string = "Mashing avocados.";

/**
 * A NULL string variable for copying to insure that NULL is copied properly.
 */
const char* null_string = NULL;

/**
 * Verify guac_strdup() behavior when the string is both NULL and not NULL.
 */
void test_string__strdup() {

    /* Copy the strings. */
    char* dest_string = guac_strdup(source_string);
    char* null_copy = guac_strdup(null_string);
    
    /* Run the tests. */
    CU_ASSERT_STRING_EQUAL(dest_string, "Mashing avocados.");
    CU_ASSERT_PTR_NULL(null_copy);

    guac_mem_free(dest_string);

}
