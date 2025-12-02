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

#ifndef GUAC_RDP_COLOR_H
#define GUAC_RDP_COLOR_H

#include <freerdp/freerdp.h>
#include <winpr/wtypes.h>

/**
 * Returns the FreeRDP pixel format ID corresponding to the 32-bit RGB format
 * used by the Cairo library's image surfaces. Cairo handles colors in terms of
 * integers in native endianness, with CAIRO_FORMAT_ARGB32 representing a color
 * format where the alpha channel is stored in the most significant byte,
 * followed by red, green, and blue. FreeRDP handles colors in terms of
 * absolute byte order, with PIXEL_FORMAT_ARGB32 representing a color format
 * where the alpha channel is in byte 0, followed by red at byte 1, etc.
 *
 * @param alpha
 *     TRUE if the returned FreeRDP pixel format should correspond to Cairo's
 *     CAIRO_FORMAT_ARGB32, FALSE if the returned format should correspond to
 *     Cairo's CAIRO_FORMAT_RGB24.
 *
 * @return
 *     The FreeRDP pixel format ID that corresponds to the 32-bit RGB format
 *     used by the Cairo library.
 */
UINT32 guac_rdp_get_native_pixel_format(BOOL alpha);

/**
 * Converts the given color to ARGB32. The color given may be an index
 * referring to the palette, a 16-bit or 32-bit color, etc. all depending on
 * the current color depth of the RDP session.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @param color
 *     A color value in the format of the current RDP session.
 *
 * @return
 *     A 32-bit ARGB color, where the low 8 bits are the blue component and
 *     the high 8 bits are alpha.
 */
UINT32 guac_rdp_convert_color(rdpContext* context, UINT32 color);

#endif

