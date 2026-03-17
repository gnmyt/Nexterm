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

#ifndef GUACENC_PARSE_H
#define GUACENC_PARSE_H

#include "config.h"

#include <guacamole/timestamp.h>

/**
 * Parses a string into a single integer. Only positive integers are accepted.
 * The input string may be modified during parsing. A value will be stored in
 * the provided int pointer only if valid.
 *
 * @param arg
 *     The string to parse.
 *
 * @param i
 *     A pointer to the integer in which the parsed value of the given string
 *     should be stored.
 *
 * @return
 *     Zero if parsing was successful, non-zero if the provided string was
 *     invalid.
 */
int guacenc_parse_int(char* arg, int* i);

/**
 * Parses a string of the form WIDTHxHEIGHT into individual width and height
 * integers. The input string may be modified during parsing. Values will be
 * stored in the provided width and height pointers only if the given
 * dimensions are valid.
 *
 * @param arg
 *     The string to parse.
 *
 * @param width
 *     A pointer to the integer in which the parsed width component of the
 *     given string should be stored.
 *
 * @param height
 *     A pointer to the integer in which the parsed height component of the
 *     given string should be stored.
 *
 * @return
 *     Zero if parsing was successful, non-zero if the provided string was
 *     invalid.
 */
int guacenc_parse_dimensions(char* arg, int* width, int* height);

/**
 * Parses a guac_timestamp from the given string. The string is assumed to
 * consist solely of decimal digits with an optional leading minus sign. If the
 * given string contains other characters, the behavior of this function is
 * undefined.
 *
 * @param str
 *     The string to parse, which must contain only decimal digits and an
 *     optional leading minus sign.
 *
 * @return
 *     A guac_timestamp having the same value as the provided string.
 */
guac_timestamp guacenc_parse_timestamp(const char* str);

#endif

