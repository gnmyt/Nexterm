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

#ifndef GUAC_TERMINAL_BUFFER_H
#define GUAC_TERMINAL_BUFFER_H

/**
 * Data structures and functions related to the terminal buffer. The terminal
 * buffer represents both the scrollback region and the current active contents
 * of the terminal.
 *
 * NOTE: By design, all functions defined within this header make no
 * assumptions about the validity of received coordinates, offsets, and
 * lengths. Depending on the function, invalid values will be clamped, ignored,
 * or reported as invalid.
 *
 * @file buffer.h
 */

#include "types.h"

/**
 * A buffer containing a constant number of arbitrary-length rows.
 * New rows can be appended to the buffer, with the oldest row replaced with
 * the new row.
 */
typedef struct guac_terminal_buffer guac_terminal_buffer;

/**
 * Allocates a new buffer having the given maximum number of rows. New character cells will
 * be initialized to the given character.
 */
guac_terminal_buffer* guac_terminal_buffer_alloc(int rows,
        const guac_terminal_char* default_character);

/**
 * Frees the given buffer.
 */
void guac_terminal_buffer_free(guac_terminal_buffer* buffer);

/**
 * Resets the state of the given buffer such that it effectively no longer
 * contains any rows. Space for previous rows, including the data from those
 * previous rows, may still be maintained internally to avoid needing to
 * reallocate rows again later.
 *
 * @param buffer
 *     The buffer to reset.
 */
void guac_terminal_buffer_reset(guac_terminal_buffer* buffer);

/**
 * Copies the given range of columns to a new location, offset from
 * the original by the given number of columns.
 */
void guac_terminal_buffer_copy_columns(guac_terminal_buffer* buffer, int row,
        int start_column, int end_column, int offset);

/**
 * Copies the given range of rows to a new location, offset from the
 * original by the given number of rows.
 */
void guac_terminal_buffer_copy_rows(guac_terminal_buffer* buffer,
        int start_row, int end_row, int offset);

/**
 * Scrolls the contents of the given buffer up by the given number of rows.
 * Here, "scrolling up" refers to moving the row contents upwards within the
 * buffer (ie: decreasing the row index of each row), NOT to moving the
 * viewport up.
 *
 * @param buffer
 *     The buffer to scroll.
 *
 * @param amount
 *     The number of rows to scroll upwards. Zero and negative values have no
 *     effect.
 */
void guac_terminal_buffer_scroll_up(guac_terminal_buffer* buffer, int amount);

/**
 * Scrolls the contents of the given buffer down by the given number of rows.
 * Here, "scrolling down" refers to moving the row contents downwards within
 * the buffer (ie: increasing the row index of each row), NOT to moving the
 * viewport down.
 *
 * @param buffer
 *     The buffer to scroll.
 *
 * @param amount
 *     The number of rows to scroll downwards. Zero and negative values have no
 *     effect.
 */
void guac_terminal_buffer_scroll_down(guac_terminal_buffer* buffer, int amount);

/**
 * Sets the given range of columns within the given row to the given
 * character.
 */
void guac_terminal_buffer_set_columns(guac_terminal_buffer* buffer, int row,
        int start_column, int end_column, guac_terminal_char* character);

/**
 * Get the char (int ASCII code) at a specific row/col of the display.
 *
 * @param terminal
 *     The terminal on which we want to read a character.
 *
 * @param row
 *     The row where to read the character.
 * 
 * @param col
 *     The column where to read the character.
 * 
 * @return
 *     The ASCII code of the character at the given row/col.
 */
unsigned int guac_terminal_buffer_get_columns(guac_terminal_buffer* buffer,
        guac_terminal_char** characters, bool* is_wrapped, int row);

/**
 * Returns the number of rows actually available for rendering within the given
 * buffer, taking the scrollback size into account. Regardless of the true
 * buffer length, only the number of rows that should be made available will be
 * returned.
 *
 * @param buffer
 *     The buffer whose effective length should be retrieved.
 *
 * @param scrollback
 *     The number of rows currently within the terminal's scrollback buffer.
 *
 * @return
 *     The number of rows effectively available within the buffer.
 */
unsigned int guac_terminal_buffer_effective_length(guac_terminal_buffer* buffer, int scrollback);

/**
 * Sets whether the given buffer row was automatically wrapped by the terminal.
 * Rows that were not automatically wrapped are lines of text that were printed
 * and included an explicit newline character.
 *
 * @param buffer
 *     The buffer associated with the row being modified.
 *
 * @param row
 *     The row whose wrapped vs. not-wrapped state is being set.
 *
 * @param wrapped
 *     Whether the row was automatically wrapped (as opposed to simply ending
 *     with a newline character).
 */
void guac_terminal_buffer_set_wrapped(guac_terminal_buffer* buffer, int row, bool wrapped);

/**
 * Sets whether the character at the given row and column contains the cursor.
 *
 * @param buffer
 *     The buffer associated with character to modify.
 *
 * @param row
 *     The row of the character to modify.
 *
 * @param column
 *     The column of the character to modify.
 *
 * @param is_cursor
 *     Whether the character contains the cursor.
 */
void guac_terminal_buffer_set_cursor(guac_terminal_buffer* buffer, int row,
        int column, bool is_cursor);

#endif

