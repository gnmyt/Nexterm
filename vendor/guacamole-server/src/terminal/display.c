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

#include "common/surface.h"
#include "terminal/common.h"
#include "terminal/display.h"
#include "terminal/palette.h"
#include "terminal/terminal.h"
#include "terminal/terminal-priv.h"
#include "terminal/types.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>

#include <cairo/cairo.h>
#include <glib-object.h>
#include <guacamole/assert.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <pango/pangocairo.h>

/* Maps any codepoint onto a number between 0 and 511 inclusive */
int __guac_terminal_hash_codepoint(int codepoint) {

    /* If within one byte, just return codepoint */
    if (codepoint <= 0xFF)
        return codepoint;

    /* Otherwise, map to next 256 values */
    return (codepoint & 0xFF) + 0x100;

}

/**
 * Sets the attributes of the display such that future glyphs will render as
 * expected.
 */
int __guac_terminal_set_colors(guac_terminal_display* display,
        guac_terminal_attributes* attributes) {

    const guac_terminal_color* background;
    const guac_terminal_color* foreground;

    /* Handle reverse video */
    if (attributes->reverse != attributes->cursor) {
        background = &attributes->foreground;
        foreground = &attributes->background;
    }
    else {
        foreground = &attributes->foreground;
        background = &attributes->background;
    }

    /* Handle bold */
    if (attributes->bold && !attributes->half_bright
            && foreground->palette_index >= GUAC_TERMINAL_FIRST_DARK
            && foreground->palette_index <= GUAC_TERMINAL_LAST_DARK) {
        foreground = &display->palette[foreground->palette_index
            + GUAC_TERMINAL_INTENSE_OFFSET];
    }

    display->glyph_foreground = *foreground;
    guac_terminal_display_lookup_color(display,
            foreground->palette_index, &display->glyph_foreground);

    display->glyph_background = *background;
    guac_terminal_display_lookup_color(display,
            background->palette_index, &display->glyph_background);

    /* Modify color if half-bright (low intensity) */
    if (attributes->half_bright && !attributes->bold) {
        display->glyph_foreground.red   /= 2;
        display->glyph_foreground.green /= 2;
        display->glyph_foreground.blue  /= 2;
    }

    return 0;

}

/**
 * Sends the given character to the terminal at the given row and column,
 * rendering the character immediately. This bypasses the guac_terminal_display
 * mechanism and is intended for flushing of updates only.
 */
int __guac_terminal_set(guac_terminal_display* display, int row, int col, int codepoint) {

    int width;

    int bytes;
    char utf8[4];

    /* Use foreground color */
    const guac_terminal_color* color = &display->glyph_foreground;

    /* Use background color */
    const guac_terminal_color* background = &display->glyph_background;

    cairo_surface_t* surface;
    cairo_t* cairo;
    int surface_width, surface_height;
   
    PangoLayout* layout;
    int layout_width, layout_height;
    int ideal_layout_width, ideal_layout_height;

    /* Calculate width in columns */
    width = wcwidth(codepoint);
    if (width < 0)
        width = 1;

    /* Do nothing if glyph is empty */
    if (width == 0)
        return 0;

    /* Convert to UTF-8 */
    bytes = guac_terminal_encode_utf8(codepoint, utf8);

    surface_width = width * display->char_width;
    surface_height = display->char_height;

    ideal_layout_width = surface_width * PANGO_SCALE;
    ideal_layout_height = surface_height * PANGO_SCALE;

    /* Prepare surface */
    surface = cairo_image_surface_create(CAIRO_FORMAT_RGB24,
                                         surface_width, surface_height);
    cairo = cairo_create(surface);

    /* Fill background */
    cairo_set_source_rgb(cairo,
            background->red   / 255.0,
            background->green / 255.0,
            background->blue  / 255.0);

    cairo_rectangle(cairo, 0, 0, surface_width, surface_height); 
    cairo_fill(cairo);

    /* Get layout */
    layout = pango_cairo_create_layout(cairo);
    pango_layout_set_font_description(layout, display->font_desc);
    pango_layout_set_text(layout, utf8, bytes);
    pango_layout_set_alignment(layout, PANGO_ALIGN_CENTER);

    pango_layout_get_size(layout, &layout_width, &layout_height);

    /* If layout bigger than available space, scale it back */
    if (layout_width > ideal_layout_width || layout_height > ideal_layout_height) {

        double scale = fmin(ideal_layout_width  / (double) layout_width,
                            ideal_layout_height / (double) layout_height);

        cairo_scale(cairo, scale, scale);

        /* Update layout to reflect scaled surface */
        pango_layout_set_width(layout, ideal_layout_width / scale);
        pango_layout_set_height(layout, ideal_layout_height / scale);
        pango_cairo_update_layout(cairo, layout);

    }

    /* Draw */
    cairo_set_source_rgb(cairo,
            color->red   / 255.0,
            color->green / 255.0,
            color->blue  / 255.0);

    cairo_move_to(cairo, 0.0, 0.0);
    pango_cairo_show_layout(cairo, layout);

    /* Draw */
    guac_common_surface_draw(display->display_surface,
        display->char_width * col,
        display->char_height * row,
        surface);

    /* Free all */
    g_object_unref(layout);
    cairo_destroy(cairo);
    cairo_surface_destroy(surface);

    return 0;

}

/**
 * Calculate the size of margins around the terminal based on DPI.
 *
 * @param dpi
 *     The resolution of the display in DPI.
 *
 * @return
 *     Calculated size of margin in pixels.
 */
static int get_margin_by_dpi(int dpi) {
    return dpi * GUAC_TERMINAL_MARGINS / GUAC_TERMINAL_MM_PER_INCH;
}

guac_terminal_display* guac_terminal_display_alloc(guac_client* client,
        const char* font_name, int font_size, int dpi,
        guac_terminal_color* foreground, guac_terminal_color* background,
        guac_terminal_color (*palette)[256]) {

    /* Allocate display */
    guac_terminal_display* display = guac_mem_alloc(sizeof(guac_terminal_display));
    display->client = client;

    /* Initially no font loaded */
    display->font_desc = NULL;
    display->char_width = 0;
    display->char_height = 0;

    /* Create default surface */
    display->display_layer = guac_client_alloc_layer(client);
    display->select_layer = guac_client_alloc_layer(client);
    display->display_surface = guac_common_surface_alloc(client,
            client->socket, display->display_layer, 0, 0);

    /* Never use lossy compression for terminal contents */
    guac_common_surface_set_lossless(display->display_surface, 1);

    /* Select layer is a child of the display layer */
    guac_protocol_send_move(client->socket, display->select_layer,
            display->display_layer, 0, 0, 0);

    /* Calculate margin size by DPI */
    display->margin = get_margin_by_dpi(dpi);

    /* Offset the Default Layer to make margins even on all sides */
    guac_protocol_send_move(client->socket, display->display_layer,
        GUAC_DEFAULT_LAYER, display->margin, display->margin, 0);

    display->default_foreground = display->glyph_foreground = *foreground;
    display->default_background = display->glyph_background = *background;
    display->default_palette = palette;

    /* Initially empty */
    display->width = 0;
    display->height = 0;
    display->operations = NULL;
    display->unflushed_set = false;

    /* Initially nothing selected */
    display->text_selected = false;

    /* Attempt to load font */
    if (guac_terminal_display_set_font(display, font_name, font_size, dpi)) {
        guac_client_abort(display->client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Unable to set initial font \"%s\"", font_name);
        guac_mem_free(display);
        return NULL;
    }

    return display;

}

void guac_terminal_display_free(guac_terminal_display* display) {

    /* Free font description */
    pango_font_description_free(display->font_desc);

    /* Free default palette. */
    guac_mem_free(display->default_palette);

    /* Free operations buffers */
    guac_mem_free(display->operations);

    /* Free display */
    guac_mem_free(display);

}

void guac_terminal_display_reset_palette(guac_terminal_display* display) {

    /* Reinitialize palette with default values */
    if (display->default_palette) {
        memcpy(display->palette, *display->default_palette,
               sizeof(GUAC_TERMINAL_INITIAL_PALETTE));
        return;
    }

    memcpy(display->palette, GUAC_TERMINAL_INITIAL_PALETTE,
            sizeof(GUAC_TERMINAL_INITIAL_PALETTE));

}

int guac_terminal_display_assign_color(guac_terminal_display* display,
        int index, const guac_terminal_color* color) {

    /* Assignment fails if out-of-bounds */
    if (index < 0 || index > 255)
        return 1;

    /* Copy color components */
    display->palette[index].red   = color->red;
    display->palette[index].green = color->green;
    display->palette[index].blue  = color->blue;

    /* Color successfully stored */
    return 0;

}

int guac_terminal_display_lookup_color(guac_terminal_display* display,
        int index, guac_terminal_color* color) {

    /* Use default foreground if foreground pseudo-index is given */
    if (index == GUAC_TERMINAL_COLOR_FOREGROUND) {
        *color = display->default_foreground;
        return 0;
    }

    /* Use default background if background pseudo-index is given */
    if (index == GUAC_TERMINAL_COLOR_BACKGROUND) {
        *color = display->default_background;
        return 0;
    }

    /* Lookup fails if out-of-bounds */
    if (index < 0 || index > 255)
        return 1;

    /* Copy color definition */
    *color = display->palette[index];
    return 0;

}

void guac_terminal_display_copy_columns(guac_terminal_display* display, int row,
        int start_column, int end_column, int offset) {

    /* Ignore operations outside display bounds */
    if (row < 0 || row >= display->height)
        return;

    /* Fit relevant extents of operation within bounds (NOTE: Because this
     * operation is relative and represents the destination with an offset,
     * there's no need to recalculate the destination region - the offset
     * simply remains the same) */
    if (offset >= 0) {
        start_column = guac_terminal_fit_to_range(start_column, 0,            display->width - offset - 1);
        end_column   = guac_terminal_fit_to_range(end_column,   start_column, display->width - offset - 1);
    }
    else {
        start_column = guac_terminal_fit_to_range(start_column, -offset,      display->width - 1);
        end_column   = guac_terminal_fit_to_range(end_column,   start_column, display->width - 1);
    }

    /* Determine source and destination locations */

    size_t row_offset = guac_mem_ckd_mul_or_die(row, display->width);
    size_t src_offset = guac_mem_ckd_add_or_die(row_offset, start_column);

    size_t dst_offset;
    if (offset >= 0)
        dst_offset = guac_mem_ckd_add_or_die(src_offset, offset);
    else
        dst_offset = guac_mem_ckd_sub_or_die(src_offset, -offset);

    guac_terminal_operation* src = &(display->operations[src_offset]);
    guac_terminal_operation* dst = &(display->operations[dst_offset]);

    /* Copy data */
    memmove(dst, src, guac_mem_ckd_mul_or_die(sizeof(guac_terminal_operation), (end_column - start_column + 1)));

    /* Update operations */
    for (int column = start_column; column <= end_column; column++) {

        /* If no operation here, set as copy */
        if (dst->type == GUAC_CHAR_NOP) {
            dst->type = GUAC_CHAR_COPY;
            dst->row = row;
            dst->column = column;
        }

        /* Next column */
        dst++;

    }

}

void guac_terminal_display_copy_rows(guac_terminal_display* display,
        int start_row, int end_row, int offset) {

    /* Fit relevant extents of operation within bounds (NOTE: Because this
     * operation is relative and represents the destination with an offset,
     * there's no need to recalculate the destination region - the offset
     * simply remains the same) */
    if (offset >= 0) {
        start_row = guac_terminal_fit_to_range(start_row, 0,         display->height - offset - 1);
        end_row   = guac_terminal_fit_to_range(end_row,   start_row, display->height - offset - 1);
    }
    else {
        start_row = guac_terminal_fit_to_range(start_row, -offset,   display->height - 1);
        end_row   = guac_terminal_fit_to_range(end_row,   start_row, display->height - 1);
    }

    /* Determine source and destination locations */

    size_t dst_start_row;
    if (offset >= 0)
        dst_start_row = guac_mem_ckd_add_or_die(start_row, offset);
    else
        dst_start_row = guac_mem_ckd_sub_or_die(start_row, -offset);

    size_t src_offset = guac_mem_ckd_mul_or_die(start_row, display->width);
    size_t dst_offset = guac_mem_ckd_mul_or_die(dst_start_row, display->width);

    guac_terminal_operation* src = &(display->operations[src_offset]);
    guac_terminal_operation* dst = &(display->operations[dst_offset]);

    /* Flush operations if there are any unflushed SET operations. This is
     * necessary to ensure that the copy operation does not conflict with any
     * SET operations that may have been performed since the last flush.
     * It is a workaround for the terminal artifacts during scrolling to
     * the beginning of texts (i.e. with guac_terminal_scroll_down) so we
     * apply it when the offset is positive only. Otherwise it will affect
     * guac_terminal_scroll_up which will lead to significant performance
     * degradation when dumping big text files. */
    if (display->unflushed_set && offset > 0)
        guac_terminal_display_flush_operations(display);

    /* Copy data */
    memmove(dst, src, guac_mem_ckd_mul_or_die(sizeof(guac_terminal_operation),
                display->width, (end_row - start_row + 1)));

    /* Update operations */
    for (int row = start_row; row <= end_row; row++) {

        guac_terminal_operation* current = dst;
        for (int col = 0; col < display->width; col++) {

            /* If no operation here, set as copy */
            if (current->type == GUAC_CHAR_NOP) {
                current->type = GUAC_CHAR_COPY;
                current->row = row;
                current->column = col;
            }

            /* Next column */
            current++;

        }

        /* Next row */
        dst += display->width;

    }

}

void guac_terminal_display_set_columns(guac_terminal_display* display, int row,
        int start_column, int end_column, guac_terminal_char* character) {

    /* Do nothing if glyph is empty */
    if (character->width == 0)
        return;

    /* Ignore operations outside display bounds */
    if (row < 0 || row >= display->height)
        return;

    /* Fit range within bounds */
    start_column = guac_terminal_fit_to_range(start_column, 0, display->width - 1);
    end_column   = guac_terminal_fit_to_range(end_column,   0, display->width - 1);

    size_t start_offset = guac_mem_ckd_add_or_die(guac_mem_ckd_mul_or_die(row, display->width), start_column);
    guac_terminal_operation* current = &(display->operations[start_offset]);

    /* For each column in range */
    for (int col = start_column; col <= end_column; col += character->width) {

        /* Flush pending copy operation before adding new SET operation. This
         * avoid operation conflicts that cause inconsistent display. */
        if (current->type == GUAC_CHAR_COPY)
            guac_terminal_display_flush_operations(display);

        /* Set operation */
        current->type      = GUAC_CHAR_SET;
        current->character = *character;

        /* Next character */
        current += character->width;

    }

    /* Marks whether there are unflushed GUAC_CHAR_SET operations when the
     * operation is not on the first or last row because flushing new lines
     * added has a high performance cost. This flag is used to determine
     * whether a flush is necessary before performing copy operations. */
    if (row > 0 && row < display->height - 1)
        display->unflushed_set = true;

}

void guac_terminal_display_resize(guac_terminal_display* display, int width, int height) {

    /* Resize display only if dimensions have changed */
    if (width == display->width && height == display->height)
        return;

    GUAC_ASSERT(width >= 0 && width <= GUAC_TERMINAL_MAX_COLUMNS);
    GUAC_ASSERT(height >= 0 && height <= GUAC_TERMINAL_MAX_ROWS);

    /* Fill with background color */
    guac_terminal_char fill = {
        .value = 0,
        .attributes = {
            .foreground = display->default_background,
            .background = display->default_background
        },
        .width = 1
    };

    /* Free old operations buffer */
    if (display->operations != NULL)
        guac_mem_free(display->operations);

    /* Alloc operations */
    display->operations = guac_mem_alloc(width, height,
            sizeof(guac_terminal_operation));

    /* Init each operation buffer row */
    guac_terminal_operation* current = display->operations;
    for (int y = 0; y < height; y++) {

        /* Init entire row to NOP */
        for (int x = 0; x < width; x++) {

            /* If on old part of screen, do not clear */
            if (x < display->width && y < display->height)
                current->type = GUAC_CHAR_NOP;

            /* Otherwise, clear contents first */
            else {
                current->type = GUAC_CHAR_SET;
                current->character  = fill;
            }

            current++;

        }

    }

    /* Set width and height */
    display->width = width;
    display->height = height;

    /* Send display size */
    guac_common_surface_resize(
            display->display_surface,
            display->char_width  * width,
            display->char_height * height);

    guac_protocol_send_size(display->client->socket,
            display->select_layer,
            display->char_width  * width,
            display->char_height * height);

}

void __guac_terminal_display_flush_copy(guac_terminal_display* display) {

    guac_terminal_operation* current = display->operations;
    int row, col;

    /* For each operation */
    for (row=0; row<display->height; row++) {
        for (col=0; col<display->width; col++) {

            /* If operation is a copy operation */
            if (current->type == GUAC_CHAR_COPY) {

                /* The determined bounds of the rectangle of contiguous
                 * operations */
                int detected_right = -1;
                int detected_bottom = row;

                /* The current row or column within a rectangle */
                int rect_row, rect_col;

                /* The dimensions of the rectangle as determined */
                int rect_width, rect_height;

                /* The expected row and column source for the next copy
                 * operation (if adjacent to current) */
                int expected_row, expected_col;

                /* Current row within a subrect */
                guac_terminal_operation* rect_current_row;

                /* Determine bounds of rectangle */
                rect_current_row = current;
                expected_row = current->row;
                for (rect_row=row; rect_row<display->height; rect_row++) {

                    guac_terminal_operation* rect_current = rect_current_row;
                    expected_col = current->column;

                    /* Find width */
                    for (rect_col=col; rect_col<display->width; rect_col++) {

                        /* If not identical operation, stop */
                        if (rect_current->type != GUAC_CHAR_COPY
                                || rect_current->row != expected_row
                                || rect_current->column != expected_col)
                            break;

                        /* Next column */
                        rect_current++;
                        expected_col++;

                    }

                    /* If too small, cannot append row */
                    if (rect_col-1 < detected_right)
                        break;

                    /* As row has been accepted, update rect_row of rect */
                    detected_bottom = rect_row;

                    /* For now, only set rect_col bound if uninitialized */
                    if (detected_right == -1)
                        detected_right = rect_col - 1;

                    /* Next row */
                    rect_current_row += display->width;
                    expected_row++;

                }

                /* Calculate dimensions */
                rect_width  = detected_right  - col + 1;
                rect_height = detected_bottom - row + 1;

                /* Mark rect as NOP (as it has been handled) */
                rect_current_row = current;
                expected_row = current->row;
                for (rect_row=0; rect_row<rect_height; rect_row++) {
                    
                    guac_terminal_operation* rect_current = rect_current_row;
                    expected_col = current->column;

                    for (rect_col=0; rect_col<rect_width; rect_col++) {

                        /* Mark copy operations as NOP */
                        if (rect_current->type == GUAC_CHAR_COPY
                                && rect_current->row == expected_row
                                && rect_current->column == expected_col)
                            rect_current->type = GUAC_CHAR_NOP;

                        /* Next column */
                        rect_current++;
                        expected_col++;

                    }

                    /* Next row */
                    rect_current_row += display->width;
                    expected_row++;

                }

                /* Send copy */
                guac_common_surface_copy(

                        display->display_surface,
                        current->column * display->char_width,
                        current->row * display->char_height,
                        rect_width * display->char_width,
                        rect_height * display->char_height,

                        display->display_surface,
                        col * display->char_width,
                        row * display->char_height);

            } /* end if copy operation */

            /* Next operation */
            current++;

        }
    }

}

void __guac_terminal_display_flush_clear(guac_terminal_display* display) {

    guac_terminal_operation* current = display->operations;
    int row, col;

    /* For each operation */
    for (row=0; row<display->height; row++) {
        for (col=0; col<display->width; col++) {

            /* If operation is a clear operation (set to space) */
            if (current->type == GUAC_CHAR_SET &&
                    !guac_terminal_has_glyph(current->character.value)) {

                /* The determined bounds of the rectangle of contiguous
                 * operations */
                int detected_right = -1;
                int detected_bottom = row;

                /* The current row or column within a rectangle */
                int rect_row, rect_col;

                /* The dimensions of the rectangle as determined */
                int rect_width, rect_height;

                /* Color of the rectangle to draw */
                guac_terminal_color color;
                if (current->character.attributes.reverse != current->character.attributes.cursor)
                   color = current->character.attributes.foreground;
                else
                   color = current->character.attributes.background;

                /* Rely only on palette index if defined */
                guac_terminal_display_lookup_color(display,
                        color.palette_index, &color);

                /* Current row within a subrect */
                guac_terminal_operation* rect_current_row;

                /* Determine bounds of rectangle */
                rect_current_row = current;
                for (rect_row=row; rect_row<display->height; rect_row++) {

                    guac_terminal_operation* rect_current = rect_current_row;

                    /* Find width */
                    for (rect_col=col; rect_col<display->width; rect_col++) {

                        const guac_terminal_color* joining_color;
                        if (rect_current->character.attributes.reverse != rect_current->character.attributes.cursor)
                           joining_color = &rect_current->character.attributes.foreground;
                        else
                           joining_color = &rect_current->character.attributes.background;

                        /* If not identical operation, stop */
                        if (rect_current->type != GUAC_CHAR_SET
                                || guac_terminal_has_glyph(rect_current->character.value)
                                || guac_terminal_colorcmp(joining_color, &color) != 0)
                            break;

                        /* Next column */
                        rect_current++;

                    }

                    /* If too small, cannot append row */
                    if (rect_col-1 < detected_right)
                        break;

                    /* As row has been accepted, update rect_row of rect */
                    detected_bottom = rect_row;

                    /* For now, only set rect_col bound if uninitialized */
                    if (detected_right == -1)
                        detected_right = rect_col - 1;

                    /* Next row */
                    rect_current_row += display->width;

                }

                /* Calculate dimensions */
                rect_width  = detected_right  - col + 1;
                rect_height = detected_bottom - row + 1;

                /* Mark rect as NOP (as it has been handled) */
                rect_current_row = current;
                for (rect_row=0; rect_row<rect_height; rect_row++) {
                    
                    guac_terminal_operation* rect_current = rect_current_row;

                    for (rect_col=0; rect_col<rect_width; rect_col++) {

                        const guac_terminal_color* joining_color;
                        if (rect_current->character.attributes.reverse != rect_current->character.attributes.cursor)
                           joining_color = &rect_current->character.attributes.foreground;
                        else
                           joining_color = &rect_current->character.attributes.background;

                        /* Mark clear operations as NOP */
                        if (rect_current->type == GUAC_CHAR_SET
                                && !guac_terminal_has_glyph(rect_current->character.value)
                                && guac_terminal_colorcmp(joining_color, &color) == 0)
                            rect_current->type = GUAC_CHAR_NOP;

                        /* Next column */
                        rect_current++;

                    }

                    /* Next row */
                    rect_current_row += display->width;

                }

                /* Send rect */
                guac_common_surface_set(
                        display->display_surface,
                        col * display->char_width,
                        row * display->char_height,
                        rect_width * display->char_width,
                        rect_height * display->char_height,
                        color.red, color.green, color.blue,
                        0xFF);

            } /* end if clear operation */

            /* Next operation */
            current++;

        }
    }

}

void __guac_terminal_display_flush_set(guac_terminal_display* display) {

    guac_terminal_operation* current = display->operations;
    int row, col;

    /* For each operation */
    for (row=0; row<display->height; row++) {
        for (col=0; col<display->width; col++) {

            /* Perform given operation */
            if (current->type == GUAC_CHAR_SET) {

                int codepoint = current->character.value;

                /* Use space if no glyph */
                if (!guac_terminal_has_glyph(codepoint))
                    codepoint = ' ';

                /* Set attributes */
                __guac_terminal_set_colors(display,
                        &(current->character.attributes));

                /* Send character */
                __guac_terminal_set(display, row, col, codepoint);

                /* Mark operation as handled */
                current->type = GUAC_CHAR_NOP;

            }

            /* Next operation */
            current++;

        }
    }

    /* Mark that all SET operations have been flushed */
    display->unflushed_set = 0;

}
void guac_terminal_display_flush_operations(guac_terminal_display* display) {

    /* Flush operations, copies first, then clears, then sets. */
    __guac_terminal_display_flush_copy(display);
    __guac_terminal_display_flush_clear(display);
    __guac_terminal_display_flush_set(display);

}

void guac_terminal_display_flush(guac_terminal_display* display) {

    /* Flush operations */
    guac_terminal_display_flush_operations(display);

    /* Flush surface */
    guac_common_surface_flush(display->display_surface);

}

void guac_terminal_display_dup(
        guac_terminal_display* display, guac_client* client, guac_socket* socket) {

    /* Create default surface */
    guac_common_surface_dup(display->display_surface, client, socket);

    /* Select layer is a child of the display layer */
    guac_protocol_send_move(socket, display->select_layer,
            display->display_layer, 0, 0, 0);

    /* Offset the Default Layer to make margins even on all sides */
    guac_protocol_send_move(socket, display->display_layer,
        GUAC_DEFAULT_LAYER, display->margin, display->margin, 0);

    /* Send select layer size */
    guac_protocol_send_size(socket, display->select_layer,
            display->char_width  * display->width,
            display->char_height * display->height);

}

void guac_terminal_display_select(guac_terminal_display* display,
        int start_row, int start_col, int end_row, int end_col) {

    guac_socket* socket = display->client->socket;
    guac_layer* select_layer = display->select_layer;

    /* Do nothing if selection is unchanged */
    if (display->text_selected
            && display->selection_start_row    == start_row
            && display->selection_start_column == start_col
            && display->selection_end_row      == end_row
            && display->selection_end_column   == end_col)
        return;

    /* Text is now selected */
    display->text_selected = true;

    display->selection_start_row = start_row;
    display->selection_start_column = start_col;
    display->selection_end_row = end_row;
    display->selection_end_column = end_col;

    /* If single row, just need one rectangle */
    if (start_row == end_row) {

        /* Ensure proper ordering of columns */
        if (start_col > end_col) {
            int temp = start_col;
            start_col = end_col;
            end_col = temp;
        }

        /* Select characters between columns */
        guac_protocol_send_rect(socket, select_layer,

                start_col * display->char_width,
                start_row * display->char_height,

                (end_col - start_col + 1) * display->char_width,
                display->char_height);

    }

    /* Otherwise, need three */
    else {

        /* Ensure proper ordering of start and end coords */
        if (start_row > end_row) {

            int temp;

            temp = start_row;
            start_row = end_row;
            end_row = temp;

            temp = start_col;
            start_col = end_col;
            end_col = temp;

        }

        /* First row */
        guac_protocol_send_rect(socket, select_layer,

                start_col * display->char_width,
                start_row * display->char_height,

                display->width * display->char_width,
                display->char_height);

        /* Middle */
        guac_protocol_send_rect(socket, select_layer,

                0,
                (start_row + 1) * display->char_height,

                display->width * display->char_width,
                (end_row - start_row - 1) * display->char_height);

        /* Last row */
        guac_protocol_send_rect(socket, select_layer,

                0,
                end_row * display->char_height,

                (end_col + 1) * display->char_width,
                display->char_height);

    }

    /* Draw new selection, erasing old */
    guac_protocol_send_cfill(socket, GUAC_COMP_SRC, select_layer,
            0x00, 0x80, 0xFF, 0x60);

}

void guac_terminal_display_clear_select(guac_terminal_display* display) {

    /* Do nothing if nothing is selected */
    if (!display->text_selected)
        return;

    guac_socket* socket = display->client->socket;
    guac_layer* select_layer = display->select_layer;

    guac_protocol_send_rect(socket, select_layer, 0, 0, 1, 1);
    guac_protocol_send_cfill(socket, GUAC_COMP_SRC, select_layer,
            0x00, 0x00, 0x00, 0x00);

    /* Text is no longer selected */
    display->text_selected = false;

}

int guac_terminal_display_set_font(guac_terminal_display* display,
        const char* font_name, int font_size, int dpi) {

    PangoFontDescription* font_desc;

    /* Build off existing font description if possible */
    if (display->font_desc != NULL)
        font_desc = pango_font_description_copy(display->font_desc);

    /* Create new font description if there is nothing to copy */
    else {
        font_desc = pango_font_description_new();
        pango_font_description_set_weight(font_desc, PANGO_WEIGHT_NORMAL);
    }

    /* Optionally update font name */
    if (font_name != NULL)
        pango_font_description_set_family(font_desc, font_name);

    /* Optionally update size */
    if (font_size != -1) {
        pango_font_description_set_size(font_desc,
                font_size * PANGO_SCALE * dpi / 96);
    }

    PangoFontMap* font_map = pango_cairo_font_map_get_default();
    PangoContext* context = pango_font_map_create_context(font_map);

    /* Load font from font map */
    PangoFont* font = pango_font_map_load_font(font_map, context, font_desc);
    if (font == NULL) {
        guac_client_log(display->client, GUAC_LOG_INFO, "Unable to load "
                "font \"%s\"", pango_font_description_get_family(font_desc));
        pango_font_description_free(font_desc);
        return 1;
    }

    /* Get metrics from loaded font */
    PangoFontMetrics* metrics = pango_font_get_metrics(font, NULL);
    if (metrics == NULL) {
        guac_client_log(display->client, GUAC_LOG_INFO, "Unable to get font "
                "metrics for font \"%s\"",
                pango_font_description_get_family(font_desc));
        pango_font_description_free(font_desc);
        return 1;
    }

    /* Save effective size of current display */
    int pixel_width = display->width * display->char_width;
    int pixel_height = display->height * display->char_height;

    /* Calculate character dimensions using metrics */
    display->char_width =
        pango_font_metrics_get_approximate_digit_width(metrics) / PANGO_SCALE;
    display->char_height =
        (pango_font_metrics_get_descent(metrics)
            + pango_font_metrics_get_ascent(metrics)) / PANGO_SCALE;

    /* Atomically replace old font description */
    PangoFontDescription* old_font_desc = display->font_desc;
    display->font_desc = font_desc;
    pango_font_description_free(old_font_desc);

    /* Recalculate dimensions which will fit within current surface */
    int new_width = pixel_width / display->char_width;
    int new_height = pixel_height / display->char_height;

    /* Resize display if dimensions have changed */
    if (new_width != display->width || new_height != display->height)
        guac_terminal_display_resize(display, new_width, new_height);


    return 0;

}
