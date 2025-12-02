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

#ifndef _GUAC_USER_HANDLERS__H
#define _GUAC_USER_HANDLERS__H

/**
 * Provides initial handler functions and a lookup structure for automatically
 * handling instructions received from each user. This is used only internally
 * within libguac, and is not installed along with the library.
 *
 * @file user-handlers.h
 */

#include "config.h"

#include "guacamole/client.h"
#include "guacamole/timestamp.h"

/**
 * Internal handler for Guacamole instructions. Instruction handlers will be
 * invoked when their corresponding instructions are received. The mapping
 * of instruction opcode to handler is defined by the
 * __guac_instruction_handler_map array.
 *
 * @param user
 *     The user that sent the instruction.
 *
 * @param argc
 *     The number of arguments in argv.
 *
 * @param argv
 *     The arguments included with the instruction, excluding the opcode.
 *
 * @return
 *     Zero if the instruction was successfully handled, non-zero otherwise.
 */
typedef int __guac_instruction_handler(guac_user* user, int argc, char** argv);

/**
 * Structure mapping an instruction opcode to an instruction handler.
 */
typedef struct __guac_instruction_handler_mapping {

    /**
     * The instruction opcode which maps to a specific handler.
     */
    char* opcode;

    /**
     * The handler which maps to a specific opcode.
     */
    __guac_instruction_handler* handler;

} __guac_instruction_handler_mapping;

/**
 * Internal initial handler for the sync instruction. When a sync instruction
 * is received, this handler will be called. Sync instructions are automatically
 * handled, thus there is no client handler for sync instruction.
 */
__guac_instruction_handler __guac_handle_sync;

/**
 * Internal initial handler for the mouse instruction. When a mouse instruction
 * is received, this handler will be called. The client's mouse handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_mouse;

/**
 * Internal initial handler for the touch instruction. When a touch instruction
 * is received, this handler will be called. The client's touch handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_touch;

/**
 * Internal initial handler for the key instruction. When a key instruction
 * is received, this handler will be called. The client's key handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_key;

/**
 * Internal initial handler for the audio instruction. When a audio
 * instruction is received, this handler will be called. The client's audio
 * handler will be invoked if defined.
 */
__guac_instruction_handler __guac_handle_audio;

/**
 * Internal initial handler for the clipboard instruction. When a clipboard
 * instruction is received, this handler will be called. The client's clipboard
 * handler will be invoked if defined.
 */
__guac_instruction_handler __guac_handle_clipboard;

/**
 * Internal initial handler for the file instruction. When a file instruction
 * is received, this handler will be called. The client's file handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_file;

/**
 * Internal initial handler for the pipe instruction. When a pipe instruction
 * is received, this handler will be called. The client's pipe handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_pipe;

/**
 * Internal initial handler for the argv instruction. When a argv instruction
 * is received, this handler will be called. The client's argv handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_argv;

/**
 * Internal initial handler for the ack instruction. When a ack instruction
 * is received, this handler will be called. The client's ack handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_ack;

/**
 * Internal initial handler for the blob instruction. When a blob instruction
 * is received, this handler will be called. The client's blob handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_blob;

/**
 * Internal initial handler for the end instruction. When a end instruction
 * is received, this handler will be called. The client's end handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_end;

/**
 * Internal initial handler for the get instruction. When a get instruction
 * is received, this handler will be called. The client's get handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_get;

/**
 * Internal initial handler for the put instruction. When a put instruction
 * is received, this handler will be called. The client's put handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_put;

/**
 * Internal initial handler for the size instruction. When a size instruction
 * is received, this handler will be called. The client's size handler will
 * be invoked if defined.
 */
__guac_instruction_handler __guac_handle_size;

/**
 * Internal initial handler for the disconnect instruction. When a disconnect
 * instruction is received, this handler will be called. Disconnect
 * instructions are automatically handled, thus there is no client handler for
 * disconnect instruction.
 */
__guac_instruction_handler __guac_handle_disconnect;

/**
 * Internal handler for the nop instruction.  This handler will be called when
 * the nop instruction is received, and will do nothing more than a TRACE level
 * log of the instruction.
 */
__guac_instruction_handler __guac_handle_nop;

/**
 * Internal handler function that is called when the size instruction is
 * received during the handshake process.
 */
__guac_instruction_handler __guac_handshake_size_handler;

/**
 * Internal handler function that is called when the audio instruction is
 * received during the handshake process, specifying the audio mimetypes
 * available to the client.
 */
__guac_instruction_handler __guac_handshake_audio_handler;

/**
 * Internal handler function that is called when the video instruction is
 * received during the handshake process, specifying the video mimetypes
 * available to the client.
 */
__guac_instruction_handler __guac_handshake_video_handler;

/**
 * Internal handler function that is called when the image instruction is
 * received during the handshake process, specifying the image mimetypes
 * available to the client.
 */
__guac_instruction_handler __guac_handshake_image_handler;

/**
 * Internal handler function that is called when the name instruction is
 * received during the handshake process, specifying the name of the Guacamole
 * user establishing the connection.
 */
__guac_instruction_handler __guac_handshake_name_handler;

/**
 * Internal handler function that is called when the timezone instruction is
 * received during the handshake process, specifying the timezone of the
 * client.
 */
__guac_instruction_handler __guac_handshake_timezone_handler;

/**
 * Instruction handler mapping table. This is a NULL-terminated array of
 * __guac_instruction_handler_mapping structures, each mapping an opcode
 * to a __guac_instruction_handler. The end of the array must be marked
 * with a __guac_instruction_handler_mapping with the opcode set to
 * NULL (the NULL terminator).
 */
extern __guac_instruction_handler_mapping __guac_instruction_handler_map[];

/**
 * Handler mapping table for instructions (opcodes) specifically for the
 * handshake portion of the connection.  Each
 * __guac_instruction_handler_mapping structure within this NULL-terminated
 * array maps an opcode to a __guac_instruction_handler.  The end of the array
 * must be marked with a mapping with the opcode set to NULL.
 */
extern __guac_instruction_handler_mapping __guac_handshake_handler_map[];

/**
 * Frees the given array of mimetypes, including the space allocated to each
 * mimetype string within the array. The provided array of mimetypes MUST have
 * been allocated with guac_copy_mimetypes().
 *
 * @param mimetypes
 *     The NULL-terminated array of mimetypes to free. This array MUST have
 *     been previously allocated with guac_copy_mimetypes().
 */
void guac_free_mimetypes(char** mimetypes);

/**
 * Copies the given array of mimetypes (strings) into a newly-allocated NULL-
 * terminated array of strings. Both the array and the strings within the array
 * are newly-allocated and must be later freed via guac_free_mimetypes().
 *
 * @param mimetypes
 *     The array of mimetypes to copy.
 *
 * @param count
 *     The number of mimetypes in the given array.
 *
 * @return
 *     A newly-allocated, NULL-terminated array containing newly-allocated
 *     copies of each of the mimetypes provided in the original mimetypes
 *     array.
 */
char** guac_copy_mimetypes(char** mimetypes, int count);

/**
 * Call the appropriate handler defined by the given user for the given
 * instruction. A comparison is made between the instruction opcode and the
 * initial handler lookup table defined in the map that is provided to this
 * function. If an entry for the instruction is found in the provided map,
 * the handler defined in that map will be called and the value returned.  If
 * no match is found, it is silently ignored.
 *
 * @param map
 *     The array that holds the opcode to handler mappings.
 * 
 * @param user
 *     The user whose handlers should be called.
 *
 * @param opcode
 *     The opcode of the instruction to pass to the user via the appropriate
 *     handler.
 *
 * @param argc
 *     The number of arguments which are part of the instruction.
 *
 * @param argv
 *     An array of all arguments which are part of the instruction.
 *
 * @return
 *     Zero if the instruction was handled successfully, or non-zero otherwise.
 */
int __guac_user_call_opcode_handler(__guac_instruction_handler_mapping* map,
        guac_user* user, const char* opcode, int argc, char** argv);

#endif
