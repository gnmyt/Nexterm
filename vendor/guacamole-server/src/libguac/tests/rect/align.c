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
#include <guacamole/rect.h>

/**
 * Test which verifies guac_rect_align() properly shifts and resizes rectangles
 * to fit an NxN grid.
 */
void test_rect__align() {

    /* A cell size of 4 is 2^4 (16) */
    const int cell_size = 4;

    guac_rect rect;

    /* Simple case where only the rectangle dimensions need adjustment */
    guac_rect_init(&rect, 0, 0, 25, 25);
    guac_rect_align(&rect, cell_size);
    CU_ASSERT_EQUAL(0, rect.left);
    CU_ASSERT_EQUAL(0, rect.top);
    CU_ASSERT_EQUAL(32, rect.right);
    CU_ASSERT_EQUAL(32, rect.bottom);

    /* More complex case where the rectangle location AND dimensions both need
     * adjustment */
    guac_rect_init(&rect, 75, 75, 25, 25);
    guac_rect_align(&rect, cell_size);
    CU_ASSERT_EQUAL(64, rect.left);
    CU_ASSERT_EQUAL(64, rect.top);
    CU_ASSERT_EQUAL(112, rect.right);
    CU_ASSERT_EQUAL(112, rect.bottom);

    /* Complex case where the rectangle location AND dimensions both need
     * adjustment, and the rectangle location is negative */
    guac_rect_init(&rect, -5, -5, 25, 25);
    guac_rect_align(&rect, cell_size);
    CU_ASSERT_EQUAL(-16, rect.left);
    CU_ASSERT_EQUAL(-16, rect.top);
    CU_ASSERT_EQUAL(32, rect.right);
    CU_ASSERT_EQUAL(32, rect.bottom);

    /* Complex case where the rectangle location AND dimensions both need
     * adjustment, and all rectangle coordinates are negative */
    guac_rect_init(&rect, -30, -30, 25, 25);
    guac_rect_align(&rect, cell_size);
    CU_ASSERT_EQUAL(-32, rect.left);
    CU_ASSERT_EQUAL(-32, rect.top);
    CU_ASSERT_EQUAL(0, rect.right);
    CU_ASSERT_EQUAL(0, rect.bottom);

}

