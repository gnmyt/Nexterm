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

#ifndef GUACLOG_INSTRUCTIONS_H
#define GUACLOG_INSTRUCTIONS_H

#include "config.h"
#include "state.h"

/**
 * A callback function which, when invoked, handles a particular Guacamole
 * instruction. The opcode of the instruction is implied (as it is expected
 * that there will be a 1:1 mapping of opcode to callback function), while the
 * arguments for that instruction are included in the parameters given to the
 * callback.
 *
 * @param state
 *     The current state of the Guacamole input log interpreter.
 *
 * @param argc
 *     The number of arguments (excluding opcode) passed to the instruction
 *     being handled by the callback.
 *
 * @param argv
 *     All arguments (excluding opcode) associated with the instruction being
 *     handled by the callback.
 *
 * @return
 *     Zero if the instruction was handled successfully, non-zero if an error
 *     occurs.
 */
typedef int guaclog_instruction_handler(guaclog_state* state,
        int argc, char** argv);

/**
 * Mapping of instruction opcode to corresponding handler function.
 */
typedef struct guaclog_instruction_handler_mapping {

    /**
     * The opcode of the instruction that the associated handler function
     * should be invoked for.
     */
    const char* opcode;

    /**
     * The handler function to invoke whenever an instruction having the
     * associated opcode is parsed.
     */
    guaclog_instruction_handler* handler;

} guaclog_instruction_handler_mapping;

/**
 * Array of all opcode/handler mappings for all supported opcodes, terminated
 * by an entry with a NULL opcode. All opcodes not listed here can be safely
 * ignored.
 */
extern guaclog_instruction_handler_mapping guaclog_instruction_handler_map[];

/**
 * Handles the instruction having the given opcode and arguments, updating
 * the state of the interpreter accordingly.
 *
 * @param state
 *     The current state of the Guacamole input log interpreter.
 *
 * @param opcode
 *     The opcode of the instruction being handled.
 *
 * @param argc
 *     The number of arguments (excluding opcode) passed to the instruction
 *     being handled by the callback.
 *
 * @param argv
 *     All arguments (excluding opcode) associated with the instruction being
 *     handled by the callback.
 *
 * @return
 *     Zero if the instruction was handled successfully, non-zero if an error
 *     occurs.
 */
int guaclog_handle_instruction(guaclog_state* state,
        const char* opcode, int argc, char** argv);

/**
 * Handler for the Guacamole "key" instruction.
 */
guaclog_instruction_handler guaclog_handle_key;

#endif

