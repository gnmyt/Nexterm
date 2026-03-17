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

#ifndef GUAC_SSH_TTYMODE_H
#define GUAC_SSH_TTYMODE_H

#include "config.h"

#include <stdint.h>

/**
 * The size of a TTY mode encoding opcode and
 * value pair.  As defined in the SSH RFC, this
 * is 5 bytes - a single byte for the opcode, and
 * 4 bytes for the value.
 */
#define GUAC_SSH_TTY_OPCODE_SIZE 5

/**
 * The SSH TTY mode encoding opcode that terminates
 * the list of TTY modes.
 */
#define GUAC_SSH_TTY_OP_END 0

/**
 * The SSH TTY mode encoding opcode that configures
 * the TTY erase code to configure the server
 * backspace key.
 */
#define GUAC_SSH_TTY_OP_VERASE 3

/**
 * Macro for calculating the number of bytes required
 * to pass a given number of opcodes, which calculates
 * the size of the number of opcodes plus the single byte
 * end opcode.
 *
 * @param num_opcodes
 *     The number of opcodes for which a size in bytes
 *     should be calculated.
 *
 * @returns
 *     The number of bytes that the given number of
 *     opcodes will require.
 */
#define GUAC_SSH_TTYMODES_SIZE(num_opcodes) ((GUAC_SSH_TTY_OPCODE_SIZE * num_opcodes) + 1)

/**
 * Opcodes and value pairs are passed to the SSH connection
 * in a single array, beginning with the opcode and followed
 * by a four byte value, repeating until the end opcode is
 * encountered.  This function takes the array that will be
 * sent and a variable number of opcode and value pair
 * arguments and places the opcode and values in the array
 * as expected by the SSH connection.
 *
 * @param opcode_array
 *     Pointer to the opcode array that will ultimately
 *     be passed to the SSH connection.  The array must
 *     be size to handle 5 bytes for each opcode and value
 *     pair, plus one additional byte for the end opcode.
 *
 * @params ...
 *     A variable number of opcode and value pairs
 *     to place in the array.
 *
 * @return
 *     Number of bytes written to the array, or zero
 *     if a failure occurs.
 */
int guac_ssh_ttymodes_init(char opcode_array[], ...);

#endif
