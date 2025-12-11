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

#ifndef _GUAC_PARSER_TYPES_H
#define _GUAC_PARSER_TYPES_H

/**
 * Type definitions related to parsing the Guacamole protocol.
 *
 * @file parser-types.h
 */

/**
 * All possible states of the instruction parser.
 */
typedef enum guac_parse_state {

    /**
     * The parser is currently waiting for data to complete the length prefix
     * of the current element of the instruction.
     */
    GUAC_PARSE_LENGTH,

    /**
     * The parser has finished reading the length prefix and is currently
     * waiting for data to complete the content of the instruction.
     */
    GUAC_PARSE_CONTENT,

    /**
     * The instruction has been fully parsed.
     */
    GUAC_PARSE_COMPLETE,

    /**
     * The instruction cannot be parsed because of a protocol error.
     */
    GUAC_PARSE_ERROR

} guac_parse_state;

/**
 * A Guacamole protocol parser, which reads individual instructions, filling
 * its own internal structure with the most recently read instruction data.
 */
typedef struct guac_parser guac_parser;

#endif

