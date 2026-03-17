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

#ifndef GUAC_RDP_GDI_H
#define GUAC_RDP_GDI_H

#include "config.h"

#include <freerdp/freerdp.h>
#include <guacamole/protocol.h>

/**
 * Notifies the internal GDI implementation that a frame is either starting or
 * ending. If the frame is ending and the connected client is ready to receive
 * a new frame, a new frame will be flushed to the client.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @param starting
 *     Non-zero if the frame in question is starting, zero if the frame is
 *     ending.
 */
void guac_rdp_gdi_mark_frame(rdpContext* context, int starting);

/**
 * Handler called when a frame boundary is received from the RDP server in the
 * form of a frame marker command. Each frame boundary may be the beginning or
 * the end of a frame.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @param frame_marker
 *     The received frame marker.
 *
 * @return
 *     TRUE if successful, FALSE otherwise.
 */
BOOL guac_rdp_gdi_frame_marker(rdpContext* context, const FRAME_MARKER_ORDER* frame_marker);

/**
 * Handler called when a frame boundary is received from the RDP server in the
 * form of a surface frame marker. Each frame boundary may be the beginning or
 * the end of a frame.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @param surface_frame_marker
 *     The received frame marker.
 *
 * @return
 *     TRUE if successful, FALSE otherwise.
 */
BOOL guac_rdp_gdi_surface_frame_marker(rdpContext* context, const SURFACE_FRAME_MARKER* surface_frame_marker);

/**
 * Handler called when a paint operation is beginning. This function is
 * expected to be called by the FreeRDP GDI implementation of RemoteFX when a
 * new frame has started.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @return
 *     TRUE if successful, FALSE otherwise.
 */
BOOL guac_rdp_gdi_begin_paint(rdpContext* context);

/**
 * Handler called when FreeRDP has finished performing updates to the backing
 * surface of its GDI (graphics) implementation.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @return
 *     TRUE if successful, FALSE otherwise.
 */
BOOL guac_rdp_gdi_end_paint(rdpContext* context);

/**
 * Handler called when the desktop dimensions change, either from a
 * true desktop resize event received by the RDP client, or due to
 * a revised size given by the server during initial connection
 * negotiation.
 *
 * The new screen size will be made available within the settings associated
 * with the given context.
 *
 * @param context
 *     The rdpContext associated with the current RDP session.
 *
 * @return
 *     TRUE if successful, FALSE otherwise.
 */
BOOL guac_rdp_gdi_desktop_resize(rdpContext* context);

#endif
