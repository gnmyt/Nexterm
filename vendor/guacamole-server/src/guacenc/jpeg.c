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
#include "jpeg.h"
#include "log.h"

#include <stdio.h>
#include <unistd.h>

#include <cairo/cairo.h>
#include <guacamole/mem.h>
#include <jpeglib.h>

#include <stdlib.h>

/**
 * Translates libjpeg's 24-bit RGB format into Cairo's 32-bit ARGB32 / RGB24
 * format. The red, green, and blue components from the libjpeg pixel are
 * copied verbatim, while the extra high byte used within Cairo is set to 0xFF.
 *
 * @param src
 *     A pointer to the first byte of the 24-bit RGB pixel within a libjpeg
 *     scanline buffer.
 *
 * @return
 *     A 32-bit Cairo ARGB32 / RGB24 pixel value equivalent to the libjpeg
 *     pixel at the given pointer.
 */
static uint32_t guacenc_jpeg_translate_rgb(const unsigned char* src) {

    /* Pull components from source */
    int r = *(src++);
    int g = *(src++);
    int b = *(src++);

    /* Translate to 32-bit integer compatible with Cairo */
    return 0xFF000000 | (r << 16) | (g << 8) | b;

}

/**
 * Copies the data from a libjpeg scanline buffer into a row of image data
 * within a Cairo surface, translating each pixel as necessary.
 *
 * @param dst
 *     The destination buffer into which the scanline should be copied.
 *
 * @param src
 *     The libjpeg scanline buffer that should be copied into the
 *     destination buffer.
 *
 * @param width
 *     The number of pixels available within both the scanline buffer and the
 *     destination buffer.
 */
static void guacenc_jpeg_copy_scanline(unsigned char* dst,
        const unsigned char* src, int width) {

    uint32_t* current = (uint32_t*) dst;

    /* Copy all pixels from source to destination, translating for Cairo */
    for (; width > 0; width--, src += 3) {
        *(current++) = guacenc_jpeg_translate_rgb(src);
    }

}

cairo_surface_t* guacenc_jpeg_decoder(unsigned char* data, int length) {

    struct jpeg_decompress_struct cinfo;
    struct jpeg_error_mgr jerr;

    /* Create decompressor with standard error handling */
    jpeg_create_decompress(&cinfo);
    cinfo.err = jpeg_std_error(&jerr);

    /* Read JPEG directly from memory buffer */
    jpeg_mem_src(&cinfo, data, length);

    /* Read and validate JPEG header */
    if (!jpeg_read_header(&cinfo, TRUE)) {
        guacenc_log(GUAC_LOG_WARNING, "Invalid JPEG data");
        jpeg_destroy_decompress(&cinfo);
        return NULL;
    }

    /* Begin decompression */
    cinfo.out_color_space = JCS_RGB;
    jpeg_start_decompress(&cinfo);

    /* Pull JPEG dimensions from decompressor */
    int width = cinfo.output_width;
    int height = cinfo.output_height;

    /* Allocate sufficient buffer space for one JPEG scanline */
    unsigned char* jpeg_scanline = guac_mem_alloc(width, 3);

    /* Create blank Cairo surface (no transparency in JPEG) */
    cairo_surface_t* surface = cairo_image_surface_create(CAIRO_FORMAT_RGB24,
            width, height);

    /* Pull underlying buffer and its stride */
    int stride = cairo_image_surface_get_stride(surface);
    unsigned char* row = cairo_image_surface_get_data(surface);

    /* Read JPEG into surface */
    while (cinfo.output_scanline < height) {

        /* Read single scanline */
        unsigned char* buffers[1] = { jpeg_scanline };
        jpeg_read_scanlines(&cinfo, buffers, 1);

        /* Copy scanline to Cairo surface */
        guacenc_jpeg_copy_scanline(row, jpeg_scanline, width);

        /* Advance to next row of Cairo surface */
        row += stride;

    }

    /* Scanline buffer is no longer needed */
    guac_mem_free(jpeg_scanline);

    /* End decompression */
    jpeg_finish_decompress(&cinfo);

    /* Free decompressor */
    jpeg_destroy_decompress(&cinfo);

    /* JPEG was read successfully */
    return surface;

}

