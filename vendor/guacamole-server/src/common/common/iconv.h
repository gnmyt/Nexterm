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

#ifndef __GUAC_COMMON_ICONV_H
#define __GUAC_COMMON_ICONV_H

#include "config.h"

/**
 * Function which reads a character from the given string data, returning
 * the Unicode codepoint read, updating the string pointer to point to the
 * byte immediately after the character read.
 */
typedef int guac_iconv_read(const char** input, int remaining);

/**
 * Function writes the character having the given Unicode codepoint value to
 * the given string data, updating the string pointer to point to the byte
 * immediately after the character written.
 */
typedef void guac_iconv_write(char** output, int remaining, int value);

/**
 * Converts characters within a given string from one encoding to another,
 * as defined by the reader/writer functions specified. The input and output
 * string pointers will be updated based on the number of bytes read or
 * written.
 *
 * @param reader The reader function to use when reading the input string.
 * @param input Pointer to the beginning of the input string.
 * @param in_remaining The number of bytes remaining after the pointer to the
 *                     input string.
 * @param writer The writer function to use when writing the output string.
 * @param output Pointer to the beginning of the output string.
 * @param out_remaining The number of bytes remaining after the pointer to the
 *                      output string.
 * @return Non-zero if the NULL terminator of the input string was read and
 *         copied into the destination string, zero otherwise.
 */
int guac_iconv(guac_iconv_read* reader, const char** input, int in_remaining,
               guac_iconv_write* writer, char** output, int out_remaining);

/**
 * Read function for UTF8.
 */
guac_iconv_read GUAC_READ_UTF8;

/**
 * Read function for UTF16.
 */
guac_iconv_read GUAC_READ_UTF16;

/**
 * Read function for CP-1252.
 */
guac_iconv_read GUAC_READ_CP1252;

/**
 * Read function for ISO-8859-1
 */
guac_iconv_read GUAC_READ_ISO8859_1;

/**
 * Read function for UTF-8 which normalizes newline character sequences like
 * "\r\n" to Unix-style newlines ('\n').
 */
guac_iconv_read GUAC_READ_UTF8_NORMALIZED;

/**
 * Read function for UTF-16 which normalizes newline character sequences like
 * "\r\n" to Unix-style newlines ('\n').
 */
guac_iconv_read GUAC_READ_UTF16_NORMALIZED;

/**
 * Read function for CP-1252 which normalizes newline character sequences like
 * "\r\n" to Unix-style newlines ('\n').
 */
guac_iconv_read GUAC_READ_CP1252_NORMALIZED;

/**
 * Read function for ISO 8859-1 which normalizes newline character sequences
 * like "\r\n" to Unix-style newlines ('\n').
 */
guac_iconv_read GUAC_READ_ISO8859_1_NORMALIZED;

/**
 * Write function for UTF8.
 */
guac_iconv_write GUAC_WRITE_UTF8;

/**
 * Write function for UTF16.
 */
guac_iconv_write GUAC_WRITE_UTF16;

/**
 * Write function for CP-1252.
 */
guac_iconv_write GUAC_WRITE_CP1252;

/**
 * Write function for ISO-8859-1
 */
guac_iconv_write GUAC_WRITE_ISO8859_1;

/**
 * Write function for UTF-8 which writes newline characters ('\n') as
 * Windows-style newlines ("\r\n").
 */
guac_iconv_write GUAC_WRITE_UTF8_CRLF;

/**
 * Write function for UTF-16 which writes newline characters ('\n') as
 * Windows-style newlines ("\r\n").
 */
guac_iconv_write GUAC_WRITE_UTF16_CRLF;

/**
 * Write function for CP-1252 which writes newline characters ('\n') as
 * Windows-style newlines ("\r\n").
 */
guac_iconv_write GUAC_WRITE_CP1252_CRLF;

/**
 * Write function for ISO 8859-1 which writes newline characters ('\n') as
 * Windows-style newlines ("\r\n").
 */
guac_iconv_write GUAC_WRITE_ISO8859_1_CRLF;

#endif

