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

#ifndef _GUAC_PARSER_CONSTANTS_H
#define _GUAC_PARSER_CONSTANTS_H

/**
 * Constants related to the Guacamole protocol parser.
 *
 * @file parser-constants.h
 */

/**
 * The maximum number of characters per instruction.
 */
#define GUAC_INSTRUCTION_MAX_LENGTH 8192

/**
 * The maximum number of digits to allow per length prefix.
 */
#define GUAC_INSTRUCTION_MAX_DIGITS 5

/**
 * The maximum number of elements per instruction, including the opcode.
 */
#define GUAC_INSTRUCTION_MAX_ELEMENTS 128

#endif

