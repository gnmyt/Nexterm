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

#include "argv.h"
#include "client.h"
#include "kubernetes.h"
#include "settings.h"
#include "user.h"

#include <guacamole/argv.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/socket.h>
#include <libwebsockets.h>

#include <langinfo.h>
#include <locale.h>
#include <pthread.h>
#include <stdlib.h>
#include <string.h>

guac_client* guac_kubernetes_lws_current_client = NULL;

/**
 * Logging callback invoked by libwebsockets to log a single line of logging
 * output. As libwebsockets messages are all generally low-level, the log
 * level provided by libwebsockets is ignored here, with all messages logged
 * instead at guacd's debug level.
 *
 * @param level
 *     The libwebsockets log level associated with the log message. This value
 *     is ignored by this implementation of the logging callback.
 *
 * @param line
 *     The line of logging output to log.
 */
static void guac_kubernetes_log(int level, const char* line) {

    char buffer[1024];

    /* Drop log message if there's nowhere to log yet */
    if (guac_kubernetes_lws_current_client == NULL)
        return;

    /* Trim length of line to fit buffer (plus null terminator) */
    int length = strlen(line);
    if (length > sizeof(buffer) - 1)
        length = sizeof(buffer) - 1;

    /* Copy as much of the received line as will fit in the buffer */
    memcpy(buffer, line, length);

    /* If the line ends with a newline character, trim the character */
    if (length > 0 && buffer[length - 1] == '\n')
        length--;

    /* Null-terminate the trimmed string */
    buffer[length] = '\0';

    /* Log using guacd's own log facilities */
    guac_client_log(guac_kubernetes_lws_current_client, GUAC_LOG_DEBUG,
            "libwebsockets: %s", buffer);

}

/**
 * A pending join handler implementation that will synchronize the connection
 * state for all pending users prior to them being promoted to full user.
 *
 * @param client
 *     The client whose pending users are about to be promoted to full users,
 *     and therefore need their connection state synchronized.
 *
 * @return
 *     Always zero.
 */
static int guac_kubernetes_join_pending_handler(guac_client* client) {

    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Synchronize the terminal state to all pending users */
    if (kubernetes_client->term != NULL) {
        guac_socket* broadcast_socket = client->pending_socket;
        guac_terminal_sync_users(kubernetes_client->term, client, broadcast_socket);
        guac_kubernetes_send_current_argv_batch(client, broadcast_socket);
        guac_socket_flush(broadcast_socket);
    }

    return 0;

}

int guac_client_init(guac_client* client) {

    /* Ensure reference to main guac_client remains available in all
     * libwebsockets contexts */
    guac_kubernetes_lws_current_client = client;

    /* Redirect libwebsockets logging */
    lws_set_log_level(LLL_ERR | LLL_WARN | LLL_NOTICE | LLL_INFO,
            guac_kubernetes_log);

    /* Set client args */
    client->args = GUAC_KUBERNETES_CLIENT_ARGS;

    /* Allocate client instance data */
    guac_kubernetes_client* kubernetes_client = guac_mem_zalloc(sizeof(guac_kubernetes_client));
    client->data = kubernetes_client;

    /* Set handlers */
    client->join_handler = guac_kubernetes_user_join_handler;
    client->join_pending_handler = guac_kubernetes_join_pending_handler;
    client->free_handler = guac_kubernetes_client_free_handler;
    client->leave_handler = guac_kubernetes_user_leave_handler;

    /* Register handlers for argument values that may be sent after the handshake */
    guac_argv_register(GUAC_KUBERNETES_ARGV_COLOR_SCHEME, guac_kubernetes_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);
    guac_argv_register(GUAC_KUBERNETES_ARGV_FONT_NAME, guac_kubernetes_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);
    guac_argv_register(GUAC_KUBERNETES_ARGV_FONT_SIZE, guac_kubernetes_argv_callback, NULL, GUAC_ARGV_OPTION_ECHO);

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

int guac_kubernetes_client_free_handler(guac_client* client) {

    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Wait client thread to terminate */
    pthread_join(kubernetes_client->client_thread, NULL);

    /* Free settings */
    if (kubernetes_client->settings != NULL)
        guac_kubernetes_settings_free(kubernetes_client->settings);

    guac_mem_free(kubernetes_client);
    return 0;

}

