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
#include <guacamole/error.h>
#include <guacamole/parser.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>

#include <stdlib.h>
#include <unistd.h>

/**
 * Test string which contains exactly four Unicode characters encoded in UTF-8.
 * This particular test string uses several characters which encode to multiple
 * bytes in UTF-8.
 */
#define UTF8_4 "\xe7\x8a\xac\xf0\x90\xac\x80z\xc3\xa1"

/**
 * Writes a series of Guacamole instructions as raw bytes to the given file
 * descriptor. The instructions written correspond to the instructions verified
 * by read_expected_instructions(). The given file descriptor is automatically
 * closed as a result of calling this function.
 *
 * @param fd
 *     The file descriptor to write instructions to.
 */
static void write_instructions(int fd) {

    char test_string[] = "4.test,6.a" UTF8_4 "b,"
                         "5.12345,10.a" UTF8_4 UTF8_4 "c;"
                         "5.test2,10.hellohello,15.worldworldworld;";

    char* current = test_string;
    int remaining = sizeof(test_string) - 1;

    /* Write all bytes in test string */
    while (remaining > 0) {

        /* Bail out immediately if write fails (test will fail in parent
         * process due to failure to read) */
        int written = write(fd, current, remaining);
        if (written <= 0)
            break;

        current += written;
        remaining -= written;

    }

    /* Done writing */
    close(fd);

}

/**
 * Reads and parses instructions from the given file descriptor using a
 * guac_socket and guac_parser, verifying that those instructions match the
 * series of Guacamole instructions expected to be written by
 * write_instructions(). The given file descriptor is automatically closed as a
 * result of calling this function.
 *
 * @param fd
 *     The file descriptor to read data from.
 */
static void read_expected_instructions(int fd) {

    /* Open guac socket */
    guac_socket* socket = guac_socket_open(fd);
    CU_ASSERT_PTR_NOT_NULL_FATAL(socket);

    /* Allocate parser */
    guac_parser* parser = guac_parser_alloc();
    CU_ASSERT_PTR_NOT_NULL_FATAL(parser);

    /* Read and validate first instruction */
    CU_ASSERT_EQUAL_FATAL(guac_parser_read(parser, socket, 1000000), 0);
    CU_ASSERT_STRING_EQUAL(parser->opcode, "test");
    CU_ASSERT_EQUAL_FATAL(parser->argc, 3);
    CU_ASSERT_STRING_EQUAL(parser->argv[0], "a" UTF8_4 "b");
    CU_ASSERT_STRING_EQUAL(parser->argv[1], "12345");
    CU_ASSERT_STRING_EQUAL(parser->argv[2], "a" UTF8_4 UTF8_4 "c");
    
    /* Read and validate second instruction */
    CU_ASSERT_EQUAL_FATAL(guac_parser_read(parser, socket, 1000000), 0);
    CU_ASSERT_STRING_EQUAL(parser->opcode, "test2");
    CU_ASSERT_EQUAL_FATAL(parser->argc, 2);
    CU_ASSERT_STRING_EQUAL(parser->argv[0], "hellohello");
    CU_ASSERT_STRING_EQUAL(parser->argv[1], "worldworldworld");

    /* Done */
    guac_parser_free(parser);
    guac_socket_free(socket);

}

/**
 * Tests that guac_parser_read() correctly reads and parses instructions
 * received over a guac_socket. A child process is forked to write a series of
 * instructions which are read and verified by the parent process.
 */
void test_parser__read() {

    int fd[2];

    /* Create pipe */
    CU_ASSERT_EQUAL_FATAL(pipe(fd), 0);

    int read_fd = fd[0];
    int write_fd = fd[1];

    /* Fork into writer process (child) and reader process (parent) */
    int childpid;
    CU_ASSERT_NOT_EQUAL_FATAL((childpid = fork()), -1);

    /* Attempt to write a series of instructions within the child process */
    if (childpid == 0) {
        close(read_fd);
        write_instructions(write_fd);
        exit(0);
    }

    /* Read and verify the expected instructions within the parent process */
    close(write_fd);
    read_expected_instructions(read_fd);
 
}

