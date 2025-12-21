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

#ifndef _GUAC_TERMINAL_COMMON_H
#define _GUAC_TERMINAL_COMMON_H

/**
 * Miscellaneous terminal function definitions.
 *
 * @file common.h
 */

#include "types.h"

#include <stdbool.h>

/**
 * Returns the closest value to the value given that is also
 * within the given range.
 */
int guac_terminal_fit_to_range(int value, int min, int max);

/**
 * Encodes the given codepoint as UTF-8, storing the result within the
 * provided buffer, and returning the number of bytes stored.
 */
int guac_terminal_encode_utf8(int codepoint, char* utf8);

/**
 * Returns whether a codepoint has a corresponding glyph, or is rendered
 * as a blank space.
 */
bool guac_terminal_has_glyph(int codepoint);

/**
 * Similar to write, but automatically retries the write operation until
 * an error occurs.
 */
int guac_terminal_write_all(int fd, const char* buffer, int size);

#endif

