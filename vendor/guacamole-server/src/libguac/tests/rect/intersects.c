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
 * Test which verifies intersection testing via guac_rect_intersects().
 */
void test_rect__intersects() {

    int res;

    guac_rect min;
    guac_rect rect;

    /* NOTE: This rectangle will extend from (10, 10) inclusive to (20, 20) exclusive */
    guac_rect_init(&min, 10, 10, 10, 10);

    /* Rectangle that does not intersect by a fair margin */
    guac_rect_init(&rect, 25, 25, 5, 5);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_FALSE(res);

    /* Rectangle that barely does not intersect (one pixel away from intersecting) */
    guac_rect_init(&rect, 20, 20, 5, 5);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_FALSE(res);

    /* Rectangle that intersects by being entirely inside the other */
    guac_rect_init(&rect, 11, 11, 5, 5);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_TRUE(res);

    /* Rectangle that intersects with the upper-left corner */
    guac_rect_init(&rect, 8, 8, 5, 5);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_TRUE(res);

    /* Rectangle that intersects with the lower-right corner */
    guac_rect_init(&rect, 18, 18, 5, 5);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_TRUE(res);

    /* Rectangle that intersects with the uppper-left corner and shares both
     * the upper and left edges */
    guac_rect_init(&rect, 10, 10, 5, 5);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_TRUE(res);

    /* Rectangle that barely fails to intersect the upper-left corner (one
     * pixel away) */
    guac_rect_init(&rect, 5, 10, 5, 5);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_FALSE(res);

    /* Rectangle that barely fails to intersect the upper-right corner (one
     * pixel away) */
    guac_rect_init(&rect, 20, 10, 5, 5);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_FALSE(res);

    /* Rectangle that intersects by entirely containing the other */
    guac_rect_init(&rect, 5, 5, 20, 20);
    res = guac_rect_intersects(&rect, &min);
    CU_ASSERT_TRUE(res);

}

