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

#ifndef _GUAC_TERMINAL_CHAR_MAPPINGS_H
#define _GUAC_TERMINAL_CHAR_MAPPINGS_H

/**
 * Graphics character mapping definitions.
 *
 * @file char-mappings.h
 */

/**
 * VT100 graphics mapping. Each entry is the corresponding Unicode codepoint
 * for the character N+32, where N is the index of the element in the array.
 * All characters less than 32 are universally mapped to themselves.
 */
extern const int vt100_map[];

/**
 * Null graphics mapping. Each entry is the corresponding Unicode codepoint
 * for the character N+32, where N is the index of the element in the array.
 * All characters less than 32 are universally mapped to themselves.
 */
extern const int null_map[];

/**
 * User graphics mapping. Each entry is the corresponding Unicode codepoint
 * for the character N+32, where N is the index of the element in the array.
 * All characters less than 32 are universally mapped to themselves.
 */
extern const int user_map[];

#endif

