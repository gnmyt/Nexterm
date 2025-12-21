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

#include "terminal/buffer.h"
#include "terminal/common.h"
#include "terminal/terminal.h"

#include <guacamole/assert.h>
#include <guacamole/mem.h>

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

/**
 * The minimum number of columns to allocate for a buffer row, regardless of
 * the terminal size. We set a minimum size here to reduce the memory
 * reallocation overhead for small rows.
 */
#define GUAC_TERMINAL_BUFFER_ROW_MIN_SIZE 256

/**
 * A single variable-length row of terminal data.
 */
typedef struct guac_terminal_buffer_row {

    /**
     * Array of guac_terminal_char representing the contents of the row.
     */
    guac_terminal_char* characters;

    /**
     * The length of this row in characters. This is the number of initialized
     * characters in the buffer, usually equal to the number of characters
     * in the screen width at the time this row was created.
     */
    unsigned int length;

    /**
     * The number of elements in the characters array. After the length
     * equals this value, the array must be resized.
     */
    unsigned int available;

    /**
     * True if the current row has been wrapped to avoid going off the screen.
     * False otherwise.
     */
    bool wrapped_row;

} guac_terminal_buffer_row;

struct guac_terminal_buffer {

    /**
     * The character to assign to newly-allocated cells.
     */
    guac_terminal_char default_character;

    /**
     * Array of buffer rows. This array functions as a ring buffer.
     * When a new row needs to be appended, the top reference is moved down
     * and the old top row is replaced.
     */
    guac_terminal_buffer_row* rows;

    /**
     * The index of the first row in the buffer (the row which represents row 0
     * with respect to the terminal display). This is also the index of the row
     * to replace when insufficient space remains in the buffer to add a new
     * row.
     */
    unsigned int top;

    /**
     * The number of rows currently stored in the buffer.
     */
    unsigned int length;

    /**
     * The number of rows in the buffer. This is the total capacity
     * of the buffer.
     */
    unsigned int available;

};

guac_terminal_buffer* guac_terminal_buffer_alloc(int rows,
        const guac_terminal_char* default_character) {

    /* Allocate scrollback */
    guac_terminal_buffer* buffer =
        guac_mem_alloc(sizeof(guac_terminal_buffer));

    int i;
    guac_terminal_buffer_row* row;

    /* Init scrollback data */
    buffer->default_character = *default_character;
    buffer->available = rows;
    buffer->top = 0;
    buffer->length = 0;
    buffer->rows = guac_mem_alloc(sizeof(guac_terminal_buffer_row), buffer->available);

    /* Init scrollback rows */
    row = buffer->rows;
    for (i=0; i<rows; i++) {

        /* Allocate row  */
        row->available = GUAC_TERMINAL_BUFFER_ROW_MIN_SIZE;
        row->length = 0;
        row->wrapped_row = false;
        row->characters = guac_mem_alloc(sizeof(guac_terminal_char), row->available);

        /* Next row */
        row++;

    }

    return buffer;

}

void guac_terminal_buffer_free(guac_terminal_buffer* buffer) {

    int i;
    guac_terminal_buffer_row* row = buffer->rows;

    /* Free all rows */
    for (i=0; i<buffer->available; i++) {
        guac_mem_free(row->characters);
        row++;
    }

    /* Free actual buffer */
    guac_mem_free(buffer->rows);
    guac_mem_free(buffer);

}

void guac_terminal_buffer_reset(guac_terminal_buffer* buffer) {
    buffer->top = 0;
    buffer->length = 0;
}

/**
 * Returns the row at the given location. The row returned is guaranteed to be at least the given
 * width.
 *
 * @param buffer
 *     The buffer to retrieve a row from.
 *
 * @param row
 *     The index of the row to retrieve, where zero is the top-most row.
 *     Negative indices represent rows in the scrollback buffer, above the
 *     top-most row.
 *
 * @return
 *     The buffer row at the given location, or NULL if there is no such row.
 */
static guac_terminal_buffer_row* guac_terminal_buffer_get_row(guac_terminal_buffer* buffer, int row) {

    if (abs(row) >= buffer->available)
        return NULL;

    /* Normalize row index into a scrollback buffer index */
    unsigned int index = (buffer->top + row) % buffer->available;
    return &(buffer->rows[index]);

}

/**
 * Rounds the given value up to the nearest possible row length. To avoid
 * unnecessary, repeated resizing of rows, each row length is rounded up to the
 * nearest power of two.
 *
 * @param value
 *     The value to round.
 *
 * @return
 *     The power of two that is closest to the given value without exceeding
 *     that value.
 */
static unsigned int guac_terminal_buffer_row_length(int value) {

    GUAC_ASSERT(value >= 0);
    GUAC_ASSERT(value <= GUAC_TERMINAL_MAX_COLUMNS);

    unsigned int rounded = GUAC_TERMINAL_BUFFER_ROW_MIN_SIZE;
    while (rounded < value)
        rounded <<= 1;

    return rounded;

}

/**
 * Expands the amount of space allocated for the given row such that it
 * may contain at least the given number of characters, if possible. If the row
 * cannot be expanded due to buffer size limitations, it will be expanded to
 * the greatest size allowed without exceeding those limits.
 *
 * @param row
 *     The row to expand.
 *
 * @param length
 *     The number of characters that the row must be able to store.
 *
 * @param default_character
 *     The character that should fill any newly-allocated character cells.
 */
static void guac_terminal_buffer_row_expand(guac_terminal_buffer_row* row, int length,
        const guac_terminal_char* default_character) {

    /* Bail out if no resize/init is necessary */
    if (length <= row->length)
        return;

    /* Limit maximum possible row size to the limits of the terminal display */
    if (length > GUAC_TERMINAL_MAX_COLUMNS)
        length = GUAC_TERMINAL_MAX_COLUMNS;

    /* Expand allocated memory if there is otherwise insufficient space to fit
     * the provided length */
    if (length > row->available) {
        row->available = guac_terminal_buffer_row_length(length);
        row->characters = guac_mem_realloc_or_die(row->characters,
                sizeof(guac_terminal_char), row->available);
    }

    /* Initialize new part of row */
    for (int i = row->length; i < row->available; i++)
        row->characters[i] = *default_character;

    row->length = length;

}

/**
 * Enforces a character break at the given edge, ensuring that the left side
 * of the edge is the final column of a character, and the right side of the
 * edge is the initial column of a DIFFERENT character.
 *
 * @param buffer
 *     The buffer containing the character.
 *
 * @param row
 *     The row index of the row containing the character.
 *
 * @param edge
 *     The relative edge number where a break is required. For a character in
 *     column N, that character's left edge is N and the right edge is N+1.
 */
static void guac_terminal_buffer_force_break(guac_terminal_buffer* buffer, int row, int edge) {

    guac_terminal_buffer_row* buffer_row = guac_terminal_buffer_get_row(buffer, row);
    if (buffer_row == NULL)
        return;

    /* Ensure character to left of edge is unbroken */
    if (edge > 0) {

        int end_column = edge - 1;
        int start_column = end_column;

        guac_terminal_char* start_char = &(buffer_row->characters[start_column]);

        /* Determine start column */
        while (start_column > 0 && start_char->value == GUAC_CHAR_CONTINUATION) {
            start_char--;
            start_column--;
        }

        /* Advance to start of broken character if necessary */
        if (start_char->value != GUAC_CHAR_CONTINUATION && start_char->width < end_column - start_column + 1) {
            start_column += start_char->width;
            start_char += start_char->width;
        }

        /* Clear character if broken */
        if (start_char->value == GUAC_CHAR_CONTINUATION || start_char->width != end_column - start_column + 1) {

            guac_terminal_char cleared_char;
            cleared_char.value = ' ';
            cleared_char.attributes = start_char->attributes;
            cleared_char.width = 1;

            guac_terminal_buffer_set_columns(buffer, row, start_column, end_column, &cleared_char);

        }

    }

    /* Ensure character to right of edge is unbroken */
    if (edge >= 0 && edge < buffer_row->length) {

        int start_column = edge;
        int end_column = start_column;

        guac_terminal_char* start_char = &(buffer_row->characters[start_column]);
        guac_terminal_char* end_char = &(buffer_row->characters[end_column]);

        /* Determine end column */
        while (end_column+1 < buffer_row->length && (end_char+1)->value == GUAC_CHAR_CONTINUATION) {
            end_char++;
            end_column++;
        }

        /* Advance to start of broken character if necessary */
        if (start_char->value != GUAC_CHAR_CONTINUATION && start_char->width < end_column - start_column + 1) {
            start_column += start_char->width;
            start_char += start_char->width;
        }

        /* Clear character if broken */
        if (start_char->value == GUAC_CHAR_CONTINUATION || start_char->width != end_column - start_column + 1) {

            guac_terminal_char cleared_char;
            cleared_char.value = ' ';
            cleared_char.attributes = start_char->attributes;
            cleared_char.width = 1;

            guac_terminal_buffer_set_columns(buffer, row, start_column, end_column, &cleared_char);

        }

    }

}

void guac_terminal_buffer_copy_columns(guac_terminal_buffer* buffer, int row,
        int start_column, int end_column, int offset) {

    /* Get row */
    guac_terminal_buffer_row* buffer_row = guac_terminal_buffer_get_row(buffer, row);
    if (buffer_row == NULL)
        return;

    guac_terminal_buffer_row_expand(buffer_row, end_column + offset + 1, &buffer->default_character);
    GUAC_ASSERT(buffer_row->length >= end_column + offset + 1);

    /* Fit relevant extents of operation within bounds (NOTE: Because this
     * operation is relative and represents the destination with an offset,
     * there's no need to recalculate the destination region - the offset
     * simply remains the same) */
    if (offset >= 0) {
        start_column = guac_terminal_fit_to_range(start_column, 0,            buffer_row->length - offset - 1);
        end_column   = guac_terminal_fit_to_range(end_column,   start_column, buffer_row->length - offset - 1);
    }
    else {
        start_column = guac_terminal_fit_to_range(start_column, -offset,      buffer_row->length - 1);
        end_column   = guac_terminal_fit_to_range(end_column,   start_column, buffer_row->length - 1);
    }

    /* Determine source and destination locations */
    guac_terminal_char* src = &(buffer_row->characters[start_column]);
    guac_terminal_char* dst = &(buffer_row->characters[start_column + offset]);

    /* Copy data */
    memmove(dst, src, sizeof(guac_terminal_char) * (end_column - start_column + 1));

    /* Force breaks around destination region */
    guac_terminal_buffer_force_break(buffer, row, start_column + offset);
    guac_terminal_buffer_force_break(buffer, row, end_column + offset + 1);

}

void guac_terminal_buffer_copy_rows(guac_terminal_buffer* buffer,
        int start_row, int end_row, int offset) {

    int i, current_row;
    int step;

    /* If shifting down, copy in reverse */
    if (offset > 0) {
        current_row = end_row;
        step = -1;
    }

    /* Otherwise, copy forwards */
    else {
        current_row = start_row;
        step = 1;
    }

    /* Copy each current_row individually */
    for (i = start_row; i <= end_row; i++) {

        /* Get source and destination rows */
        guac_terminal_buffer_row* src_row = guac_terminal_buffer_get_row(buffer, current_row);
        guac_terminal_buffer_row* dst_row = guac_terminal_buffer_get_row(buffer, current_row + offset);

        if (src_row == NULL || dst_row == NULL)
            continue;

        guac_terminal_buffer_row_expand(dst_row, src_row->length, &buffer->default_character);
        GUAC_ASSERT(dst_row->length >= src_row->length);

        /* Copy data */
        memcpy(dst_row->characters, src_row->characters, guac_mem_ckd_mul_or_die(sizeof(guac_terminal_char), src_row->length));
        dst_row->length = src_row->length;
        dst_row->wrapped_row = src_row->wrapped_row;

        /* Reset src wrapped_row */
        src_row->wrapped_row = false;

        /* Next current_row */
        current_row += step;

    }

}

void guac_terminal_buffer_scroll_up(guac_terminal_buffer* buffer, int amount) {

    if (amount <= 0)
        return;

    buffer->top = (buffer->top + amount) % buffer->available;

    buffer->length += amount;
    if (buffer->length > buffer->available)
        buffer->length = buffer->available;

}

void guac_terminal_buffer_scroll_down(guac_terminal_buffer* buffer, int amount) {

    if (amount <= 0)
        return;

    buffer->top = (buffer->top - amount) % buffer->available;

}

unsigned int guac_terminal_buffer_get_columns(guac_terminal_buffer* buffer,
        guac_terminal_char** characters, bool* is_wrapped, int row) {

    guac_terminal_buffer_row* buffer_row = guac_terminal_buffer_get_row(buffer, row);
    if (buffer_row == NULL)
        return 0;

    if (characters != NULL)
        *characters = buffer_row->characters;

    if (is_wrapped != NULL)
        *is_wrapped = buffer_row->wrapped_row;

    return buffer_row->length;

}

void guac_terminal_buffer_set_columns(guac_terminal_buffer* buffer, int row,
        int start_column, int end_column, guac_terminal_char* character) {

    /* Do nothing if there's nothing to do (glyph is empty) or if nothing
     * sanely can be done (row is impossibly large or glyph has an invalid
     * width) */
    if (character->width <= 0 || row >= GUAC_TERMINAL_MAX_ROWS || row <= -GUAC_TERMINAL_MAX_ROWS)
        return;

    /* Do nothing if there is no such row within the buffer (the given row index
     * does not refer to an actual row, even considering scrollback) */
    guac_terminal_buffer_row* buffer_row = guac_terminal_buffer_get_row(buffer, row);
    if (buffer_row == NULL)
        return;

    /* Build continuation char (for multicolumn characters) */
    guac_terminal_char continuation_char = {
        .value = GUAC_CHAR_CONTINUATION,
        .attributes = character->attributes,
        .width = 0 /* Not applicable for GUAC_CHAR_CONTINUATION */
    };

    start_column = guac_terminal_fit_to_range(start_column, 0, GUAC_TERMINAL_MAX_COLUMNS - 1);
    end_column = guac_terminal_fit_to_range(end_column, 0, GUAC_TERMINAL_MAX_COLUMNS - 1);

    guac_terminal_buffer_row_expand(buffer_row, end_column + 1, &buffer->default_character);
    GUAC_ASSERT(buffer_row->length >= end_column + 1);

    int remaining_continuation_chars = 0;
    for (int i = start_column; i <= end_column; i++) {

        /* Store any required continuation characters */
        if (remaining_continuation_chars > 0) {
            buffer_row->characters[i] = continuation_char;
            remaining_continuation_chars--;
        }
        else {
            buffer_row->characters[i] = *character;
            remaining_continuation_chars = character->width - 1;
        }

    }

    /* Update length depending on row written */
    if (character->value != 0 && row >= buffer->length) 
        buffer->length = row + 1;

    /* Force breaks around destination region */
    guac_terminal_buffer_force_break(buffer, row, start_column);
    guac_terminal_buffer_force_break(buffer, row, end_column + 1);

}

void guac_terminal_buffer_set_cursor(guac_terminal_buffer* buffer, int row,
        int column, bool is_cursor) {

    /* Do if nothing sanely can be done (row is impossibly large) */
    if (row >= GUAC_TERMINAL_MAX_ROWS || row <= -GUAC_TERMINAL_MAX_ROWS)
        return;

    /* Do nothing if there is no such row within the buffer (the given row index
     * does not refer to an actual row, even considering scrollback) */
    guac_terminal_buffer_row* buffer_row = guac_terminal_buffer_get_row(buffer, row);
    if (buffer_row == NULL)
        return;

    column = guac_terminal_fit_to_range(column, 0, GUAC_TERMINAL_MAX_COLUMNS - 1);

    guac_terminal_buffer_row_expand(buffer_row, column + 1, &buffer->default_character);
    GUAC_ASSERT(buffer_row->length >= column + 1);

    buffer_row->characters[column].attributes.cursor = is_cursor;

}

unsigned int guac_terminal_buffer_effective_length(guac_terminal_buffer* buffer, int scrollback) {

    /* If the buffer contains more rows than requested, pretend it only
     * contains the requested number of rows */
    unsigned int effective_length = buffer->length;
    if (effective_length > scrollback)
        effective_length = scrollback;

    return effective_length;

}


void guac_terminal_buffer_set_wrapped(guac_terminal_buffer* buffer, int row, bool wrapped) {

    guac_terminal_buffer_row* buffer_row = guac_terminal_buffer_get_row(buffer, row);
    if (buffer_row == NULL)
        return;

    buffer_row->wrapped_row = wrapped;

}

