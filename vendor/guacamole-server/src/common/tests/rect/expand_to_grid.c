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
 * Test which verifies guac_common_rect_expand_to_grid() properly shifts and
 * resizes rectangles to fit an NxN grid.
 */
void test_rect__expand_to_grid() {

    int cell_size = 16;

    guac_common_rect max;
    guac_common_rect rect;

    /* Simple adjustment */
    guac_common_rect_init(&rect, 0, 0, 25, 25);
    guac_common_rect_init(&max, 0, 0, 100, 100);
    guac_common_rect_expand_to_grid(cell_size, &rect, &max);
    CU_ASSERT_EQUAL(0, rect.x);
    CU_ASSERT_EQUAL(0, rect.y);
    CU_ASSERT_EQUAL(32, rect.width);
    CU_ASSERT_EQUAL(32, rect.height);

    /* Adjustment with moving of rect */
    guac_common_rect_init(&rect, 75, 75, 25, 25);
    guac_common_rect_init(&max, 0, 0, 100, 100);
    guac_common_rect_expand_to_grid(cell_size, &rect, &max);
    CU_ASSERT_EQUAL(max.width - 32, rect.x);
    CU_ASSERT_EQUAL(max.height - 32, rect.y);
    CU_ASSERT_EQUAL(32, rect.width);
    CU_ASSERT_EQUAL(32, rect.height);

    guac_common_rect_init(&rect, -5, -5, 25, 25);
    guac_common_rect_init(&max, 0, 0, 100, 100);
    guac_common_rect_expand_to_grid(cell_size, &rect, &max);
    CU_ASSERT_EQUAL(0, rect.x);
    CU_ASSERT_EQUAL(0, rect.y);
    CU_ASSERT_EQUAL(32, rect.width);
    CU_ASSERT_EQUAL(32, rect.height);

    /* Adjustment with moving and clamping of rect */
    guac_common_rect_init(&rect, 0, 0, 25, 15);
    guac_common_rect_init(&max, 0, 5, 32, 15);
    guac_common_rect_expand_to_grid(cell_size, &rect, &max);
    CU_ASSERT_EQUAL(max.x, rect.x);
    CU_ASSERT_EQUAL(max.y, rect.y);
    CU_ASSERT_EQUAL(max.width, rect.width);
    CU_ASSERT_EQUAL(max.height, rect.height);

}

