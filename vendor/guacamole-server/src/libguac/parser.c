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

#include "config.h"

#include "guacamole/mem.h"
#include "guacamole/error.h"
#include "guacamole/parser.h"
#include "guacamole/socket.h"
#include "guacamole/unicode.h"

#include <stdlib.h>
#include <stdio.h>
#include <string.h>

static void guac_parser_reset(guac_parser* parser) {
    parser->opcode = NULL;
    parser->argc = 0;
    parser->state = GUAC_PARSE_LENGTH;
    parser->__elementc = 0;
    parser->__element_length = 0;
}

guac_parser* guac_parser_alloc() {

    /* Allocate space for parser */
    guac_parser* parser = guac_mem_alloc(sizeof(guac_parser));
    if (parser == NULL) {
        guac_error = GUAC_STATUS_NO_MEMORY;
        guac_error_message = "Insufficient memory to allocate parser";
        return NULL;
    }

    /* Init parse start/end markers */
    parser->__instructionbuf_unparsed_start = parser->__instructionbuf;
    parser->__instructionbuf_unparsed_end = parser->__instructionbuf;

    guac_parser_reset(parser);
    return parser;

}

int guac_parser_append(guac_parser* parser, void* buffer, int length) {

    char* char_buffer = (char*) buffer;
    int bytes_parsed = 0;

    /* Do not exceed maximum number of elements */
    if (parser->__elementc == GUAC_INSTRUCTION_MAX_ELEMENTS
            && parser->state != GUAC_PARSE_COMPLETE) {
        parser->state = GUAC_PARSE_ERROR;
        return 0;
    }

    /* Parse element length */
    if (parser->state == GUAC_PARSE_LENGTH) {

        int parsed_length = parser->__element_length;
        while (bytes_parsed < length) {

            /* Pull next character */
            char c = *(char_buffer++);
            bytes_parsed++;

            /* If digit, add to length */
            if (c >= '0' && c <= '9')
                parsed_length = parsed_length*10 + c - '0';

            /* If period, switch to parsing content */
            else if (c == '.') {
                parser->__elementv[parser->__elementc++] = char_buffer;
                parser->state = GUAC_PARSE_CONTENT;
                break;
            }

            /* If not digit, parse error */
            else {
                parser->state = GUAC_PARSE_ERROR;
                return 0;
            }

        }

        /* If too long, parse error */
        if (parsed_length > GUAC_INSTRUCTION_MAX_LENGTH) {
            parser->state = GUAC_PARSE_ERROR;
            return 0;
        }

        /* Save length */
        parser->__element_length = parsed_length;

    } /* end parse length */

    /* Parse element content */
    if (parser->state == GUAC_PARSE_CONTENT) {

        while (bytes_parsed < length && parser->__element_length >= 0) {

            /* Get length of current character */
            char c = *char_buffer;
            int char_length = guac_utf8_charsize((unsigned char) c);

            /* If full character not present in buffer, stop now */
            if (char_length + bytes_parsed > length)
                break;

            /* Record character as parsed */
            bytes_parsed += char_length;

            /* If end of element, handle terminator */
            if (parser->__element_length == 0) {

                *char_buffer = '\0';

                /* If semicolon, store end-of-instruction */
                if (c == ';') {
                    parser->state = GUAC_PARSE_COMPLETE;
                    parser->opcode = parser->__elementv[0];
                    parser->argv = &(parser->__elementv[1]);
                    parser->argc = parser->__elementc - 1;
                    break;
                }

                /* If comma, move on to next element */
                else if (c == ',') {
                    parser->state = GUAC_PARSE_LENGTH;
                    break;
                }

                /* Otherwise, parse error */
                else {
                    parser->state = GUAC_PARSE_ERROR;
                    return 0;
                }

            } /* end if end of element */

            /* Advance to next character */
            parser->__element_length--;
            char_buffer += char_length;

        }

    } /* end parse content */

    return bytes_parsed;

}

int guac_parser_read(guac_parser* parser, guac_socket* socket, int usec_timeout) {

    char* unparsed_end   = parser->__instructionbuf_unparsed_end;
    char* unparsed_start = parser->__instructionbuf_unparsed_start;
    char* instr_start    = parser->__instructionbuf_unparsed_start;
    char* buffer_end     = parser->__instructionbuf + sizeof(parser->__instructionbuf);

    /* Begin next instruction if previous was ended */
    if (parser->state == GUAC_PARSE_COMPLETE)
        guac_parser_reset(parser);

    while (parser->state != GUAC_PARSE_COMPLETE
        && parser->state != GUAC_PARSE_ERROR) {

        /* Add any available data to buffer */
        int parsed = guac_parser_append(parser, unparsed_start, unparsed_end - unparsed_start);

        /* Read more data if not enough data to parse */
        if (parsed == 0 && parser->state != GUAC_PARSE_ERROR) {

            int retval;

            /* If no space left to read, fail */
            if (unparsed_end == buffer_end) {

                /* Shift backward if possible */
                if (instr_start != parser->__instructionbuf) {

                    int i;

                    /* Shift buffer */
                    int offset = instr_start - parser->__instructionbuf;
                    memmove(parser->__instructionbuf, instr_start,
                            unparsed_end - instr_start);

                    /* Update tracking pointers */
                    unparsed_end -= offset;
                    unparsed_start -= offset;
                    instr_start = parser->__instructionbuf;

                    /* Update parsed elements, if any */
                    for (i=0; i < parser->__elementc; i++)
                        parser->__elementv[i] -= offset;

                }

                /* Otherwise, no memory to read */
                else {
                    guac_error = GUAC_STATUS_NO_MEMORY;
                    guac_error_message = "Instruction too long";
                    return -1;
                }

            }

            /* No instruction yet? Get more data ... */
            retval = guac_socket_select(socket, usec_timeout);
            if (retval <= 0)
                return -1;
           
            /* Attempt to fill buffer */
            retval = guac_socket_read(socket, unparsed_end,
                    buffer_end - unparsed_end);

            /* Set guac_error if read unsuccessful */
            if (retval < 0) {
                guac_error = GUAC_STATUS_SEE_ERRNO;
                guac_error_message = "Error filling instruction buffer";
                return -1;
            }

            /* EOF */
            if (retval == 0) {
                guac_error = GUAC_STATUS_CLOSED;
                guac_error_message = "End of stream reached while "
                                     "reading instruction";
                return -1;
            }

            /* Update internal buffer */
            unparsed_end += retval;

        }

        /* If data was parsed, advance buffer */
        else
            unparsed_start += parsed;

    } /* end while parsing data */

    /* Fail on error */
    if (parser->state == GUAC_PARSE_ERROR) {
        guac_error = GUAC_STATUS_PROTOCOL_ERROR;
        guac_error_message = "Instruction parse error";
        return -1;
    }

    parser->__instructionbuf_unparsed_start = unparsed_start;
    parser->__instructionbuf_unparsed_end = unparsed_end;
    return 0;

}

int guac_parser_expect(guac_parser* parser, guac_socket* socket, int usec_timeout, const char* opcode) {

    /* Read next instruction */
    if (guac_parser_read(parser, socket, usec_timeout) != 0)
        return -1;

    /* Validate instruction */
    if (strcmp(parser->opcode, opcode) != 0) {
        guac_error = GUAC_STATUS_PROTOCOL_ERROR;
        guac_error_message = "Instruction read did not have expected opcode";
        return -1;
    }

    /* Return non-zero only if valid instruction read */
    return parser->state != GUAC_PARSE_COMPLETE;

}

int guac_parser_length(guac_parser* parser) {

    char* unparsed_end   = parser->__instructionbuf_unparsed_end;
    char* unparsed_start = parser->__instructionbuf_unparsed_start;

    return unparsed_end - unparsed_start;

}

int guac_parser_shift(guac_parser* parser, void* buffer, int length) {

    char* copy_end   = parser->__instructionbuf_unparsed_end;
    char* copy_start = parser->__instructionbuf_unparsed_start;

    /* Contain copy region within length */
    if (copy_end - copy_start > length)
        copy_end = copy_start + length;

    /* Copy buffer */
    length = copy_end - copy_start;
    memcpy(buffer, copy_start, length);

    parser->__instructionbuf_unparsed_start = copy_end;

    return length;

}

void guac_parser_free(guac_parser* parser) {
    guac_mem_free(parser);
}

