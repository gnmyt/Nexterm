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

#include "color.h"
#include "rdp.h"
#include "settings.h"

#include <cairo/cairo.h>
#include <freerdp/freerdp.h>
#include <freerdp/gdi/gdi.h>
#include <freerdp/graphics.h>
#include <freerdp/primary.h>
#include <freerdp/version.h>
#include <guacamole/assert.h>
#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/protocol.h>
#include <winpr/wtypes.h>

#include <stddef.h>

void guac_rdp_gdi_mark_frame(rdpContext* context, int starting) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* A new frame has been received from the RDP server and processed */
    if (!starting)
        guac_display_render_thread_notify_frame(rdp_client->render_thread);

}

BOOL guac_rdp_gdi_frame_marker(rdpContext* context, const FRAME_MARKER_ORDER* frame_marker) {
    guac_rdp_gdi_mark_frame(context, frame_marker->action == FRAME_START);
    return TRUE;
}

BOOL guac_rdp_gdi_surface_frame_marker(rdpContext* context, const SURFACE_FRAME_MARKER* surface_frame_marker) {

    guac_rdp_gdi_mark_frame(context, surface_frame_marker->frameAction != SURFACECMD_FRAMEACTION_END);

    int frame_acknowledge;
#ifdef HAVE_SETTERS_GETTERS
    frame_acknowledge = freerdp_settings_get_uint32(context->settings, FreeRDP_FrameAcknowledge);
#else
    frame_acknowledge = context->settings->FrameAcknowledge;
#endif

    if (frame_acknowledge > 0)
        IFCALL(context->update->SurfaceFrameAcknowledge, context,
                surface_frame_marker->frameId);

    return TRUE;

}

BOOL guac_rdp_gdi_begin_paint(rdpContext* context) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    rdpGdi* gdi = context->gdi;

    GUAC_ASSERT(rdp_client->current_context == NULL);

    /* All potential drawing operations must occur while holding an open context */
    guac_display_layer* default_layer = guac_display_default_layer(rdp_client->display);
    guac_display_layer_raw_context* current_context = guac_display_layer_open_raw(default_layer);
    rdp_client->current_context = current_context;

    /* Resynchronize default layer buffer details with FreeRDP's GDI */
    current_context->buffer = gdi->primary_buffer;
    current_context->stride = gdi->stride;
    guac_rect_init(&current_context->bounds, 0, 0, gdi->width, gdi->height);

    return TRUE;

}

BOOL guac_rdp_gdi_end_paint(rdpContext* context) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    rdpGdi* gdi = context->gdi;

    guac_display_layer* default_layer = guac_display_default_layer(rdp_client->display);
    guac_display_layer_raw_context* current_context = rdp_client->current_context;

    /* Handle the case where EndPaint was called without a preceding BeginPaint.
     * This can occur during screen resize events in "display-update" mode with
     * FreeRDP version 3.8.0 or later, where EndPaint is called to ensure the
     * update-lock is released and data is flushed before resizing. See the
     * associated FreeRDP PR: https://github.com/FreeRDP/FreeRDP/pull/10488 */
    if (current_context == NULL)
        return TRUE;

    /* Ignore paint if GDI output is suppressed */
    if (gdi->suppressOutput)
        goto paint_complete;

    /* Ignore paint if nothing has been done (empty rect) */
    if (gdi->primary->hdc->hwnd->invalid->null)
        goto paint_complete;

    INT32 x = gdi->primary->hdc->hwnd->invalid->x;
    INT32 y = gdi->primary->hdc->hwnd->invalid->y;
    UINT32 w = gdi->primary->hdc->hwnd->invalid->w;
    UINT32 h = gdi->primary->hdc->hwnd->invalid->h;

    /* guac_rect uses signed arithmetic for all values. While FreeRDP
     * definitely performs its own checks and ensures these values cannot get
     * so large as to cause problems with signed arithmetic, it's worth
     * checking and bailing out here if an external bug breaks that. */
    GUAC_ASSERT(w <= INT_MAX && h <= INT_MAX);

    /* Mark modified region as dirty, but only within the bounds of the
     * rendering surface */
    guac_rect dst_rect;
    guac_rect_init(&dst_rect, x, y, w, h);
    guac_rect_constrain(&dst_rect, &current_context->bounds);
    guac_rect_extend(&current_context->dirty, &dst_rect);

    rdp_client->gdi_modified = 1;

paint_complete:

    /* Clear GDI state for future draws */
    gdi->primary->hdc->hwnd->invalid->null = TRUE;
    gdi->primary->hdc->hwnd->ninvalid = 0;

    /* There will be no further drawing operations */
    rdp_client->current_context = NULL;
    guac_display_layer_close_raw(default_layer, current_context);

    return TRUE;

}

BOOL guac_rdp_gdi_desktop_resize(rdpContext* context) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    rdpGdi* gdi = context->gdi;

    int width = guac_rdp_get_width(context->instance);
    int height = guac_rdp_get_height(context->instance);

#if (FREERDP_VERSION_MAJOR < 3) || \
    (FREERDP_VERSION_MAJOR == 3 && FREERDP_VERSION_MINOR < 8)
    /* For FreeRDP versions prior to 3.8.0, EndPaint will not be called in
     * `gdi_resize()`, so the current context should be NULL. If it is not
     * NULL, it means that the current context is still open, and therefore the
     * GDI buffer has not been flushed yet. */
    GUAC_ASSERT(rdp_client->current_context == NULL);
#endif

    /* All potential drawing operations must occur while holding an open context */
    guac_display_layer* default_layer = guac_display_default_layer(rdp_client->display);
    guac_display_layer_raw_context* current_context = guac_display_layer_open_raw(default_layer);

    /* Resize FreeRDP's GDI buffer */
    BOOL retval = gdi_resize(context->gdi, width, height);
    GUAC_ASSERT(gdi->primary_buffer != NULL);

    /* Update our reference to the GDI buffer, as well as any structural
     * details, which may now all be different */
    current_context->buffer = gdi->primary_buffer;
    current_context->stride = gdi->stride;
    guac_rect_init(&current_context->bounds, 0, 0, gdi->width, gdi->height);

    /* Resize layer to match new display dimensions and underlying buffer */
    guac_display_layer_resize(default_layer, gdi->width, gdi->height);
    guac_client_log(client, GUAC_LOG_DEBUG, "Server resized display to %ix%i",
            gdi->width, gdi->height);

    guac_display_layer_close_raw(default_layer, current_context);

    return retval;

}
