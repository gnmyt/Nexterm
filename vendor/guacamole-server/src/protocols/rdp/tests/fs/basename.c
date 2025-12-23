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

#include "fs.h"

#include <CUnit/CUnit.h>
#include <stdlib.h>

/**
 * Test which verifies basenames are correctly extracted from Windows-style
 * paths.
 */
void test_fs__basename_windows() {
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("\\foo\\bar\\baz"), "baz")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("\\foo\\bar\\..\\baz\\"), "")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("bar\\..\\..\\baz\\a\\..\\b"), "b")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename(".\\bar\\potato"), "potato")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("..\\..\\..\\..\\..\\..\\baz"), "baz")
}

/**
 * Test which verifies basenames are correctly extracted from UNIX-style paths.
 */
void test_fs__basename_unix() {
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("/foo/bar/baz"), "baz")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("/foo/bar/../baz/"), "")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("bar/../../baz/a/../b"), "b")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("./bar/potato"), "potato")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("../../../../../../baz"), "baz")
}

/**
 * Test which verifies basenames are correctly extracted from paths consisting
 * of mixed Windows and UNIX path separators.
 */
void test_fs__basename_mixed() {
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("\\foo/bar\\baz"), "baz")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("/foo\\bar/..\\baz/"), "")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("bar\\../../baz\\a\\..\\b"), "b")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename(".\\bar/potato"), "potato")
    CU_ASSERT_STRING_EQUAL(guac_rdp_fs_basename("../..\\..\\..\\../..\\baz"), "baz")
}

