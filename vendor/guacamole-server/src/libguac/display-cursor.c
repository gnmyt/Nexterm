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

#include "display-builtin-cursors.h"
#include "display-priv.h"
#include "guacamole/assert.h"
#include "guacamole/display.h"
#include "guacamole/mem.h"
#include "guacamole/rect.h"
#include "guacamole/rwlock.h"

#include <string.h>

guac_display_layer* guac_display_cursor(guac_display* display) {
    return display->cursor_buffer;
}

void guac_display_set_cursor_hotspot(guac_display* display, int x, int y) {
    guac_rwlock_acquire_write_lock(&display->pending_frame.lock);

    display->pending_frame.cursor_hotspot_x = x;
    display->pending_frame.cursor_hotspot_y = y;

    guac_rwlock_release_lock(&display->pending_frame.lock);
}

void guac_display_set_cursor(guac_display* display,
        guac_display_cursor_type cursor_type) {

    /* Translate requested type into built-in cursor */
    const guac_display_builtin_cursor* cursor;
    switch (cursor_type) {

        case GUAC_DISPLAY_CURSOR_NONE:
            cursor = &guac_display_cursor_none;
            break;

        case GUAC_DISPLAY_CURSOR_DOT:
            cursor = &guac_display_cursor_dot;
            break;

        case GUAC_DISPLAY_CURSOR_IBAR:
            cursor = &guac_display_cursor_ibar;
            break;

        case GUAC_DISPLAY_CURSOR_POINTER:
        default:
            cursor = &guac_display_cursor_pointer;
            break;

    }

    /* Resize cursor to fit requested icon */
    guac_display_layer* cursor_layer = guac_display_cursor(display);
    guac_display_layer_resize(cursor_layer, cursor->width, cursor->height);

    /* Copy over graphical content of cursor icon ... */

    guac_display_layer_raw_context* context = guac_display_layer_open_raw(cursor_layer);
    GUAC_ASSERT(!cursor_layer->pending_frame.buffer_is_external);

    const unsigned char* src_cursor_row = cursor->buffer;
    unsigned char* dst_cursor_row = context->buffer;
    size_t row_length = guac_mem_ckd_mul_or_die(cursor->width, 4);

    for (int y = 0; y < cursor->height; y++) {
        memcpy(dst_cursor_row, src_cursor_row, row_length);
        src_cursor_row += cursor->stride;
        dst_cursor_row += context->stride;
    }

    /* ... and cursor hotspot */
    guac_display_set_cursor_hotspot(display, cursor->hotspot_x, cursor->hotspot_y);

    /* Update to cursor icon is now complete - notify display */

    context->dirty = (guac_rect) {
        .left   = 0,
        .top    = 0,
        .right  = cursor->width,
        .bottom = cursor->height
    };

    guac_display_layer_close_raw(cursor_layer, context);

    guac_display_end_mouse_frame(display);

}
