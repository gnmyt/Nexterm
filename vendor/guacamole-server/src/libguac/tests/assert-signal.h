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

#ifndef GUAC_LIBGUAC_TESTS_ASSERT_SIGNAL_H
#define GUAC_LIBGUAC_TESTS_ASSERT_SIGNAL_H

#include <CUnit/CUnit.h>
#include <signal.h>
#include <stdlib.h>
#include <sys/wait.h>
#include <unistd.h>

/**
 * Verifies that the given test terminates the calling process with the given
 * signal.
 *
 * @param sig
 *     The signal that is expected to terminate the calling process.
 *
 * @param test
 *     The test that is expected to terminate the calling process with the
 *     given signal.
 */
#define ASSERT_SIGNALLED(sig, test) \
    do {                                                                      \
                                                                              \
        /* Fork to ensure test can safely terminate */                        \
        pid_t _child = fork();                                                \
        CU_ASSERT_NOT_EQUAL_FATAL(_child, -1);                                \
                                                                              \
        /* Run test strictly within child process */                          \
        if (_child == 0) {                                                    \
            do { test; } while (0);                                           \
            exit(0);                                                          \
        }                                                                     \
                                                                              \
        /* Wait for child process to terminate */                             \
        int _status = 0;                                                      \
        CU_ASSERT_EQUAL_FATAL(waitpid(_child, &_status, 0), _child);          \
                                                                              \
        /* Verify process terminated with expected signal */                  \
        if (WIFSIGNALED(_status)) {                                           \
            CU_ASSERT_EQUAL(WTERMSIG(_status), (sig));                        \
        }                                                                     \
        else                                                                  \
            CU_FAIL("Process did not terminate due to a signal");             \
                                                                              \
    } while (0)

#endif

