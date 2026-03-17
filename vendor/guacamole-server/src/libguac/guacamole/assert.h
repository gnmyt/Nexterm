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

#ifndef GUAC_ASSERT_H
#define GUAC_ASSERT_H

#include <stdio.h>
#include <stdlib.h>

/**
 * Performs a runtime assertion that verifies the given condition evaluates to
 * true (non-zero). If the condition evaluates to false (zero), execution is
 * aborted with abort().
 *
 * This macro should be used only in cases where the performance impact of
 * verifying the assertion is negligible and it is benificial to always verify
 * the assertion. Unlike the standard assert(), this macro will never be
 * omitted by the compiler.
 *
 * @param expression
 *     The condition to test.
 */
#define GUAC_ASSERT(expression) do {                                          \
        if (!(expression)) {                                                  \
            fprintf(stderr, "GUAC_ASSERT in %s() failed at %s:%i.\n",         \
                    __func__, __FILE__, __LINE__);                            \
            abort();                                                          \
        }                                                                     \
    } while(0)

#endif
