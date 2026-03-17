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

#include "encode-jpeg.h"
#include "guacamole/mem.h"
#include "guacamole/error.h"
#include "guacamole/protocol.h"
#include "guacamole/stream.h"
#include "palette.h"

#include <cairo/cairo.h>
#include <jpeglib.h>

#include <inttypes.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/**
 * Extended version of the standard libjpeg jpeg_destination_mgr struct, which
 * provides access to the pointers to the output buffer and size. The values
 * of this structure will be initialized by jpeg_guac_dest().
 */
typedef struct guac_jpeg_destination_mgr {

    /**
     * Original jpeg_destination_mgr structure. This MUST be the first member
     * for guac_jpeg_destination_mgr to be usable as a jpeg_destination_mgr.
     */
    struct jpeg_destination_mgr parent;

    /**
     * The socket over which all JPEG blobs will be written.
     */
    guac_socket* socket;

    /**
     * The Guacamole stream to associate with each JPEG blob.
     */
    guac_stream* stream;

    /**
     * The output buffer.
     */
    unsigned char buffer[GUAC_PROTOCOL_BLOB_MAX_LENGTH];

} guac_jpeg_destination_mgr;

/**
 * Initializes the destination structure of the given compression structure.
 *
 * @param cinfo
 *     The compression structure whose destination structure should be
 *     initialized.
 */
static void guac_jpeg_init_destination(j_compress_ptr cinfo) {

    guac_jpeg_destination_mgr* dest = (guac_jpeg_destination_mgr*) cinfo->dest;

    /* Init parent destination state */
    dest->parent.next_output_byte = dest->buffer;
    dest->parent.free_in_buffer   = sizeof(dest->buffer);

}

/**
 * Flushes the current output buffer associated with the given compression
 * structure, as the current output buffer is full.
 *
 * @param cinfo
 *     The compression structure whose output buffer should be flushed.
 * 
 * @return
 *     TRUE, always, indicating that space is now available. FALSE is returned
 *     only by applications that may need additional time to empty the buffer.
 */
static boolean guac_jpeg_empty_output_buffer(j_compress_ptr cinfo) {

    guac_jpeg_destination_mgr* dest = (guac_jpeg_destination_mgr*) cinfo->dest;

    /* Write blob */
    guac_protocol_send_blob(dest->socket, dest->stream,
            dest->buffer, sizeof(dest->buffer));

    /* Update destination offset */
    dest->parent.next_output_byte = dest->buffer;
    dest->parent.free_in_buffer = sizeof(dest->buffer);

    return TRUE;

}

/**
 * Flushes the final blob of JPEG data, if any, as JPEG compression is now
 * complete.
 *
 * @param cinfo
 *     The compression structure associated with the now-complete JPEG
 *     compression operation.
 */
static void guac_jpeg_term_destination(j_compress_ptr cinfo) {

    guac_jpeg_destination_mgr* dest = (guac_jpeg_destination_mgr*) cinfo->dest;

    /* Write final blob, if any */
    if (dest->parent.free_in_buffer != sizeof(dest->buffer))
        guac_protocol_send_blob(dest->socket, dest->stream, dest->buffer,
                sizeof(dest->buffer) - dest->parent.free_in_buffer);

}

/**
 * Configures the given compression structure to use the given Guacamole stream
 * for JPEG output.
 *
 * @param cinfo
 *     The libjpeg compression structure to configure.
 *
 * @param socket
 *     The Guacamole socket to use when sending blob instructions.
 *
 * @param stream
 *     The stream over which JPEG-encoded blobs of image data should be sent.
 */
static void jpeg_guac_dest(j_compress_ptr cinfo, guac_socket* socket,
        guac_stream* stream) {

    guac_jpeg_destination_mgr* dest;

    /* Allocate dest from pool if not already allocated */
    if (cinfo->dest == NULL)
        cinfo->dest = (struct jpeg_destination_mgr*)
            (cinfo->mem->alloc_small)((j_common_ptr) cinfo, JPOOL_PERMANENT,
                    sizeof(guac_jpeg_destination_mgr));

    /* Pull possibly-new destination struct from cinfo */
    dest = (guac_jpeg_destination_mgr*) cinfo->dest;

    /* Associate destination handlers */
    dest->parent.init_destination    = guac_jpeg_init_destination;
    dest->parent.empty_output_buffer = guac_jpeg_empty_output_buffer;
    dest->parent.term_destination    = guac_jpeg_term_destination;

    /* Store Guacamole-specific objects */
    dest->socket = socket;
    dest->stream = stream;

}

int guac_jpeg_write(guac_socket* socket, guac_stream* stream,
        cairo_surface_t* surface, int quality) {

    /* Get image surface properties and data */
    cairo_format_t format = cairo_image_surface_get_format(surface);

    if (format != CAIRO_FORMAT_RGB24) {
        guac_error = GUAC_STATUS_INTERNAL_ERROR;
        guac_error_message =
            "Invalid Cairo image format. Unable to create JPEG.";
        return -1;
    }

    int width = cairo_image_surface_get_width(surface);
    int height = cairo_image_surface_get_height(surface);
    int stride = cairo_image_surface_get_stride(surface);
    unsigned char* data = cairo_image_surface_get_data(surface);

    /* Flush pending operations to surface */
    cairo_surface_flush(surface);

    /* Prepare JPEG bits */
    struct jpeg_compress_struct cinfo;
    struct jpeg_error_mgr jerr;
    cinfo.err = jpeg_std_error(&jerr);
    jpeg_create_compress(&cinfo);

    /* Write JPEG directly to given stream */
    jpeg_guac_dest(&cinfo, socket, stream);

    cinfo.image_width = width; /* image width and height, in pixels */
    cinfo.image_height = height;
    cinfo.arith_code = TRUE;

#ifdef JCS_EXTENSIONS
    /* The Turbo JPEG extensions allows us to use the Cairo surface
     * (BGRx) as input without converting it */
    cinfo.input_components = 4;
    cinfo.in_color_space = JCS_EXT_BGRX;
#else
    /* Standard JPEG supports RGB as input so we will have to convert
     * the contents of the Cairo surface from (BGRx) to RGB */
    cinfo.input_components = 3;
    cinfo.in_color_space = JCS_RGB;

    /* Create a buffer for the write scan line which is where we will
     * put the converted pixels (BGRx -> RGB) */
    unsigned char *scanline_data = guac_mem_zalloc(cinfo.image_width, cinfo.input_components);
#endif

    /* Initialize the JPEG compressor */
    jpeg_set_defaults(&cinfo);
    jpeg_set_quality(&cinfo, quality, TRUE /* limit to baseline-JPEG values */);
    jpeg_start_compress(&cinfo, TRUE);

    JSAMPROW row_pointer[1]; /* pointer to a single row */

    /* Write scanlines to be used in JPEG compression */
    while (cinfo.next_scanline < cinfo.image_height) {

        int row_offset = stride * cinfo.next_scanline;

#ifdef JCS_EXTENSIONS
        /* In Turbo JPEG we can use the raw BGRx scanline  */
        row_pointer[0] = &data[row_offset];
#else
        /* For standard JPEG libraries we have to convert the
         * scanline from 24 bit (4 byte) BGRx to 24 bit (3 byte) RGB */
        unsigned char *inptr = data + row_offset;
        unsigned char *outptr = scanline_data;

        for (int x = 0; x < width; ++x) {

            outptr[2] = *inptr++; /* B */
            outptr[1] = *inptr++; /* G */
            outptr[0] = *inptr++; /* R */
            inptr++; /* skip the upper byte (x/A) */
            outptr += 3;

        }

        row_pointer[0] = scanline_data;
#endif

        jpeg_write_scanlines(&cinfo, row_pointer, 1);
    }

#ifndef JCS_EXTENSIONS
    guac_mem_free(scanline_data);
#endif

    /* Finalize compression */
    jpeg_finish_compress(&cinfo);

    /* Clean up */
    jpeg_destroy_compress(&cinfo);
    return 0;

}

