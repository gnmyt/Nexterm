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

#include "config.h"
#include "buffer.h"
#include "cursor.h"
#include "display.h"
#include "log.h"

#include <guacamole/client.h>

#include <stdlib.h>

int guacenc_handle_cursor(guacenc_display* display, int argc, char** argv) {

    /* Verify argument count */
    if (argc < 7) {
        guacenc_log(GUAC_LOG_WARNING, "\"cursor\" instruction incomplete");
        return 1;
    }

    /* Parse arguments */
    int hotspot_x = atoi(argv[0]);
    int hotspot_y = atoi(argv[1]);
    int sindex = atoi(argv[2]);
    int sx = atoi(argv[3]);
    int sy = atoi(argv[4]);
    int width = atoi(argv[5]);
    int height = atoi(argv[6]);

    /* Pull buffer of source layer/buffer */
    guacenc_buffer* src = guacenc_display_get_related_buffer(display, sindex);
    if (src == NULL)
        return 1;

    /* Update cursor hotspot */
    guacenc_cursor* cursor = display->cursor;
    cursor->hotspot_x = hotspot_x;
    cursor->hotspot_y = hotspot_y;

    /* Resize cursor to exactly fit */
    guacenc_buffer_resize(cursor->buffer, width, height);

    /* Copy rectangle from source to cursor */
    guacenc_buffer* dst = cursor->buffer;
    if (src->surface != NULL && dst->cairo != NULL) {
        cairo_set_operator(dst->cairo, CAIRO_OPERATOR_SOURCE);
        cairo_set_source_surface(dst->cairo, src->surface, sx, sy);
        cairo_paint(dst->cairo);
    }

    return 0;

}

