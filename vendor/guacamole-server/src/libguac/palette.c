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

#include "guacamole/mem.h"
#include "palette.h"

#include <cairo/cairo.h>

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

guac_palette* guac_palette_alloc(cairo_surface_t* surface) {

    int x, y;

    int width = cairo_image_surface_get_width(surface);
    int height = cairo_image_surface_get_height(surface);
    int stride = cairo_image_surface_get_stride(surface);
    unsigned char* data = cairo_image_surface_get_data(surface);

    /* Allocate palette */
    guac_palette* palette = (guac_palette*) guac_mem_zalloc(sizeof(guac_palette));

    for (y=0; y<height; y++) {
        for (x=0; x<width; x++) {

            /* Get pixel color */
            int color = ((uint32_t*) data)[x] & 0xFFFFFF;

            /* Calculate hash code */
            int hash = ((color & 0xFFF000) >> 12) ^ (color & 0xFFF);

            guac_palette_entry* entry;

            /* Search for open palette entry */
            for (;;) {
                
                entry = &(palette->entries[hash]);

                /* If we've found a free space, use it */
                if (entry->index == 0) {

                    png_color* c;

                    /* Stop if already at capacity */
                    if (palette->size == 256) {
                        guac_palette_free(palette);
                        return NULL;
                    }

                    /* Store in palette */
                    c = &(palette->colors[palette->size]);
                    c->blue  = (color      ) & 0xFF;
                    c->green = (color >> 8 ) & 0xFF;
                    c->red   = (color >> 16) & 0xFF;

                    /* Add color to map */
                    entry->index = ++palette->size;
                    entry->color = color;

                    break;

                }

                /* Otherwise, if already stored here, done */
                if (entry->color == color)
                    break;

                /* Otherwise, collision. Move on to another bucket */
                hash = (hash+1) & 0xFFF;

            }
        }

        /* Advance to next data row */
        data += stride;

    }

    return palette;

}

int guac_palette_find(guac_palette* palette, int color) {

    /* Calculate hash code */
    int hash = ((color & 0xFFF000) >> 12) ^ (color & 0xFFF);

    guac_palette_entry* entry;

    /* Search for palette entry */
    for (;;) {
        
        entry = &(palette->entries[hash]);

        /* If we've found a free space, color not stored. */
        if (entry->index == 0)
            return -1;

        /* Otherwise, if color indeed stored here, done */
        if (entry->color == color)
            return entry->index - 1;

        /* Otherwise, collision. Move on to another bucket */
        hash = (hash+1) & 0xFFF;

    }

}

void guac_palette_free(guac_palette* palette) {
    guac_mem_free(palette);
}

