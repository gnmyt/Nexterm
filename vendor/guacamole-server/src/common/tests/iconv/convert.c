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
#include "convert-test-data.h"

#include <CUnit/CUnit.h>
#include <stdio.h>

/**
 * Tests that conversion between character sets using the given guac_iconv_read
 * and guac_iconv_write implementations matches expectations.
 *
 * @param reader
 *     The guac_iconv_read implementation to use to read the input string.
 *
 * @param in_string
 *     A pointer to the test_string structure describing the input string being
 *     tested.
 *
 * @param writer
 *     The guac_iconv_write implementation to use to write the output string
 *     (the converted input string).
 *
 * @param out_string
 *     A pointer to the test_string structure describing the expected result of
 *     the conversion.
 */
static void verify_conversion(
        guac_iconv_read* reader,  test_string* in_string,
        guac_iconv_write* writer, test_string* out_string) {

    char output[4096];
    char input[4096];

    const char* current_input = input;
    char* current_output = output;

    memcpy(input, in_string->buffer, in_string->size);
    guac_iconv(reader, &current_input,  sizeof(input),
               writer, &current_output, sizeof(output));

    /* Verify output length */
    CU_ASSERT_EQUAL(out_string->size, current_output - output);

    /* Verify entire input read */
    CU_ASSERT_EQUAL(in_string->size, current_input - input);

    /* Verify output content */
    CU_ASSERT_EQUAL(0, memcmp(output, out_string->buffer, out_string->size));

}

/**
 * Test which verifies that every supported encoding can be correctly converted
 * to every other supported encoding, with all line endings preserved verbatim
 * (not normalized).
 */
void test_iconv__preserve() {
    for (int i = 0; i < NUM_SUPPORTED_ENCODINGS; i++) {
        for (int j = 0; j < NUM_SUPPORTED_ENCODINGS; j++) {

            encoding_test_parameters* from = &test_params[i];
            encoding_test_parameters* to = &test_params[j];

            printf("# \"%s\" -> \"%s\" ...\n", from->name, to->name);
            verify_conversion(from->reader, &from->test_mixed,
                    to->writer, &to->test_mixed);

        }
    }
}

/**
 * Test which verifies that every supported encoding can be correctly converted
 * to every other supported encoding, normalizing all line endings to
 * Unix-style line endings.
 */
void test_iconv__normalize_unix() {
    for (int i = 0; i < NUM_SUPPORTED_ENCODINGS; i++) {
        for (int j = 0; j < NUM_SUPPORTED_ENCODINGS; j++) {

            encoding_test_parameters* from = &test_params[i];
            encoding_test_parameters* to = &test_params[j];

            printf("# \"%s\" -> \"%s\" ...\n", from->name, to->name);
            verify_conversion(from->reader_normalized, &from->test_mixed,
                    to->writer, &to->test_unix);

        }
    }
}

/**
 * Test which verifies that every supported encoding can be correctly converted
 * to every other supported encoding, normalizing all line endings to
 * Windows-style line endings.
 */
void test_iconv__normalize_crlf() {
    for (int i = 0; i < NUM_SUPPORTED_ENCODINGS; i++) {
        for (int j = 0; j < NUM_SUPPORTED_ENCODINGS; j++) {

            encoding_test_parameters* from = &test_params[i];
            encoding_test_parameters* to = &test_params[j];

            printf("# \"%s\" -> \"%s\" ...\n", from->name, to->name);
            verify_conversion(from->reader_normalized, &from->test_mixed,
                    to->writer_crlf, &to->test_windows);

        }
    }
}

