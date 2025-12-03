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

#ifndef _GUAC_TERMINAL_DISPLAY_H
#define _GUAC_TERMINAL_DISPLAY_H

/**
 * Structures and function definitions related to the graphical display.
 *
 * @file display.h
 */

#include "common/surface.h"
#include "palette.h"
#include "types.h"

#include <guacamole/client.h>
#include <guacamole/layer.h>
#include <pango/pangocairo.h>

#include <stdbool.h>
#include <stdint.h>

/**
 * The maximum width of any character, in columns.
 */
#define GUAC_TERMINAL_MAX_CHAR_WIDTH 2

/**
 * The size of margins between the console text and the border in mm.
 */
#define GUAC_TERMINAL_MARGINS 2

/**
 * 1 inch is 25.4 millimeters, and we can therefore use the following
 * to create a mm to px formula: (mm × dpi) ÷ 25.4 = px.
 */
#define GUAC_TERMINAL_MM_PER_INCH 25.4

/**
 * All available terminal operations which affect character cells.
 */
typedef enum guac_terminal_operation_type {

    /**
     * Operation which does nothing.
     */
    GUAC_CHAR_NOP,

    /**
     * Operation which copies a character from a given row/column coordinate.
     */
    GUAC_CHAR_COPY,

    /**
     * Operation which sets the character and attributes.
     */
    GUAC_CHAR_SET

} guac_terminal_operation_type;

/**
 * A pairing of a guac_terminal_operation_type and all parameters required by
 * that operation type.
 */
typedef struct guac_terminal_operation {

    /**
     * The type of operation to perform.
     */
    guac_terminal_operation_type type;

    /**
     * The character (and attributes) to set the current location to. This is
     * only applicable to GUAC_CHAR_SET.
     */
    guac_terminal_char character;

    /**
     * The row to copy a character from. This is only applicable to
     * GUAC_CHAR_COPY.
     */
    int row;

    /**
     * The column to copy a character from. This is only applicable to
     * GUAC_CHAR_COPY.
     */
    int column;

} guac_terminal_operation;

/**
 * Set of all pending operations for the currently-visible screen area, and the
 * contextual information necessary to interpret and render those changes.
 */
typedef struct guac_terminal_display {

    /**
     * The Guacamole client this display will use for rendering.
     */
    guac_client* client;

    /**
     * Array of all operations pending for the visible screen area.
     */
    guac_terminal_operation* operations;

    /**
     * The width of the screen, in characters.
     */
    int width;

    /**
     * The height of the screen, in characters.
     */
    int height;

    /**
     * The size of margins between the console text and the border in pixels.
     */
    int margin;

    /**
     * The description of the font to use for rendering.
     */
    PangoFontDescription* font_desc;

    /**
     * The width of each character, in pixels.
     */
    int char_width;

    /**
     * The height of each character, in pixels.
     */
    int char_height;

    /**
     * The current palette.
     */
    guac_terminal_color palette[256];

    /**
     * The default palette. Use GUAC_TERMINAL_INITIAL_PALETTE if null.
     * Must free on destruction if not null.
     */
    guac_terminal_color (*default_palette)[256];

    /**
     * Default foreground color for all glyphs.
     */
    guac_terminal_color default_foreground;

    /**
     * Default background color for all glyphs and the terminal itself.
     */
    guac_terminal_color default_background;

    /**
     * The foreground color to be used for the next glyph rendered to the
     * terminal.
     */
    guac_terminal_color glyph_foreground;

    /**
     * The background color to be used for the next glyph rendered to the
     * terminal.
     */
    guac_terminal_color glyph_background;

    /**
     * The surface containing the actual terminal.
     */
    guac_common_surface* display_surface;

    /**
     * Layer which contains the actual terminal.
     */
    guac_layer* display_layer;

    /**
     * Sub-layer of display layer which highlights selected text.
     */
    guac_layer* select_layer;

    /**
     * Whether text is currently selected.
     */
    bool text_selected;

    /**
     * The row that the selection starts at.
     */
    int selection_start_row;

    /**
     * The column that the selection starts at.
     */
    int selection_start_column;

    /**
     * The row that the selection ends at.
     */
    int selection_end_row;

    /**
     * The column that the selection ends at.
     */
    int selection_end_column;

    /**
     * Whether there are GUAC_CHAR_SET operations that need to be flushed
     * to the display.
     */
    bool unflushed_set;

} guac_terminal_display;

/**
 * Allocates a new display having the given default foreground and background
 * colors.
 */
guac_terminal_display* guac_terminal_display_alloc(guac_client* client,
        const char* font_name, int font_size, int dpi,
        guac_terminal_color* foreground, guac_terminal_color* background,
        guac_terminal_color (*palette)[256]);

/**
 * Frees the given display.
 */
void guac_terminal_display_free(guac_terminal_display* display);

/**
 * Resets the palette of the given display to the initial, default color
 * values, as defined by default_palette or GUAC_TERMINAL_INITIAL_PALETTE.
 *
 * @param display
 *     The display to reset.
 */
void guac_terminal_display_reset_palette(guac_terminal_display* display);

/**
 * Replaces the color in the palette at the given index with the given color.
 * If the index is invalid, the assignment is ignored.
 *
 * @param display
 *     The display whose palette is being changed.
 *
 * @param index
 *     The index of the palette entry to change.
 *
 * @param color
 *     The color to assign to the palette entry having the given index.
 *
 * @returns
 *     Zero if the assignment was successful, non-zero if the assignment
 *     failed.
 */
int guac_terminal_display_assign_color(guac_terminal_display* display,
        int index, const guac_terminal_color* color);

/**
 * Retrieves the color within the palette at the given index, if such a color
 * exists. If the index is invalid, no color is retrieved.
 *
 * @param display
 *     The display whose palette contains the color to be retrieved.
 *
 * @param index
 *     The index of the palette entry to retrieve.
 *
 * @param color
 *     A pointer to a guac_terminal_color structure which should receive the
 *     color retrieved from the palette.
 *
 * @returns
 *     Zero if the color was successfully retrieved, non-zero otherwise.
 */
int guac_terminal_display_lookup_color(guac_terminal_display* display,
        int index, guac_terminal_color* color);

/**
 * Copies the given range of columns to a new location, offset from
 * the original by the given number of columns.
 */
void guac_terminal_display_copy_columns(guac_terminal_display* display, int row,
        int start_column, int end_column, int offset);

/**
 * Copies the given range of rows to a new location, offset from the
 * original by the given number of rows.
 */
void guac_terminal_display_copy_rows(guac_terminal_display* display,
        int start_row, int end_row, int offset);

/**
 * Sets the given range of columns within the given row to the given
 * character.
 */
void guac_terminal_display_set_columns(guac_terminal_display* display, int row,
        int start_column, int end_column, guac_terminal_char* character);

/**
 * Resize the terminal to the given dimensions.
 */
void guac_terminal_display_resize(guac_terminal_display* display, int width, int height);

/**
 * Flushes all pending operations within the given guac_terminal_display.
 *
 * @param display
 *     The terminal display whose pending operations are being flushed.
 */
void guac_terminal_display_flush_operations(guac_terminal_display* display);

/**
 * Flushes all pending operations within the given guac_terminal_display,
 * then flushes the display surface.
 *
 * @param display
 *     The terminal display to flush.
 */
void guac_terminal_display_flush(guac_terminal_display* display);

/**
 * Initializes and syncs the current terminal display state for all joining
 * users associated with the provided socket, sending the necessary instructions
 * to completely recreate and redraw the terminal rendering over the given
 * socket.
 *
 * @param display
 *     The terminal display to sync to the users associated with the provided
 *     socket.
 *
 * @param client
 *     The client whose users are joining.
 *
 * @param socket
 *     The socket over which any necessary instructions should be sent.
 */
void guac_terminal_display_dup(
        guac_terminal_display* display, guac_client* client, guac_socket* socket);

/**
 * Draws the text selection rectangle from the given coordinates to the given end coordinates.
 */
void guac_terminal_display_select(guac_terminal_display* display,
        int start_row, int start_col, int end_row, int end_col);

/**
 * Clears the currently-selected region, removing the highlight.
 *
 * @param display
 *     The guac_terminal_display whose currently-selected region should be
 *     cleared.
 */
void guac_terminal_display_clear_select(guac_terminal_display* display);

/**
 * Alters the font of the terminal display. The available display area and the
 * regular grid of character cells will be resized as necessary to compensate
 * for any changes in font metrics.
 *
 * If successful, the terminal itself MUST be manually resized to take into
 * account the new character dimensions, and MUST be manually redrawn. Failing
 * to do so will result in graphical artifacts.
 *
 * @param display
 *     The display whose font family and/or size are being changed.
 *
 * @param font_name
 *     The name of the new font family, or NULL if the font family should
 *     remain unchanged.
 *
 * @param font_size
 *     The new font size, in points, or -1 if the font size should remain
 *     unchanged.
 *
 * @param dpi
 *     The resolution of the display in DPI. If the font size will not be
 *     changed (the font size given is -1), this value is ignored.
 *
 * @return
 *     Zero if the font was successfully changed, non-zero otherwise.
 */
int guac_terminal_display_set_font(guac_terminal_display* display,
        const char* font_name, int font_size, int dpi);

#endif

