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

#include "common/iconv.h"

/**
 * Representation of test string data and its length in bytes.
 */
typedef struct test_string {

    /**
     * The raw content of the test string.
     */
    unsigned char* buffer;

    /**
     * The number of bytes within the test string, including null terminator.
     */
    int size;

} test_string;

/**
 * Convenience macro which statically-initializes a test_string with the given
 * string value, automatically calculating its size in bytes.
 *
 * @param value
 *     The string value.
 */
#define TEST_STRING(value) {            \
    .buffer = (unsigned char*) (value), \
    .size = sizeof(value)               \
}

/**
 * The parameters applicable to a unit test for a particular encoding supported
 * by guac_iconv().
 */
typedef struct encoding_test_parameters {

    /**
     * The human-readable name of this encoding. This will be logged to the
     * test suite log to assist with debugging test failures.
     */
    const char* name;

    /**
     * Reader function which reads using this encoding and does not perform any
     * transformation on newline characters.
     */
    guac_iconv_read* reader;

    /**
     * Reader function which reads using this encoding and automatically
     * normalizes newline sequences to Unix-style newline characters.
     */
    guac_iconv_read* reader_normalized;

    /**
     * Writer function which writes using this encoding and does not perform
     * any transformation on newline characters.
     */
    guac_iconv_write* writer;

    /**
     * Writer function which writes using this encoding, but writes newline
     * characters as CRLF sequences.
     */
    guac_iconv_write* writer_crlf;

    /**
     * A test string having both Windows- and Unix-style line endings. Except
     * for the line endings, the characters represented within this test string
     * must be identical to all other test strings.
     */
    test_string test_mixed;

    /**
     * A test string having only Unix-style line endings. Except for the line
     * endings, the characters represented within this test string must be
     * identical to all other test strings.
     */
    test_string test_unix;

    /**
     * A test string having only Windows-style line endings. Except for the
     * line endings, the characters represented within this test string must be
     * identical to all other test strings.
     */
    test_string test_windows;

} encoding_test_parameters;

/**
 * The total number of encodings supported by guac_iconv().
 */
#define NUM_SUPPORTED_ENCODINGS 4

/**
 * Test parameters for each supported encoding. The test strings included each
 * consist of five repeated lines of "papà è bello", omitting the line ending
 * of the final line.
 */
extern encoding_test_parameters test_params[NUM_SUPPORTED_ENCODINGS];

