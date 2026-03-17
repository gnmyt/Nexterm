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

#include "channels/audio-input/audio-input.h"
#include "channels/cliprdr.h"
#include "channels/pipe-svc.h"
#include "config.h"
#include "input.h"
#include "rdp.h"
#include "settings.h"
#include "upload.h"
#include "user.h"

#ifdef ENABLE_COMMON_SSH
#include "sftp.h"
#endif

#include <guacamole/argv.h>
#include <guacamole/audio.h>
#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

#include <pthread.h>
#include <stddef.h>

int guac_rdp_user_join_handler(guac_user* user, int argc, char** argv) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) user->client->data;

    /* Parse provided arguments */
    guac_rdp_settings* settings = guac_rdp_parse_args(user,
            argc, (const char**) argv);

    /* Fail if settings cannot be parsed */
    if (settings == NULL) {
        guac_user_log(user, GUAC_LOG_INFO,
                "Badly formatted client arguments.");
        return 1;
    }

    /* Store settings at user level */
    user->data = settings;

    /* Connect via RDP if owner */
    if (user->owner) {

        /* Store owner's settings at client level */
        rdp_client->settings = settings;

        /* Start client thread */
        if (pthread_create(&rdp_client->client_thread, NULL,
                    guac_rdp_client_thread, user->client)) {
            guac_user_log(user, GUAC_LOG_ERROR,
                    "Unable to start RDP client thread.");
            return 1;
        }

        /* Handle inbound audio streams if audio input is enabled */
        if (settings->enable_audio_input)
            user->audio_handler = guac_rdp_audio_handler;

    }

    /* Only handle events if not read-only */
    if (!settings->read_only) {

        /* General mouse/keyboard events */
        user->mouse_handler = guac_rdp_user_mouse_handler;
        user->key_handler = guac_rdp_user_key_handler;

        /* Multi-touch events */
        if (settings->enable_touch)
            user->touch_handler = guac_rdp_user_touch_handler;

        /* Inbound (client to server) clipboard transfer */
        if (!settings->disable_paste)
            user->clipboard_handler = guac_rdp_clipboard_handler;

        /* Display size change events */
        user->size_handler = guac_rdp_user_size_handler;

        /* Set generic (non-filesystem) file upload handler */
        user->file_handler = guac_rdp_user_file_handler;

        /* Inbound arbitrary named pipes */
        user->pipe_handler = guac_rdp_pipe_svc_pipe_handler;
        
        /* If we own it, register handler for updating parameters during connection. */
        if (user->owner)
            user->argv_handler = guac_argv_handler;

    }

    return 0;

}

int guac_rdp_user_file_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* filename) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) user->client->data;
    guac_rdp_settings* settings = rdp_client->settings;

#ifdef ENABLE_COMMON_SSH

    /* If SFTP is enabled and SFTP uploads have not been disabled, it should be
     * used for default uploads only if RDPDR is not enabled or its upload
     * directory has been set */
    if (rdp_client->sftp_filesystem != NULL && !settings->sftp_disable_upload) {
        if (!settings->drive_enabled || settings->sftp_directory != NULL)
            return guac_rdp_sftp_file_handler(user, stream, mimetype, filename);
    }
#endif

    /* Default to using RDPDR uploads (if enabled) */
    if (rdp_client->filesystem != NULL && !settings->disable_upload)
        return guac_rdp_upload_file_handler(user, stream, mimetype, filename);

    /* File transfer not enabled */
    guac_protocol_send_ack(user->socket, stream, "File transfer disabled",
            GUAC_PROTOCOL_STATUS_UNSUPPORTED);
    guac_socket_flush(user->socket);

    return 0;
}

int guac_rdp_user_leave_handler(guac_user* user) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) user->client->data;

    /* Update shared cursor state if the display still exists */
    if (rdp_client->display != NULL)
        guac_display_notify_user_left(rdp_client->display, user);

    /* Free settings if not owner (owner settings will be freed with client) */
    if (!user->owner) {
        guac_rdp_settings* settings = (guac_rdp_settings*) user->data;
        guac_rdp_settings_free(settings);
    }

    return 0;
}

