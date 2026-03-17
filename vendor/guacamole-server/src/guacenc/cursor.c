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

#include <guacamole/mem.h>

#include <stdlib.h>

guacenc_cursor* guacenc_cursor_alloc() {

    /* Allocate new cursor */
    guacenc_cursor* cursor = (guacenc_cursor*) guac_mem_alloc(sizeof(guacenc_cursor));
    if (cursor == NULL)
        return NULL;

    /* Allocate associated buffer (image) */
    cursor->buffer = guacenc_buffer_alloc();
    if (cursor->buffer == NULL) {
        guac_mem_free(cursor);
        return NULL;
    }

    /* Do not initially render cursor, unless it moves */
    cursor->x = cursor->y = -1;

    return cursor;

}

void guacenc_cursor_free(guacenc_cursor* cursor) {

    /* Ignore NULL cursors */
    if (cursor == NULL)
        return;

    /* Free underlying buffer */
    guacenc_buffer_free(cursor->buffer);

    guac_mem_free(cursor);

}

