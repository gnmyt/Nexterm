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
 * Writes a series of Guacamole instructions using a nested guac_socket
 * wrapping another guac_socket which writes to the given file descriptor. The
 * instructions written correspond to the instructions verified by
 * read_expected_instructions(). The given file descriptor is automatically
 * closed as a result of calling this function.
 *
 * @param fd
 *     The file descriptor to write instructions to.
 */
static void write_instructions(int fd) {

    /* Open guac socket */
    guac_socket* socket = guac_socket_open(fd);

    /* Write nothing if socket cannot be allocated (test will fail in parent
     * process due to failure to read) */
    if (socket == NULL) {
        close(fd);
        return;
    }

    /* Nest socket */
    guac_socket* nested_socket = guac_socket_nest(socket, 123);

    /* Write nothing if nested socket cannot be allocated (test will fail in
     * parent process due to failure to read) */
    if (socket == NULL) {
        guac_socket_free(socket);
        return;
    }

    /* Write instructions */
    guac_protocol_send_name(nested_socket, "a" UTF8_4 "b" UTF8_4 "c");
    guac_protocol_send_sync(nested_socket, 12345, 1);

    /* Close and free sockets */
    guac_socket_free(nested_socket);
    guac_socket_free(socket);

}

/**
 * Reads raw bytes from the given file descriptor until no further bytes
 * remain, verifying that those bytes represent the series of Guacamole
 * instructions expected to be written by write_instructions(). The given
 * file descriptor is automatically closed as a result of calling this
 * function.
 *
 * @param fd
 *     The file descriptor to read data from.
 */
static void read_expected_instructions(int fd) {

    char expected[] =
        "4.nest,3.123,41."
            "4.name,11.a" UTF8_4 "b" UTF8_4 "c;"
            "4.sync,5.12345,1.1;"
        ";";

    int numread;
    char buffer[1024];
    int offset = 0;

    /* Read everything available into buffer */
    while ((numread = read(fd, &(buffer[offset]),
                    sizeof(buffer) - offset)) > 0) {
        offset += numread;
    }

    /* Verify length of read data */
    CU_ASSERT_EQUAL(offset, strlen(expected));

    /* Add NULL terminator */
    buffer[offset] = '\0';

    /* Read value should be equal to expected value */
    CU_ASSERT_STRING_EQUAL(buffer, expected);

    /* File descriptor is no longer needed */
    close(fd);

}

/**
 * Tests that the nested socket implementation of guac_socket properly
 * implements writing of instructions. A child process is forked to write a
 * series of instructions which are read and verified by the parent process.
 */
void test_socket__nested_send_instruction() {

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

