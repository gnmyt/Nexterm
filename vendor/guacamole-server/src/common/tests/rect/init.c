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

#include "common/rect.h"

#include <CUnit/CUnit.h>

/**
 * Test which verifies rectangle initialization via guac_common_rect_init().
 */
void test_rect__init() {

    guac_common_rect max;

    guac_common_rect_init(&max, 0, 0, 100, 100);

    CU_ASSERT_EQUAL(0, max.x);
    CU_ASSERT_EQUAL(0, max.y);
    CU_ASSERT_EQUAL(100, max.width);
    CU_ASSERT_EQUAL(100, max.height);

}

