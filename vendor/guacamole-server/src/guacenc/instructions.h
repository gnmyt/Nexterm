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

#ifndef GUACENC_INSTRUCTIONS_H
#define GUACENC_INSTRUCTIONS_H

#include "config.h"
#include "display.h"

/**
 * A callback function which, when invoked, handles a particular Guacamole
 * instruction. The opcode of the instruction is implied (as it is expected
 * that there will be a 1:1 mapping of opcode to callback function), while the
 * arguments for that instruction are included in the parameters given to the
 * callback.
 *
 * @param display
 *     The current internal display of the Guacamole video encoder.
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
typedef int guacenc_instruction_handler(guacenc_display* display,
        int argc, char** argv);

/**
 * Mapping of instruction opcode to corresponding handler function.
 */
typedef struct guacenc_instruction_handler_mapping {

    /**
     * The opcode of the instruction that the associated handler function
     * should be invoked for.
     */
    const char* opcode;

    /**
     * The handler function to invoke whenever an instruction having the
     * associated opcode is parsed.
     */
    guacenc_instruction_handler* handler;

} guacenc_instruction_handler_mapping;

/**
 * Array of all opcode/handler mappings for all supported opcodes, terminated
 * by an entry with a NULL opcode. All opcodes not listed here can be safely
 * ignored.
 */
extern guacenc_instruction_handler_mapping guacenc_instruction_handler_map[];

/**
 * Handles the instruction having the given opcode and arguments, encoding the
 * result to the in-progress video.
 *
 * @param display
 *     The current internal display of the Guacamole video encoder.
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
int guacenc_handle_instruction(guacenc_display* display,
        const char* opcode, int argc, char** argv);

/**
 * Handler for the Guacamole "blob" instruction.
 */
guacenc_instruction_handler guacenc_handle_blob;

/**
 * Handler for the Guacamole "img" instruction.
 */
guacenc_instruction_handler guacenc_handle_img;

/**
 * Handler for the Guacamole "end" instruction.
 */
guacenc_instruction_handler guacenc_handle_end;

/**
 * Handler for the Guacamole "mouse" instruction.
 */
guacenc_instruction_handler guacenc_handle_mouse;

/**
 * Handler for the Guacamole "sync" instruction.
 */
guacenc_instruction_handler guacenc_handle_sync;

/**
 * Handler for the Guacamole "cursor" instruction.
 */
guacenc_instruction_handler guacenc_handle_cursor;

/**
 * Handler for the Guacamole "copy" instruction.
 */
guacenc_instruction_handler guacenc_handle_copy;

/**
 * Handler for the Guacamole "transfer" instruction.
 */
guacenc_instruction_handler guacenc_handle_transfer;

/**
 * Handler for the Guacamole "size" instruction.
 */
guacenc_instruction_handler guacenc_handle_size;

/**
 * Handler for the Guacamole "rect" instruction.
 */
guacenc_instruction_handler guacenc_handle_rect;

/**
 * Handler for the Guacamole "cfill" instruction.
 */
guacenc_instruction_handler guacenc_handle_cfill;

/**
 * Handler for the Guacamole "move" instruction.
 */
guacenc_instruction_handler guacenc_handle_move;

/**
 * Handler for the Guacamole "shade" instruction.
 */
guacenc_instruction_handler guacenc_handle_shade;

/**
 * Handler for the Guacamole "dispose" instruction.
 */
guacenc_instruction_handler guacenc_handle_dispose;

#endif

