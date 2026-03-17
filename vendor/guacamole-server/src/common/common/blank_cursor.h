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

#ifndef GUAC_COMMON_BLANK_CURSOR_H
#define GUAC_COMMON_BLANK_CURSOR_H

#include "config.h"

#include <cairo/cairo.h>
#include <guacamole/user.h>

/**
 * Width of the embedded transparent (blank) mouse cursor graphic.
 */
extern const int guac_common_blank_cursor_width;

/**
 * Height of the embedded transparent (blank) mouse cursor graphic.
 */
extern const int guac_common_blank_cursor_height;

/**
 * Number of bytes in each row of the embedded transparent (blank) mouse cursor
 * graphic.
 */
extern const int guac_common_blank_cursor_stride;

/**
 * The Cairo grapic format of the transparent (blank) mouse cursor graphic.
 */
extern const cairo_format_t guac_common_blank_cursor_format;

/**
 * Embedded transparent (blank) mouse cursor graphic.
 */
extern unsigned char guac_common_blank_cursor[];

/**
 * Sets the cursor of the remote display to the embedded transparent (blank)
 * cursor graphic.
 *
 * @param user
 *     The guac_user to send the cursor to.
 */
void guac_common_set_blank_cursor(guac_user* user);

#endif

