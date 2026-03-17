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

#include <guacamole/mem.h>

#include <CUnit/CUnit.h>
#include <stdlib.h>

/**
 * Test which verifies absolute Windows-style paths are correctly normalized to
 * absolute paths with Windows separators and no relative components.
 */
void test_fs__normalize_absolute_windows() {

    char normalized[GUAC_RDP_FS_MAX_PATH];

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo\\bar\\baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\bar\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo\\bar\\..\\baz\\", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo\\bar\\..\\..\\baz\\a\\..\\b", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\baz\\b", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo\\.\\bar\\baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\bar\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo\\bar\\..\\..\\..\\..\\..\\..\\baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\baz", sizeof(normalized));

}

/**
 * Test which verifies absolute UNIX-style paths are correctly normalized to
 * absolute paths with Windows separators and no relative components.
 */
void test_fs__normalize_absolute_unix() {

    char normalized[GUAC_RDP_FS_MAX_PATH];

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("/", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("/foo/bar/baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\bar\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("/foo/bar/../baz/", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("/foo/bar/../../baz/a/../b", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\baz\\b", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("/foo/./bar/baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\bar\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("/foo/bar/../../../../../../baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\baz", sizeof(normalized));

}

/**
 * Test which verifies absolute paths consisting of mixed Windows and UNIX path
 * separators are correctly normalized to absolute paths with Windows
 * separators and no relative components.
 */
void test_fs__normalize_absolute_mixed() {

    char normalized[GUAC_RDP_FS_MAX_PATH];

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo/bar\\baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\bar\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("/foo\\bar/..\\baz/", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo/bar\\../../baz\\a\\..\\b", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\baz\\b", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo\\.\\bar/baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\foo\\bar\\baz", sizeof(normalized));

    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path("\\foo/bar\\../..\\..\\..\\../..\\baz", normalized), 0)
    CU_ASSERT_NSTRING_EQUAL(normalized, "\\baz", sizeof(normalized));

}

/**
 * Test which verifies relative Windows-style paths are always rejected.
 */
void test_fs__normalize_relative_windows() {

    char normalized[GUAC_RDP_FS_MAX_PATH];

    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(".", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("..", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("foo", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(".\\foo", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("..\\foo", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("foo\\bar\\baz", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(".\\foo\\bar\\baz", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("..\\foo\\bar\\baz", normalized), 0)

}

/**
 * Test which verifies relative UNIX-style paths are always rejected.
 */
void test_fs__normalize_relative_unix() {

    char normalized[GUAC_RDP_FS_MAX_PATH];

    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(".", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("..", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("foo", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("./foo", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("../foo", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("foo/bar/baz", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("./foo/bar/baz", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("../foo/bar/baz", normalized), 0)

}

/**
 * Test which verifies relative paths consisting of mixed Windows and UNIX path
 * separators are always rejected.
 */
void test_fs__normalize_relative_mixed() {

    char normalized[GUAC_RDP_FS_MAX_PATH];

    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("foo\\bar/baz", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(".\\foo/bar/baz", normalized), 0)
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path("../foo\\bar\\baz", normalized), 0)

}

/**
 * Generates a dynamically-allocated path having the given number of bytes, not
 * counting the null-terminator. The path will contain only Windows-style path
 * separators. The returned path must eventually be freed with a call to
 * guac_mem_free().
 *
 * @param length
 *     The number of bytes to include in the generated path, not counting the
 *     null-terminator. If -1, the length of the path will be automatically
 *     determined from the provided max_depth.
 *
 * @param max_depth
 *     The maximum number of path components to include within the generated
 *     path.
 *
 * @return
 *     A dynamically-allocated path containing the given number of bytes, not
 *     counting the null-terminator. This path must eventually be freed with a
 *     call to guac_mem_free().
 */
static char* generate_path(int length, int max_depth) {

    /* If no length given, calculate space required from max_depth */
    if (length == -1)
        length = max_depth * 2;

    int i;
    char* input = guac_mem_alloc(guac_mem_ckd_add_or_die(length, 1));

    /* Fill path with \x\x\x\x\x\x\x\x\x\x\...\xxxxxxxxx... */
    for (i = 0; i < length; i++) {
        if (max_depth > 0 && i % 2 == 0) {
            input[i] = '\\';
            max_depth--;
        }
        else
            input[i] = 'x';
    }

    /* Add null terminator */
    input[length] = '\0';

    return input;

}

/**
 * Test which verifies that paths exceeding the maximum path length are
 * rejected.
 */
void test_fs__normalize_long() {

    char* input;
    char normalized[GUAC_RDP_FS_MAX_PATH];

    /* Exceeds maximum length by a factor of 2 */
    input = generate_path(GUAC_RDP_FS_MAX_PATH * 2, GUAC_RDP_MAX_PATH_DEPTH);
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(input, normalized), 0);
    guac_mem_free(input);

    /* Exceeds maximum length by one byte */
    input = generate_path(GUAC_RDP_FS_MAX_PATH, GUAC_RDP_MAX_PATH_DEPTH);
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(input, normalized), 0);
    guac_mem_free(input);

    /* Exactly maximum length */
    input = generate_path(GUAC_RDP_FS_MAX_PATH - 1, GUAC_RDP_MAX_PATH_DEPTH);
    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path(input, normalized), 0);
    guac_mem_free(input);

}

/**
 * Test which verifies that paths exceeding the maximum path depth are
 * rejected.
 */
void test_fs__normalize_deep() {

    char* input;
    char normalized[GUAC_RDP_FS_MAX_PATH];

    /* Exceeds maximum depth by a factor of 2 */
    input = generate_path(-1, GUAC_RDP_MAX_PATH_DEPTH * 2);
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(input, normalized), 0);
    guac_mem_free(input);

    /* Exceeds maximum depth by one component */
    input = generate_path(-1, GUAC_RDP_MAX_PATH_DEPTH + 1);
    CU_ASSERT_NOT_EQUAL(guac_rdp_fs_normalize_path(input, normalized), 0);
    guac_mem_free(input);

    /* Exactly maximum depth */
    input = generate_path(-1, GUAC_RDP_MAX_PATH_DEPTH);
    CU_ASSERT_EQUAL(guac_rdp_fs_normalize_path(input, normalized), 0);
    guac_mem_free(input);

}

