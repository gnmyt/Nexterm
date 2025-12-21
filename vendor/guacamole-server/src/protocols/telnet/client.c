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
#include "client.h"
#include "settings.h"
#include "telnet.h"
#include "user.h"

#include <langinfo.h>
#include <locale.h>
#include <pthread.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <guacamole/argv.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/recording.h>
#include <guacamole/socket.h>

/**
 * A pending join handler implementation that will synchronize the connection
 * state for all pending users prior to them being promoted to full user.
 *
 * @param client
 *     The client whose pending users are about to be promoted.
 *
 * @return
 *     Always zero.
 */
static int guac_telnet_join_pending_handler(guac_client* client) {

    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;

    /* Synchronize the terminal state to all pending users */
    if (telnet_client->term != NULL) {
        guac_socket* broadcast_socket = client->pending_socket;
        guac_terminal_sync_users(telnet_client->term, client, broadcast_socket);
        guac_telnet_send_current_argv_batch(client, broadcast_socket);
        guac_socket_flush(broadcast_socket);
    }

    return 0;

}

int guac_client_init(guac_client* client) {

    /* Set client args */
    client->args = GUAC_TELNET_CLIENT_ARGS;

    /* Allocate client instance data */
    guac_telnet_client* telnet_client = guac_mem_zalloc(sizeof(guac_telnet_client));
    client->data = telnet_client;

    /* Init telnet client */
    telnet_client->socket_fd = -1;
    telnet_client->naws_enabled = 0;
    telnet_client->echo_enabled = 1;

    /* Set handlers */
    client->join_handler = guac_telnet_user_join_handler;
    client->join_pending_handler = guac_telnet_join_pending_handler;
    client->free_handler = guac_telnet_client_free_handler;
    client->leave_handler = guac_telnet_user_leave_handler;

    /* Register handlers for argument values that may be sent after the handshake */
    guac_argv_register(GUAC_TELNET_ARGV_COLOR_SCHEME, guac_telnet_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);
    guac_argv_register(GUAC_TELNET_ARGV_FONT_NAME, guac_telnet_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);
    guac_argv_register(GUAC_TELNET_ARGV_FONT_SIZE, guac_telnet_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);

    /* Set locale and warn if not UTF-8 */
    setlocale(LC_CTYPE, "");
    if (strcmp(nl_langinfo(CODESET), "UTF-8") != 0) {
        guac_client_log(client, GUAC_LOG_INFO,
                "Current locale does not use UTF-8. Some characters may "
                "not render correctly.");
    }

    /* Success */
    return 0;

}

int guac_telnet_client_free_handler(guac_client* client) {

    guac_telnet_client* telnet_client = (guac_telnet_client*) client->data;

    /* Close telnet connection */
    if (telnet_client->socket_fd != -1)
        close(telnet_client->socket_fd);

    /* Clean up recording, if in progress */
    if (telnet_client->recording != NULL)
        guac_recording_free(telnet_client->recording);

    /* Kill terminal */
    guac_terminal_free(telnet_client->term);

    /* Wait for and free telnet session, if connected */
    if (telnet_client->telnet != NULL) {
        pthread_join(telnet_client->client_thread, NULL);
        telnet_free(telnet_client->telnet);
    }

    /* Free settings */
    if (telnet_client->settings != NULL)
        guac_telnet_settings_free(telnet_client->settings);

    guac_mem_free(telnet_client);
    return 0;

}

