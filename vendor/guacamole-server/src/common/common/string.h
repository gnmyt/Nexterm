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

#ifndef __GUAC_COMMON_STRING_H
#define __GUAC_COMMON_STRING_H

#include "config.h"

#include <stddef.h>

/**
 * Counts the number of occurrences of a given character in a string.
 *
 * @param string
 *     The string to count occurrences within.
 *
 * @param c
 *     The character to count occurrences of.
 *
 * @return
 *     The number of occurrences.
 */
size_t guac_count_occurrences(const char* string, char c);

/**
 * Splits a string into a newly-allocated array of strings. The array itself
 * and each string within the array will eventually need to be freed through
 * calls to guac_mem_free(). The array is NULL-terminated.
 *
 * @param string
 *     The string to split.
 *
 * @param delim
 *     The character which separates individual substrings within the
 *     given string.
 *
 * @return
 *     A newly-allocated, NULL-terminated array of strings.
 */
char** guac_split(const char* string, char delim);

#endif

