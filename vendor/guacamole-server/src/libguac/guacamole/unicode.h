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

#ifndef _GUAC_UNICODE_H
#define _GUAC_UNICODE_H

/**
 * Provides functions for manipulating Unicode strings.
 *
 * @file unicode.h
 */

#include <stddef.h>

/**
 * Given the initial byte of a single UTF-8 character, returns the overall
 * byte size of the entire character.
 *
 * @param c The initial byte of the character to check.
 * @return The number of bytes in the given character overall.
 */
size_t guac_utf8_charsize(unsigned char c);

/**
 * Given a UTF-8-encoded string, returns the length of the string in characters
 * (not bytes).
 *
 * @param str The UTF-8 string to calculate the length of.
 * @return The length in characters of the given UTF-8 string.
 */
size_t guac_utf8_strlen(const char* str);

/**
 * Given destination buffer and its length, writes the given codepoint as UTF-8
 * to the buffer, returning the number of bytes written. If there is not enough
 * space in the buffer to write the character, no bytes are written at all.
 *
 * @param codepoint The Unicode codepoint to write to the buffer.
 * @param utf8 The buffer to write to.
 * @param length The length of the buffer, in bytes.
 * @return The number of bytes written, which may be zero if there is not
 *         enough space in the buffer to write the UTF-8 character.
 */
int guac_utf8_write(int codepoint, char* utf8, int length);

/**
 * Given a buffer containing UTF-8 characters, reads the first codepoint in the
 * buffer, returning the length of the codepoint in bytes. If no codepoint
 * could be read, zero is returned.
 *
 * @param utf8 A buffer containing UTF-8 characters.
 * @param length The length of the buffer, in bytes.
 * @param codepoint A pointer to an integer which will contain the codepoint
 *                  read, if any. If no character can be read, the integer
 *                  will be left untouched.
 * @return The number of bytes read, which may be zero if there is not enough
 *         space in the buffer to read a character.
 */
int guac_utf8_read(const char* utf8, int length, int* codepoint);

#endif

