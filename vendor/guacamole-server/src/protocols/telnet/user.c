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

#include "argv.h"
#include "clipboard.h"
#include "input.h"
#include "pipe.h"
#include "settings.h"
#include "telnet.h"
#include "terminal/terminal.h"
#include "user.h"

#include <guacamole/client.h>
#include <guacamole/socket.h>
#include <guacamole/user.h>

#include <pthread.h>
#include <string.h>

int guac_telnet_user_join_handler(guac_user* user, int argc, char** argv) {

    guac_client* client = user->client;
    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;

    /* Parse provided arguments */
    guac_telnet_settings* settings = guac_telnet_parse_args(user,
            argc, (const char**) argv);

    /* Fail if settings cannot be parsed */
    if (settings == NULL) {
        guac_user_log(user, GUAC_LOG_INFO,
                "Badly formatted client arguments.");
        return 1;
    }

    /* Store settings at user level */
    user->data = settings;

    /* Connect via telnet if owner */
    if (user->owner) {

        /* Store owner's settings at client level */
        telnet_client->settings = settings;

        /* Start client thread */
        if (pthread_create(&(telnet_client->client_thread), NULL,
                    guac_telnet_client_thread, (void*) client)) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "Unable to start telnet client thread");
            return 1;
        }

    }

    /* Only handle events if not read-only */
    if (!settings->read_only) {

        /* General mouse/keyboard events */
        user->key_handler = guac_telnet_user_key_handler;
        user->mouse_handler = guac_telnet_user_mouse_handler;

        /* Inbound (client to server) clipboard transfer */
        if (!settings->disable_paste)
            user->clipboard_handler = guac_telnet_clipboard_handler;

        /* STDIN redirection */
        user->pipe_handler = guac_telnet_pipe_handler;

        /* Updates to connection parameters */
        user->argv_handler = guac_argv_handler;

        /* Display size change events */
        user->size_handler = guac_telnet_user_size_handler;

    }

    return 0;

}

int guac_telnet_user_leave_handler(guac_user* user) {

    guac_telnet_client* telnet_client =
        (guac_telnet_client*) user->client->data;

    /* Remove the user from the terminal */
    guac_terminal_remove_user(telnet_client->term, user);

    /* Free settings if not owner (owner settings will be freed with client) */
    if (!user->owner) {
        guac_telnet_settings* settings = (guac_telnet_settings*) user->data;
        guac_telnet_settings_free(settings);
    }

    return 0;
}

