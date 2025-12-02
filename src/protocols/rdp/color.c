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
#include "settings.h"

#include <freerdp/codec/color.h>
#include <freerdp/freerdp.h>
#include <freerdp/gdi/gdi.h>
#include <winpr/wtypes.h>

#include <stdint.h>
#include <string.h>

UINT32 guac_rdp_get_native_pixel_format(BOOL alpha) {

    uint32_t int_value;
    uint8_t raw_bytes[4] = { 0x0A, 0x0B, 0x0C, 0x0D };

    memcpy(&int_value, raw_bytes, sizeof(raw_bytes));

    /* Local platform stores bytes in decreasing order of significance
     * (big-endian) */
    if (int_value == 0x0A0B0C0D)
        return alpha ? PIXEL_FORMAT_ARGB32 : PIXEL_FORMAT_XRGB32;

    /* Local platform stores bytes in increasing order of significance
     * (little-endian) */
    else
        return alpha ? PIXEL_FORMAT_BGRA32 : PIXEL_FORMAT_BGRX32;

}

UINT32 guac_rdp_convert_color(rdpContext* context, UINT32 color) {

    int depth = guac_rdp_get_depth(context->instance);
    int src_format = gdi_get_pixel_format(depth);
    int dst_format = guac_rdp_get_native_pixel_format(TRUE);
    rdpGdi* gdi = context->gdi;

    /* Convert provided color into the intermediate representation expected by
     * FreeRDPConvertColor() */
    UINT32 intermed;
#ifdef USE_UPDATED_RW_COLOR_FUNCS
    intermed = FreeRDPReadColor((BYTE*) &color, src_format);
#else
    intermed = ReadColor((BYTE*) &color, src_format);
#endif

    /* Convert color from RDP source format to the native format used by Cairo,
     * still maintaining intermediate representation */
#ifdef HAVE_FREERDPCONVERTCOLOR
    intermed = FreeRDPConvertColor(intermed, src_format, dst_format,
            &gdi->palette);
#else
    intermed = ConvertColor(intermed, src_format, dst_format, &gdi->palette);
#endif

    /* Convert color from intermediate representation to the actual desired
     * format */
#ifdef USE_UPDATED_RW_COLOR_FUNCS
    intermed = FreeRDPWriteColor((BYTE*) &color, dst_format, intermed);
#else
    intermed = WriteColor((BYTE*) &color, dst_format, intermed);
#endif

    return color;

}
