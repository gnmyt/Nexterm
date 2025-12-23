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

#ifndef GUAC_VNC_CURSOR_H
#define GUAC_VNC_CURSOR_H

#include "config.h"

#include <rfb/rfbclient.h>
#include <rfb/rfbproto.h>

/**
 * Callback invoked by libVNCServer when it receives a new cursor image from
 * the VNC server. The cursor image itself will be split across
 * client->rcSource and client->rcMask, where rcSource is an image buffer of
 * the format natively used by the current VNC connection, and rcMask is an
 * array if bitmasks. Each bit within rcMask corresponds to a pixel within
 * rcSource, where a 0 denotes full transparency and a 1 denotes full opacity.
 *
 * @param client
 *     The VNC client associated with the VNC session in which the new cursor
 *     image was received.
 *
 * @param x
 *     The X coordinate of the new cursor image's hotspot, in pixels.
 *
 * @param y
 *     The Y coordinate of the new cursor image's hotspot, in pixels.
 *
 * @param w
 *     The width of the cursor image, in pixels.
 *
 * @param h
 *     The height of the cursor image, in pixels.
 *
 * @param vnc_bpp
 *     The number of bytes in each pixel, which must be either 4, 2, or 1.
 */
void guac_vnc_cursor(rfbClient* client, int x, int y, int w, int h, int vnc_bpp);

#endif

