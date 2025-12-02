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

#ifndef GUAC_TERMINAL_SELECT_H
#define GUAC_TERMINAL_SELECT_H

/**
 * Function definitions related to selecting text withing a terminal.
 *
 * @file select.h
 */

#include "terminal.h"

#include <stdbool.h>

/**
 * Forwards the visible portion of the text selection rectangle to the
 * underlying terminal display, requesting that it be redrawn. If no
 * visible change would result from redrawing the selection rectangle,
 * this function may have no effect.
 *
 * @param terminal
 *     The guac_terminal whose text selection rectangle should be
 *     redrawn.
 */
void guac_terminal_select_redraw(guac_terminal* terminal);

/**
 * Marks the start of text selection at the given row and column. Any existing
 * selection is cleared. This function should only be invoked while the
 * guac_terminal is locked through a call to guac_terminal_lock().
 *
 * @param terminal
 *     The guac_terminal instance associated with the text being selected.
 *
 * @param row
 *     The row number of the character at the start of the text selection,
 *     where the first (top-most) row in the terminal is row 0. Rows within
 *     the scrollback buffer (above the top-most row of the terminal) will be
 *     negative.
 *
 * @param column
 *     The column number of the character at the start of the text selection,
 *     where the first (left-most) column in the terminal is column 0.
 */
void guac_terminal_select_start(guac_terminal* terminal, int row, int column);

/**
 * Updates the end of text selection at the given row and column. This function
 * should only be invoked while the guac_terminal is locked through a call to
 * guac_terminal_lock().
 *
 * @param terminal
 *     The guac_terminal instance associated with the text being selected.
 *
 * @param row
 *     The row number of the character at the current end of the text
 *     selection, where the first (top-most) row in the terminal is row 0. Rows
 *     within the scrollback buffer (above the top-most row of the terminal)
 *     will be negative.
 *
 * @param column
 *     The column number of the character at the current end of the text
 *     selection, where the first (left-most) column in the terminal is
 *     column 0.
 */
void guac_terminal_select_update(guac_terminal* terminal, int row, int column);

/**
 * Resumes selecting text, expanding the existing selected region from the
 * closest end to additionally contain the given character. This function
 * should only be invoked while the guac_terminal is locked through a call to
 * guac_terminal_lock().
 *
 * @param terminal
 *     The guac_terminal instance associated with the text being selected.
 *
 * @param row
 *     The row number of the character to include within the text selection,
 *     where the first (top-most) row in the terminal is row 0. Rows within the
 *     scrollback buffer (above the top-most row of the terminal) will be
 *     negative.
 *
 * @param column
 *     The column number of the character to include within the text selection,
 *     where the first (left-most) column in the terminal is column 0.
 */
void guac_terminal_select_resume(guac_terminal* terminal, int row, int column);

/**
 * Ends text selection, removing any highlight and storing the selected
 * character data within the clipboard associated with the given terminal. If
 * more text is selected than can fit within the clipboard, text at the end of
 * the selected area will be dropped as necessary. This function should only be
 * invoked while the guac_terminal is locked through a call to
 * guac_terminal_lock().
 *
 * @param terminal
 *     The guac_terminal instance associated with the text being selected.
 */
void guac_terminal_select_end(guac_terminal* terminal);

/**
 * Returns whether at least one character within the given range is currently
 * selected.
 *
 * @param terminal
 *     The guac_terminal instance associated with the text being selected.
 *
 * @param start_row
 *     The first row of the region to test, inclusive, where the first
 *     (top-most) row in the terminal is row 0. Rows within the scrollback
 *     buffer (above the top-most row of the terminal) will be negative.
 *
 * @param start_column
 *     The first column of the region to test, inclusive, where the first
 *     (left-most) column in the terminal is column 0.
 *
 * @param end_row
 *     The last row of the region to test, inclusive, where the first
 *     (top-most) row in the terminal is row 0. Rows within the scrollback
 *     buffer (above the top-most row of the terminal) will be negative.
 *
 * @param end_column
 *     The last column of the region to test, inclusive, where the first
 *     (left-most) column in the terminal is column 0.
 *
 * @return
 *     true if at least one character within the given range is currently
 *     selected, false otherwise.
 */
bool guac_terminal_select_contains(guac_terminal* terminal,
        int start_row, int start_column, int end_row, int end_column);

/**
 * Clears the current selection if it contains at least one character within
 * the given region. If no text is currently selected, the selection has not
 * yet been committed, or the region does not contain at least one selected
 * character, this function has no effect.
 *
 * @param terminal
 *     The guac_terminal instance associated with the text being selected.
 *
 * @param start_row
 *     The first row of the region, inclusive, where the first (top-most) row
 *     in the terminal is row 0. Rows within the scrollback buffer (above the
 *     top-most row of the terminal) will be negative.
 *
 * @param start_column
 *     The first column of the region, inclusive, where the first (left-most)
 *     column in the terminal is column 0.
 *
 * @param end_row
 *     The last row of the region, inclusive, where the first (top-most) row in
 *     the terminal is row 0. Rows within the scrollback buffer (above the
 *     top-most row of the terminal) will be negative.
 *
 * @param end_column
 *     The last column of the region, inclusive, where the first (left-most)
 *     column in the terminal is column 0.
 */
void guac_terminal_select_touch(guac_terminal* terminal,
        int start_row, int start_column, int end_row, int end_column);

#endif

