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

#include "channels/disp.h"
#include "plugins/channels.h"
#include "fs.h"
#include "rdp.h"
#include "settings.h"

#include <freerdp/client/disp.h>
#include <freerdp/freerdp.h>
#include <freerdp/event.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/protocol-constants.h>
#include <guacamole/rect.h>
#include <guacamole/timestamp.h>

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/**
 * The maximum size of the JSON string describing the layout of all monitors,
 * in bytes, including the null terminator.
 */
#define GUAC_RDP_MULTIMON_LAYOUT_MAX_LENGTH 2048

guac_rdp_disp* guac_rdp_disp_alloc(guac_client* client) {

    guac_rdp_disp* disp = guac_mem_alloc(sizeof(guac_rdp_disp));
    disp->client = client;

    /* Not yet connected */
    disp->disp = NULL;

    /* No requests have been made */
    disp->last_request = guac_timestamp_current();
    disp->reconnect_needed = 0;
    disp->resize_needed = false;

    /* Init first monitor */
    disp->monitors = guac_mem_alloc(sizeof(guac_rdp_disp_monitor));
    disp->monitors[0].requested_width  = 0;
    disp->monitors[0].requested_height = 0;
    disp->monitors[0].x_position  = 0;
    disp->monitors[0].top_offset  = 0;
    disp->monitors[0].left_offset = 0;
    disp->monitors_count = 1;

    return disp;

}

void guac_rdp_disp_free(guac_rdp_disp* disp) {
    guac_mem_free(disp->monitors);
    guac_mem_free(disp);
}

/**
 * Callback which associates handlers specific to Guacamole with the
 * DispClientContext instance allocated by FreeRDP to deal with received
 * Display Update (client-initiated dynamic display resizing) messages.
 *
 * This function is called whenever a channel connects via the PubSub event
 * system within FreeRDP, but only has any effect if the connected channel is
 * the Display Update channel. This specific callback is registered with the
 * PubSub system of the relevant rdpContext when guac_rdp_disp_load_plugin() is
 * called.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 *
 * @param args
 *     Event-specific arguments, mainly the name of the channel, and a
 *     reference to the associated plugin loaded for that channel by FreeRDP.
 */
static void guac_rdp_disp_channel_connected(rdpContext* context,
        ChannelConnectedEventArgs* args) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_disp* guac_disp = rdp_client->disp;

    /* Ignore connection event if it's not for the Display Update channel */
    if (strcmp(args->name, DISP_DVC_CHANNEL_NAME) != 0)
        return;

    /* Init module with current display size */
    guac_rdp_disp_set_size(guac_disp, rdp_client->settings,
            context->instance, guac_rdp_get_width(context->instance),
            guac_rdp_get_height(context->instance), 0, 0);

    /* Store reference to the display update plugin once it's connected */
    DispClientContext* disp = (DispClientContext*) args->pInterface;
    guac_disp->disp = disp;

    guac_client_log(client, GUAC_LOG_DEBUG, "Display update channel "
            "will be used for display size changes.");

}

/**
 * Callback which disassociates Guacamole from the DispClientContext instance
 * that was originally allocated by FreeRDP and is about to be deallocated.
 *
 * This function is called whenever a channel disconnects via the PubSub event
 * system within FreeRDP, but only has any effect if the disconnected channel
 * is the Display Update channel. This specific callback is registered with the
 * PubSub system of the relevant rdpContext when guac_rdp_disp_load_plugin() is
 * called.
 *
 * @param context
 *     The rdpContext associated with the active RDP session.
 *
 * @param args
 *     Event-specific arguments, mainly the name of the channel, and a
 *     reference to the associated plugin loaded for that channel by FreeRDP.
 */
static void guac_rdp_disp_channel_disconnected(rdpContext* context,
        ChannelDisconnectedEventArgs* args) {

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_disp* guac_disp = rdp_client->disp;

    /* Ignore disconnection event if it's not for the Display Update channel */
    if (strcmp(args->name, DISP_DVC_CHANNEL_NAME) != 0)
        return;

    /* Channel is no longer connected */
    guac_disp->disp = NULL;

    guac_client_log(client, GUAC_LOG_DEBUG, "Display update channel "
            "disconnected.");

}

void guac_rdp_disp_load_plugin(rdpContext* context) {

    /* Subscribe to and handle channel connected events */
    PubSub_SubscribeChannelConnected(context->pubSub,
        (pChannelConnectedEventHandler) guac_rdp_disp_channel_connected);

    /* Subscribe to and handle channel disconnected events */
    PubSub_SubscribeChannelDisconnected(context->pubSub,
            (pChannelDisconnectedEventHandler) guac_rdp_disp_channel_disconnected);

    /* Add "disp" channel */
    guac_freerdp_dynamic_channel_collection_add(context->settings, "disp", NULL);

}

/**
 * Reallocates the monitors to the given size.
 *
 * @param disp
 *     The display update module to reallocate.
 *
 * @param requested_monitors
 *     The number of monitors to allocate.
 */
static void guac_rdp_disp_realloc_monitors(guac_rdp_disp* disp,
        int requested_monitors) {

    /* No need to reallocate if the number of monitors is unchanged */
    if (disp->monitors_count == requested_monitors)
        return;

    disp->monitors = guac_mem_realloc_or_die(disp->monitors,
            requested_monitors, sizeof(guac_rdp_disp_monitor));

    disp->monitors_count = requested_monitors;

}

/**
 * Returns the x-offset of the monitor at the given position from the left edge
 * of the screen.
 *
 * @param disp
 *     The display update module to query.
 *
 * @param x_position
 *     The position of the monitor to query.
 *
 * @return
 *     The offset of the monitor at the given position from the left edge of
 *     the screen, in pixels.
 */
static int guac_rdp_disp_get_left_offset(const guac_rdp_disp* disp,
        int x_position) {

    int x_offset = 0;

    /* Calculate the offset of the monitor from the left edge of the screen */
    for (int i = 0; i < x_position; i++)
        x_offset += disp->monitors[i].requested_width;

    return x_offset;

}

/**
 * Returns the "total" height of all monitors. This is not the sum of the
 * heights of all monitors, but rather the height of the entire screen.
 * It is the subtraction of the lowest point by the highest point.
 *
 * @param disp
 *     The display update module to query.
 *
 * @return
 *     The total height of the display, in pixels.
 */
static int guac_rdp_disp_get_total_height(const guac_rdp_disp* disp) {

    int min_offset = 0;
    int max_bottom = 0;

    /* Loop through all monitors to find the maximum height */
    for (int i = 0; i < disp->monitors_count; i++) {

        int requested_height = disp->monitors[i].requested_height;
        int top_offset = disp->monitors[i].top_offset;

        /* Find the highest point of the screen (the lowest top offset) */
        if (top_offset < min_offset)
            min_offset = top_offset;

        /* Find the lowest point of the screen */
        if (top_offset + requested_height > max_bottom)
            max_bottom = top_offset + requested_height;

    }

    return max_bottom - min_offset;

}

/**
 * Closes the monitor at the given position, if possible. The primary monitor
 * can never be closed. Any monitors positioned after the closed monitor are
 * shifted down to fill the gap.
 *
 * @param disp
 *     The display update module to close the monitor of.
 *
 * @param x_position
 *     The position of the monitor to close.
 *
 * @return
 *     true if the monitor was closed, false otherwise.
 */
static bool guac_rdp_disp_close_monitor(guac_rdp_disp* disp, int x_position) {

    int max_position = disp->monitors_count - 1;

    /* Primary monitor or invalid position */
    if (x_position <= 0 || x_position > max_position)
        return false;

    /* The monitor to close is not the last one, so copy memory after it to
     * preserve those positioned after it */
    if (x_position != max_position) {
        int move_count = max_position - x_position;
        memmove(&disp->monitors[x_position],
                &disp->monitors[x_position + 1],
                move_count * sizeof(guac_rdp_disp_monitor));
    }

    /* Deallocate a monitor */
    guac_rdp_disp_realloc_monitors(disp, max_position);

    /* Monitors shifted down by the above move are now at new positions, and
     * their offsets from the left edge of the screen must be recalculated
     * accordingly */
    for (int i = x_position; i < disp->monitors_count; i++) {
        disp->monitors[i].x_position = i;
        disp->monitors[i].left_offset = guac_rdp_disp_get_left_offset(disp, i);
    }

    disp->resize_needed = true;

    return true;

}

void guac_rdp_disp_set_size(guac_rdp_disp* disp, guac_rdp_settings* settings,
        freerdp* rdp_inst, int width, int height, int x_position,
        int top_offset) {

    int min_monitors_requested = x_position + 1;

    /* Add one to account for the primary monitor */
    int max_monitors = settings->max_secondary_monitors + 1;

    /* Ignore invalid requests:
     * - Invalid monitor index.
     * - Too many monitors requested.
     * - Missing intermediate monitor(s).
     */
    if (x_position < 0 || max_monitors < min_monitors_requested
            || disp->monitors_count + 1 < min_monitors_requested)
        return;

    guac_rect resize = {
        .left = 0,
        .top = 0,
        .right = width,
        .bottom = height
    };

    /* Fit width and height within bounds, maintaining aspect ratio */
    guac_rect_shrink(&resize, GUAC_RDP_DISP_MAX_SIZE, GUAC_RDP_DISP_MAX_SIZE);

    width = guac_rect_width(&resize);
    height = guac_rect_height(&resize);

    if (width > 0 && height > 0) {

        /* As it's possible for a rectangle to exceed the maximum allowed
         * dimensions, yet fall below the minimum allowed dimensions once
         * adjusted, we don't bother preserving aspect ratio for the unlikely
         * case that a dimension is below the minimums (consider a rectangle
         * like 16384x256) */
        if (width  < GUAC_RDP_DISP_MIN_SIZE) width  = GUAC_RDP_DISP_MIN_SIZE;
        if (height < GUAC_RDP_DISP_MIN_SIZE) height = GUAC_RDP_DISP_MIN_SIZE;

        /* Width must be even */
        if (width % 2 == 1)
            width -= 1;

        /* Reallocate monitors if needed */
        if (disp->monitors_count < min_monitors_requested)
            guac_rdp_disp_realloc_monitors(disp, min_monitors_requested);

        guac_rdp_disp_monitor* monitor = &disp->monitors[x_position];
        int left_offset = guac_rdp_disp_get_left_offset(disp, x_position);

        /* Store deferred size if changed */
        if (monitor->requested_width == width
                && monitor->requested_height == height
                && monitor->x_position == x_position
                && monitor->top_offset == top_offset
                && monitor->left_offset == left_offset)
            return;

        disp->resize_needed       = true;
        monitor->requested_width  = width;
        monitor->requested_height = height;
        monitor->x_position       = x_position;
        monitor->top_offset       = top_offset;
        monitor->left_offset      = left_offset;

    }

    /* Try to close monitor or ignore request */
    else if (!guac_rdp_disp_close_monitor(disp, x_position))
        return;

    /* Send display update notification if possible */
    guac_rdp_disp_update_size(disp, settings, rdp_inst);

}

void guac_rdp_disp_update_size(guac_rdp_disp* disp,
        guac_rdp_settings* settings, freerdp* rdp_inst) {

    guac_timestamp now = guac_timestamp_current();

    /* Limit display update frequency */
    if (now - disp->last_request <= GUAC_RDP_DISP_UPDATE_INTERVAL)
        return;

    int monitors_count = disp->monitors_count;
    int width = guac_rdp_disp_get_left_offset(disp, monitors_count);
    int height = guac_rdp_disp_get_total_height(disp);

    /* Do not update size if no requests have been received */
    if (width == 0 || height == 0)
        return;

    /* Do NOT send requests unless the layout will change */
    if (rdp_inst != NULL && !disp->resize_needed)
        return;

    disp->last_request = now;
    disp->resize_needed = false;

    if (settings->resize_method == GUAC_RESIZE_RECONNECT) {

        /* Update settings with new dimensions */
        settings->width = width;
        settings->height = height;

        /* Signal reconnect */
        disp->reconnect_needed = 1;

    }

    /* Send display update notification if display channel is connected */
    else if (settings->resize_method == GUAC_RESIZE_DISPLAY_UPDATE
                && disp->disp != NULL) {

        /* Init monitors layout */
        DISPLAY_CONTROL_MONITOR_LAYOUT* monitors = guac_mem_alloc(
                monitors_count, sizeof(DISPLAY_CONTROL_MONITOR_LAYOUT));

        for (int i = 0; i < monitors_count; i++) {

            /* First monitor is the primary */
            int primary_monitor = (i == 0 ? 1 : 0);

            /* Set current monitor properties */
            monitors[i].Flags = primary_monitor;
            monitors[i].Left = disp->monitors[i].left_offset;
            monitors[i].Top = disp->monitors[i].top_offset;
            monitors[i].Width = disp->monitors[i].requested_width;
            monitors[i].Height = disp->monitors[i].requested_height;
            monitors[i].Orientation = 0;
            monitors[i].PhysicalWidth = 0;
            monitors[i].PhysicalHeight = 0;
            monitors[i].DesktopScaleFactor = 0;
            monitors[i].DeviceScaleFactor = 0;

        }

        /* Send display update notification */
        guac_client* client = disp->client;
        guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

        pthread_mutex_lock(&(rdp_client->message_lock));
        disp->disp->SendMonitorLayout(disp->disp, monitors_count, monitors);
        pthread_mutex_unlock(&(rdp_client->message_lock));

        guac_mem_free(monitors);

    }

}

int guac_rdp_disp_reconnect_needed(guac_rdp_disp* disp) {
    guac_rdp_client* rdp_client = (guac_rdp_client*) disp->client->data;

    /* Do not reconnect if files are open. */
    if (rdp_client->filesystem != NULL
            && rdp_client->filesystem->open_files > 0)
        return 0;

    /* Do not reconnect if an active print job is present */
    if (rdp_client->active_job != NULL)
        return 0;
    
    
    return disp->reconnect_needed;
}

void guac_rdp_disp_reconnect_complete(guac_rdp_disp* disp) {
    disp->reconnect_needed = 0;
    disp->last_request = guac_timestamp_current();
}

void guac_rdp_disp_send_multimon_layout(guac_client* client,
        guac_rdp_disp* disp, guac_socket* socket) {

    char json[GUAC_RDP_MULTIMON_LAYOUT_MAX_LENGTH];
    int pos = 0;
    bool first = true;

    json[pos++] = '{';

    for (int i = 0; i < disp->monitors_count; i++) {

        /* Skip monitors that have not been initialized yet */
        if (disp->monitors[i].requested_width == 0
                || disp->monitors[i].requested_height == 0)
            continue;

        /* Reserve one byte for the closing brace */
        int remaining = GUAC_RDP_MULTIMON_LAYOUT_MAX_LENGTH - pos - 1;

        int written = snprintf(json + pos, remaining,
                "%s\"%i\":{\"left\":%i,\"top\":%i,\"width\":%i,\"height\":%i}",
                first ? "" : ",", i,
                disp->monitors[i].left_offset,
                disp->monitors[i].top_offset,
                disp->monitors[i].requested_width,
                disp->monitors[i].requested_height);

        /* Abandon the layout entirely if it would not fit, rather than send
         * truncated JSON that the client cannot parse */
        if (written < 0 || written >= remaining) {
            guac_client_log(client, GUAC_LOG_WARNING, "Layout of %i monitor(s) "
                    "does not fit within %i bytes and will not be sent.",
                    disp->monitors_count, GUAC_RDP_MULTIMON_LAYOUT_MAX_LENGTH);
            return;
        }

        pos += written;
        first = false;

    }

    json[pos++] = '}';
    json[pos] = '\0';

    /* The combined display is always rendered to the default layer (see
     * guac_display_default_layer()) */
    guac_protocol_send_set(socket, GUAC_DEFAULT_LAYER,
            GUAC_PROTOCOL_LAYER_PARAMETER_MULTIMON_LAYOUT, json);

}

