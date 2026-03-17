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

#ifndef __GUAC_PALETTE_H
#define __GUAC_PALETTE_H

#include <cairo/cairo.h>
#include <png.h>

typedef struct guac_palette_entry {

    int index;
    int color;

} guac_palette_entry;

typedef struct guac_palette {

    guac_palette_entry entries[0x1000];
    png_color colors[256];
    int size;

} guac_palette;

guac_palette* guac_palette_alloc(cairo_surface_t* surface);
int guac_palette_find(guac_palette* palette, int color);
void guac_palette_free(guac_palette* palette);

#endif

