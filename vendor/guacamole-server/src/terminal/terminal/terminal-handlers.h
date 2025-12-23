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

#ifndef _GUAC_TERMINAL_HANDLERS
#define _GUAC_TERMINAL_HANDLERS

/**
 * Function definitions for terminal event handlers.
 *
 * @file terminal-handlers.h
 */

#include "config.h"

#include "display.h"
#include "terminal.h"

/**
 * The default mode of the terminal. This character handler simply echoes
 * received characters to the terminal display, entering other terminal modes
 * if control characters are received.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_echo(guac_terminal* term, unsigned char c);

/**
 * Handles any characters which follow an ANSI ESC (0x1B) character.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_escape(guac_terminal* term, unsigned char c);

/**
 * Selects the G0 character mapping from the provided character mapping
 * specifier (such as B, 0, U, or K).
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_g0_charset(guac_terminal* term, unsigned char c);

/**
 * Selects the G1 character mapping from the provided character mapping
 * specifier (such as B, 0, U, or K).
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_g1_charset(guac_terminal* term, unsigned char c);

/**
 * Handles characters within a CSI sequence. CSI sequences are most often
 * introduced with "ESC [".
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_csi(guac_terminal* term, unsigned char c);

/**
 * Parses the remainder of the download initiation OSC specific to the
 * Guacamole terminal emulator. A download will be initiated for the specified
 * file once the OSC sequence is complete.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_download(guac_terminal* term, unsigned char c);

/**
 * Parses the remainder of the set directory OSC specific to the Guacamole
 * terminal emulator. The upload directory will be set to the specified path
 * once the OSC sequence is complete.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_set_directory(guac_terminal* term, unsigned char c);

/**
 * Parses the remainder of the open pipe OSC specific to the
 * Guacamole terminal emulator. Terminal output will be redirected to a new
 * named pipe having the given name once the OSC sequence is complete.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_open_pipe_stream(guac_terminal* term, unsigned char c);

/**
 * Parses the remainder of the close pipe OSC specific to the Guacamole
 * terminal emulator. Terminal output will be redirected back to the terminal
 * display and any open named pipe will be closed once the OSC sequence is
 * complete.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_close_pipe_stream(guac_terminal* term, unsigned char c);

/**
 * Parses the remainder of the OSC sequence specific to the Guacamole terminal
 * emulator which requests that the scrollback buffer size be set to the given
 * number of rows. The desired scrollback buffer size will immediately be set,
 * however the manner in which that size is applied (or whether the size is
 * applied at all) depends on (1) whether the requested size exceeds the
 * maximum size set when the terminal emulator was created and (2) whether the
 * size does not reduce the scrollback below the number of rows required for
 * the current display.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_set_scrollback(guac_terminal* term, unsigned char c);

/**
 * Parses the remainder of an OSC sequence setting the window title. The
 * window title is everything after the window title sequence begins, up to
 * the end of the OSC sequence itself.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_window_title(guac_terminal* term, unsigned char c);

/**
 * Parses the remainder of xterm's OSC sequence for redefining the terminal
 * emulator's palette.
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_xterm_palette(guac_terminal* term, unsigned char c);

/**
 * Handles the remaining characters of an Operating System Code (OSC) sequence,
 * typically initiated with "ESC ]".
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_osc(guac_terminal* term, unsigned char c);

/**
 * Handles terminal control function sequences initiated with "ESC #".
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_ctrl_func(guac_terminal* term, unsigned char c);

/**
 * Handles terminal control function sequences initiated with "ESC _".
 *
 * @param term
 *     The terminal that received the given character of data.
 *
 * @param c
 *     The character that was received by the given terminal.
 */
int guac_terminal_apc(guac_terminal* term, unsigned char c);

#endif

