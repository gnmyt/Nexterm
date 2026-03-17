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

#ifndef _GUAC_PARSER_H
#define _GUAC_PARSER_H

/**
 * Provides functions and structures for parsing the Guacamole protocol.
 *
 * @file parser.h
 */

#include "parser-types.h"
#include "parser-constants.h"
#include "socket-types.h"

struct guac_parser {

    /**
     * The opcode of the instruction.
     */
    char* opcode;

    /**
     * The number of arguments passed to this instruction.
     */
    int argc;

    /**
     * Array of all arguments passed to this instruction.
     */
    char** argv;

    /**
     * The parse state of the instruction.
     */
    guac_parse_state state;

    /**
     * The length of the current element, if known.
     */
    int __element_length;

    /**
     * The number of elements currently parsed.
     */
    int __elementc;

    /**
     * All currently parsed elements.
     */
    char* __elementv[GUAC_INSTRUCTION_MAX_ELEMENTS];

    /**
     * Pointer to the first character of the current in-progress instruction
     * within the buffer.
     */
    char* __instructionbuf_unparsed_start;

    /**
     * Pointer to the first unused section of the instruction buffer.
     */
    char* __instructionbuf_unparsed_end;

    /**
     * The instruction buffer. This is essentially the input buffer,
     * provided as a convenience to be used to buffer instructions until
     * those instructions are complete and ready to be parsed.
     */
    char __instructionbuf[32768];

};

/**
 * Allocates a new parser.
 *
 * @return The newly allocated parser, or NULL if an error occurs during
 *         allocation, in which case guac_error will be set appropriately.
 */
guac_parser* guac_parser_alloc();

/**
 * Appends data from the given buffer to the given parser. The data will be
 * appended, if possible, to the in-progress instruction as a reference and
 * thus the buffer must remain valid throughout the life of the current
 * instruction. This function may modify the contents of the buffer when those
 * contents are part of an element within the instruction being read.
 *
 * @param parser The parser to append data to.
 * @param buffer A buffer containing data that should be appended to this
 *               parser.
 * @param length The number of bytes available for appending within the buffer.
 * @return The number of bytes appended to this parser, which may be
 *         zero if more data is needed.
 */
int guac_parser_append(guac_parser* parser, void* buffer, int length);

/**
 * Returns the number of unparsed bytes stored in the given parser's internal
 * buffers.
 *
 * @param parser The parser to return the length of.
 * @return The number of unparsed bytes stored in the given parser.
 */
int guac_parser_length(guac_parser* parser);

/**
 * Removes up to length bytes from internal buffer of unparsed bytes, storing
 * them in the given buffer.
 *
 * @param parser The parser to remove unparsed bytes from.
 * @param buffer The buffer to store the unparsed bytes within.
 * @param length The length of the given buffer.
 * @return The number of bytes stored in the given buffer.
 */
int guac_parser_shift(guac_parser* parser, void* buffer, int length);

/**
 * Frees all memory allocated to the given parser.
 *
 * @param parser The parser to free.
 */
void guac_parser_free(guac_parser* parser);

/**
 * Reads a single instruction from the given guac_socket connection. This
 * may result in additional data being read from the guac_socket, stored
 * internally within a buffer for future parsing. Future calls to
 * guac_parser_read() will read from the internal buffer before reading
 * from the guac_socket. Data from the internal buffer can be removed
 * and used elsewhere through guac_parser_shift().
 *
 * If an error occurs reading the instruction, non-zero is returned,
 * and guac_error is set appropriately.
 *
 * @param parser The guac_parser to read instruction data from.
 * @param socket The guac_socket connection to use.
 * @param usec_timeout The maximum number of microseconds to wait before
 *                     giving up.
 * @return Zero if an instruction was read within the time allowed, or
 *         non-zero if no instruction could be read. If the instruction
 *         could not be read completely because the timeout elapsed, in
 *         which case guac_error will be set to GUAC_STATUS_INPUT_TIMEOUT
 *         and additional calls to guac_parser_read() will be required.
 */
int guac_parser_read(guac_parser* parser, guac_socket* socket, int usec_timeout);

/**
 * Reads a single instruction from the given guac_socket. This operates
 * identically to guac_parser_read(), except that an error is returned if
 * the expected opcode is not received.
 *
 * If an error occurs reading the instruction, NULL is returned,
 * and guac_error is set appropriately.
 *
 * If the instruction read is not the expected instruction, NULL is returned,
 * and guac_error is set to GUAC_STATUS_BAD_STATE.
 *
 * @param parser The guac_parser to read instruction data from.
 * @param socket The guac_socket connection to use.
 * @param usec_timeout The maximum number of microseconds to wait before
 *                     giving up.
 * @param opcode The opcode of the instruction to read.
 * @return Zero if an instruction with the given opcode was read, non-zero
 *         otherwise. If an instruction was read, but the instruction had a
 *         different opcode, non-zero is returned and guac_error is set to
 *         GUAC_STATUS_BAD_STATE.
 */
int guac_parser_expect(guac_parser* parser, guac_socket* socket, int usec_timeout, const char* opcode);

#endif

