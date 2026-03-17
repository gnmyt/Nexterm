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
 * Test which verifies that guac_common_rect_clip_and_split() divides a
 * rectangle into subrectangles after removing a "hole" rectangle.
 */
void test_rect__clip_and_split() {

    int res;

    guac_common_rect cut;
    guac_common_rect min;
    guac_common_rect rect;

    guac_common_rect_init(&min, 10, 10, 10, 10);

    /* Clip top */
    guac_common_rect_init(&rect, 10, 5, 10, 10);
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(1, res);
    CU_ASSERT_EQUAL(10, cut.x);
    CU_ASSERT_EQUAL(5, cut.y);
    CU_ASSERT_EQUAL(10, cut.width);
    CU_ASSERT_EQUAL(5, cut.height);

    CU_ASSERT_EQUAL(10, rect.x);
    CU_ASSERT_EQUAL(10, rect.y);
    CU_ASSERT_EQUAL(10, rect.width);
    CU_ASSERT_EQUAL(5, rect.height);

    /* Clip bottom */
    guac_common_rect_init(&rect, 10, 15, 10, 10);
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(1, res);
    CU_ASSERT_EQUAL(10, cut.x);
    CU_ASSERT_EQUAL(20, cut.y);
    CU_ASSERT_EQUAL(10, cut.width);
    CU_ASSERT_EQUAL(5, cut.height);

    CU_ASSERT_EQUAL(10, rect.x);
    CU_ASSERT_EQUAL(15, rect.y);
    CU_ASSERT_EQUAL(10, rect.width);
    CU_ASSERT_EQUAL(5, rect.height);

    /* Clip left */
    guac_common_rect_init(&rect, 5, 10, 10, 10);
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(1, res);
    CU_ASSERT_EQUAL(5, cut.x);
    CU_ASSERT_EQUAL(10, cut.y);
    CU_ASSERT_EQUAL(5, cut.width);
    CU_ASSERT_EQUAL(10, cut.height);

    CU_ASSERT_EQUAL(10, rect.x);
    CU_ASSERT_EQUAL(10, rect.y);
    CU_ASSERT_EQUAL(5, rect.width);
    CU_ASSERT_EQUAL(10, rect.height);

    /* Clip right */
    guac_common_rect_init(&rect, 15, 10, 10, 10);
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(1, res);
    CU_ASSERT_EQUAL(20, cut.x);
    CU_ASSERT_EQUAL(10, cut.y);
    CU_ASSERT_EQUAL(5, cut.width);
    CU_ASSERT_EQUAL(10, cut.height);

    CU_ASSERT_EQUAL(15, rect.x);
    CU_ASSERT_EQUAL(10, rect.y);
    CU_ASSERT_EQUAL(5, rect.width);
    CU_ASSERT_EQUAL(10, rect.height);

    /*
     * Test a rectangle which completely covers the hole.
     * Clip and split until done.
     */
    guac_common_rect_init(&rect, 5, 5, 20, 20);

    /* Clip top */
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(1, res);
    CU_ASSERT_EQUAL(5, cut.x);
    CU_ASSERT_EQUAL(5, cut.y);
    CU_ASSERT_EQUAL(20, cut.width);
    CU_ASSERT_EQUAL(5, cut.height);

    CU_ASSERT_EQUAL(5, rect.x);
    CU_ASSERT_EQUAL(10, rect.y);
    CU_ASSERT_EQUAL(20, rect.width);
    CU_ASSERT_EQUAL(15, rect.height);

    /* Clip left */
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(1, res);
    CU_ASSERT_EQUAL(5, cut.x);
    CU_ASSERT_EQUAL(10, cut.y);
    CU_ASSERT_EQUAL(5, cut.width);
    CU_ASSERT_EQUAL(15, cut.height);

    CU_ASSERT_EQUAL(10, rect.x);
    CU_ASSERT_EQUAL(10, rect.y);
    CU_ASSERT_EQUAL(15, rect.width);
    CU_ASSERT_EQUAL(15, rect.height);

    /* Clip bottom */
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(1, res);
    CU_ASSERT_EQUAL(10, cut.x);
    CU_ASSERT_EQUAL(20, cut.y);
    CU_ASSERT_EQUAL(15, cut.width);
    CU_ASSERT_EQUAL(5, cut.height);

    CU_ASSERT_EQUAL(10, rect.x);
    CU_ASSERT_EQUAL(10, rect.y);
    CU_ASSERT_EQUAL(15, rect.width);
    CU_ASSERT_EQUAL(10, rect.height);

    /* Clip right */
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(20, cut.x);
    CU_ASSERT_EQUAL(10, cut.y);
    CU_ASSERT_EQUAL(5, cut.width);
    CU_ASSERT_EQUAL(10, cut.height);

    CU_ASSERT_EQUAL(10, rect.x);
    CU_ASSERT_EQUAL(10, rect.y);
    CU_ASSERT_EQUAL(10, rect.width);
    CU_ASSERT_EQUAL(10, rect.height);

    /* Make sure nothing is left to do */
    res = guac_common_rect_clip_and_split(&rect, &min, &cut);
    CU_ASSERT_EQUAL(0, res);

}

