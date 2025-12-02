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
#include "common-ssh/sftp.h"
#include "ssh.h"
#include "terminal/terminal.h"
#include "user.h"

#include <langinfo.h>
#include <locale.h>
#include <stdlib.h>
#include <string.h>

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
static int guac_ssh_join_pending_handler(guac_client* client) {

    guac_ssh_client* ssh_client = (guac_ssh_client*) client->data;

    /* Synchronize the terminal state to all pending users */
    if (ssh_client->term != NULL) {
        guac_socket* broadcast_socket = client->pending_socket;
        guac_terminal_sync_users(ssh_client->term, client, broadcast_socket);
        guac_ssh_send_current_argv_batch(client, broadcast_socket);
        guac_socket_flush(broadcast_socket);
    }

    return 0;

}

int guac_client_init(guac_client* client) {

    /* Set client args */
    client->args = GUAC_SSH_CLIENT_ARGS;

    /* Allocate client instance data */
    guac_ssh_client* ssh_client = guac_mem_zalloc(sizeof(guac_ssh_client));
    client->data = ssh_client;

    /* Set handlers */
    client->join_handler = guac_ssh_user_join_handler;
    client->join_pending_handler = guac_ssh_join_pending_handler;
    client->free_handler = guac_ssh_client_free_handler;
    client->leave_handler = guac_ssh_user_leave_handler;

    /* Register handlers for argument values that may be sent after the handshake */
    guac_argv_register(GUAC_SSH_ARGV_COLOR_SCHEME, guac_ssh_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);
    guac_argv_register(GUAC_SSH_ARGV_FONT_NAME, guac_ssh_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);
    guac_argv_register(GUAC_SSH_ARGV_FONT_SIZE, guac_ssh_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);

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

int guac_ssh_client_free_handler(guac_client* client) {

    guac_ssh_client* ssh_client = (guac_ssh_client*) client->data;

    /* Close SSH channel */
    if (ssh_client->term_channel != NULL) {
        libssh2_channel_send_eof(ssh_client->term_channel);
        libssh2_channel_close(ssh_client->term_channel);
    }

    /* Free terminal (which may still be using term_channel) */
    if (ssh_client->term != NULL) {
        /* Stop the terminal to unblock any pending reads/writes */
        guac_terminal_stop(ssh_client->term);

        /* Wait ssh_client_thread to finish before freeing the terminal */
        pthread_join(ssh_client->client_thread, NULL);
        guac_terminal_free(ssh_client->term);
    }

    /* Free terminal channel now that the terminal is finished */
    if (ssh_client->term_channel != NULL)
        libssh2_channel_free(ssh_client->term_channel);

    /* Clean up the SFTP filesystem object and session */
    if (ssh_client->sftp_filesystem) {
        guac_common_ssh_destroy_sftp_filesystem(ssh_client->sftp_filesystem);
        guac_common_ssh_destroy_session(ssh_client->sftp_session);
    }

    /* Clean up recording, if in progress */
    if (ssh_client->recording != NULL)
        guac_recording_free(ssh_client->recording);

    /* Free interactive SSH session */
    if (ssh_client->session != NULL)
        guac_common_ssh_destroy_session(ssh_client->session);

    /* Free SSH client credentials */
    if (ssh_client->user != NULL)
        guac_common_ssh_destroy_user(ssh_client->user);

    /* Free parsed settings */
    if (ssh_client->settings != NULL)
        guac_ssh_settings_free(ssh_client->settings);

    /* Free client structure */
    guac_mem_free(ssh_client);

    guac_common_ssh_uninit();
    return 0;
}

