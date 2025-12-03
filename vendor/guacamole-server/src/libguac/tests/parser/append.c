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
#include <guacamole/parser.h>

#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

/**
 * Test which verifies that guac_parser correctly parses Guacamole instructions
 * from arbitrary blocks of data passed to guac_parser_append().
 */
void test_parser__append() {

    /* Allocate parser */
    guac_parser* parser = guac_parser_alloc();
    CU_ASSERT_PTR_NOT_NULL_FATAL(parser);

    /* Instruction input */
    char buffer[] = "4.test,8.testdata,5.zxcvb,13.guacamoletest;XXXXXXXXXXXXXXXXXX";
    char* current = buffer;

    /* While data remains */
    int remaining = sizeof(buffer)-1;
    while (remaining > 18) {

        /* Parse more data */
        int parsed = guac_parser_append(parser, current, remaining);
        if (parsed == 0)
            break;

        current += parsed;
        remaining -= parsed;

    }

    /* Parse of instruction should be complete */
    CU_ASSERT_EQUAL(remaining, 18);
    CU_ASSERT_EQUAL(parser->state, GUAC_PARSE_COMPLETE);

    /* Parse is complete - no more data should be read */
    CU_ASSERT_EQUAL(guac_parser_append(parser, current, 18), 0);
    CU_ASSERT_EQUAL(parser->state, GUAC_PARSE_COMPLETE);

    /* Validate resulting structure */
    CU_ASSERT_EQUAL(parser->argc, 3);
    CU_ASSERT_PTR_NOT_NULL_FATAL(parser->opcode);
    CU_ASSERT_PTR_NOT_NULL_FATAL(parser->argv[0]);
    CU_ASSERT_PTR_NOT_NULL_FATAL(parser->argv[1]);
    CU_ASSERT_PTR_NOT_NULL_FATAL(parser->argv[2]);

    /* Validate resulting content */
    CU_ASSERT_STRING_EQUAL(parser->opcode,  "test");
    CU_ASSERT_STRING_EQUAL(parser->argv[0], "testdata");
    CU_ASSERT_STRING_EQUAL(parser->argv[1], "zxcvb");
    CU_ASSERT_STRING_EQUAL(parser->argv[2], "guacamoletest");

}

