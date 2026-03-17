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
#include "io.h"
#include "kubernetes.h"
#include "ssl.h"
#include "terminal/terminal.h"
#include "url.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/recording.h>
#include <libwebsockets.h>

#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>

/**
 * Callback invoked by libwebsockets for events related to a WebSocket being
 * used for communicating with an attached Kubernetes pod.
 *
 * @param wsi
 *     The libwebsockets handle for the WebSocket connection.
 *
 * @param reason
 *     The reason (event) that this callback was invoked.
 *
 * @param user
 *     Arbitrary data associated with the WebSocket session. In some cases,
 *     this is actually event-specific data (such as the
 *     LWS_CALLBACK_OPENSSL_LOAD_EXTRA_CLIENT_VERIFY_CERT event).
 *
 * @param in
 *     A pointer to arbitrary, reason-specific data.
 *
 * @param length
 *     An arbitrary, reason-specific length value.
 *
 * @return
 *     An undocumented integer value related the success of handling the
 *     event, or -1 if the WebSocket connection should be closed.
 */
static int guac_kubernetes_lws_callback(struct lws* wsi,
        enum lws_callback_reasons reason, void* user,
        void* in, size_t length) {

    guac_client* client = guac_kubernetes_lws_current_client;
    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Do not handle any further events if connection is closing */
    if (client->state != GUAC_CLIENT_RUNNING) {
#ifdef HAVE_LWS_CALLBACK_HTTP_DUMMY
        return lws_callback_http_dummy(wsi, reason, user, in, length);
#else
        return 0;
#endif
    }

    switch (reason) {

        /* Complete initialization of SSL */
        case LWS_CALLBACK_OPENSSL_LOAD_EXTRA_CLIENT_VERIFY_CERTS:
            guac_kubernetes_init_ssl(client, (SSL_CTX*) user);
            break;

        /* Failed to connect */
        case LWS_CALLBACK_CLIENT_CONNECTION_ERROR:
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_UPSTREAM_NOT_FOUND,
                    "Error connecting to Kubernetes server: %s",
                    in != NULL ? (char*) in : "(no error description "
                    "available)");
            break;

        /* Connected / logged in */
        case LWS_CALLBACK_CLIENT_ESTABLISHED:
            guac_client_log(client, GUAC_LOG_INFO,
                    "Kubernetes connection successful.");

            /* Allow terminal to render */
            guac_terminal_start(kubernetes_client->term);

            /* Schedule check for pending messages in case messages were added
             * to the outbound message buffer prior to the connection being
             * fully established */
            lws_callback_on_writable(wsi);
            break;

        /* Data received via WebSocket */
        case LWS_CALLBACK_CLIENT_RECEIVE:
            guac_kubernetes_receive_data(client, (const char*) in, length);
            break;

        /* WebSocket is ready for writing */
        case LWS_CALLBACK_CLIENT_WRITEABLE:

            /* Send any pending messages, requesting another callback if
             * yet more messages remain */
            if (guac_kubernetes_write_pending_message(client))
                lws_callback_on_writable(wsi);
            break;

#ifdef HAVE_LWS_CALLBACK_CLIENT_CLOSED
        /* Connection closed (client-specific) */
        case LWS_CALLBACK_CLIENT_CLOSED:
#endif

        /* Connection closed */
        case LWS_CALLBACK_WSI_DESTROY:
        case LWS_CALLBACK_CLOSED:
            guac_client_stop(client);
            guac_client_log(client, GUAC_LOG_DEBUG, "WebSocket connection to "
                    "Kubernetes server closed.");
            break;

        /* No other event types are applicable */
        default:
            break;

    }

#ifdef HAVE_LWS_CALLBACK_HTTP_DUMMY
    return lws_callback_http_dummy(wsi, reason, user, in, length);
#else
    return 0;
#endif

}

/**
 * List of all WebSocket protocols which should be declared as supported by
 * libwebsockets during the initial WebSocket handshake, along with
 * corresponding event-handling callbacks.
 */
struct lws_protocols guac_kubernetes_lws_protocols[] = {
    {
        .name = GUAC_KUBERNETES_LWS_PROTOCOL,
        .callback = guac_kubernetes_lws_callback
    },
    { 0 }
};

/**
 * Input thread, started by the main Kubernetes client thread. This thread
 * continuously reads from the terminal's STDIN and transfers all read
 * data to the Kubernetes connection.
 *
 * @param data
 *     The current guac_client instance.
 *
 * @return
 *     Always NULL.
 */
static void* guac_kubernetes_input_thread(void* data) {

    guac_client* client = (guac_client*) data;
    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    char buffer[GUAC_KUBERNETES_MAX_MESSAGE_SIZE];
    int bytes_read;

    /* Write all data read */
    while ((bytes_read = guac_terminal_read_stdin(kubernetes_client->term, buffer, sizeof(buffer))) > 0) {

        /* Send received data to Kubernetes along STDIN channel */
        guac_kubernetes_send_message(client, GUAC_KUBERNETES_CHANNEL_STDIN,
                buffer, bytes_read);

    }

    return NULL;

}

void* guac_kubernetes_client_thread(void* data) {

    guac_client* client = (guac_client*) data;
    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    guac_kubernetes_settings* settings = kubernetes_client->settings;

    pthread_t input_thread;
    char endpoint_path[GUAC_KUBERNETES_MAX_ENDPOINT_LENGTH];

    /* Verify that the pod name was specified (it's always required) */
    if (settings->kubernetes_pod == NULL) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "The name of the Kubernetes pod is a required parameter.");
        goto fail;
    }

    /* Generate endpoint for attachment URL */
    if (guac_kubernetes_endpoint_uri(endpoint_path, sizeof(endpoint_path),
                settings->kubernetes_namespace,
                settings->kubernetes_pod,
                settings->kubernetes_container,
                settings->exec_command)) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Unable to generate path for Kubernetes API endpoint: "
                "Resulting path too long");
        goto fail;
    }

    guac_client_log(client, GUAC_LOG_DEBUG, "The endpoint for attaching to "
            "the requested Kubernetes pod is \"%s\".", endpoint_path);

    /* Set up screen recording, if requested */
    if (settings->recording_path != NULL) {
        kubernetes_client->recording = guac_recording_create(client,
                settings->recording_path,
                settings->recording_name,
                settings->create_recording_path,
                !settings->recording_exclude_output,
                !settings->recording_exclude_mouse,
                0, /* Touch events not supported */
                settings->recording_include_keys,
                settings->recording_write_existing);
    }

    /* Create terminal options with required parameters */
    guac_terminal_options* options = guac_terminal_options_create(
            settings->width, settings->height, settings->resolution);

    /* Set optional parameters */
    options->disable_copy = settings->disable_copy;
    options->max_scrollback = settings->max_scrollback;
    options->font_name = settings->font_name;
    options->font_size = settings->font_size;
    options->color_scheme = settings->color_scheme;
    options->backspace = settings->backspace;

    /* Create terminal */
    kubernetes_client->term = guac_terminal_create(client, options);

    /* Free options struct now that it's been used */
    guac_mem_free(options);

    /* Fail if terminal init failed */
    if (kubernetes_client->term == NULL) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Terminal initialization failed");
        goto fail;
    }

    /* Send current values of exposed arguments to owner only */
    guac_client_for_owner(client, guac_kubernetes_send_current_argv,
            kubernetes_client);

    /* Set up typescript, if requested */
    if (settings->typescript_path != NULL) {
        guac_terminal_create_typescript(kubernetes_client->term,
                settings->typescript_path,
                settings->typescript_name,
                settings->create_typescript_path,
                settings->typescript_write_existing);
    }

    /* Init libwebsockets context creation parameters */
    struct lws_context_creation_info context_info = {
        .port = CONTEXT_PORT_NO_LISTEN, /* We are not a WebSocket server */
        .uid = -1,
        .gid = -1,
        .protocols = guac_kubernetes_lws_protocols,
        .user = client
    };

    /* Init WebSocket connection parameters which do not vary by Guacamole
     * connection parameters or creation of future libwebsockets objects */
    struct lws_client_connect_info connection_info = {
        .host = settings->hostname,
        .address = settings->hostname,
        .origin = settings->hostname,
        .port = settings->port,
        .protocol = GUAC_KUBERNETES_LWS_PROTOCOL,
        .userdata = client
    };

    /* If requested, use an SSL/TLS connection for communication with
     * Kubernetes. Note that we disable hostname checks here because we
     * do our own validation - libwebsockets does not validate properly if
     * IP addresses are used. */
    if (settings->use_ssl) {
#ifdef HAVE_LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT
        context_info.options = LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;
#endif
#ifdef HAVE_LCCSCF_USE_SSL
        connection_info.ssl_connection = LCCSCF_USE_SSL
            | LCCSCF_SKIP_SERVER_CERT_HOSTNAME_CHECK;
#else
        connection_info.ssl_connection = 2; /* SSL + no hostname check */
#endif
    }

    /* Create libwebsockets context */
    kubernetes_client->context = lws_create_context(&context_info);
    if (!kubernetes_client->context) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Initialization of libwebsockets failed");
        goto fail;
    }

    /* Generate path dynamically */
    connection_info.context = kubernetes_client->context;
    connection_info.path = endpoint_path;

    /* Open WebSocket connection to Kubernetes */
    kubernetes_client->wsi = lws_client_connect_via_info(&connection_info);
    if (kubernetes_client->wsi == NULL) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Connection via libwebsockets failed");
        goto fail;
    }

    /* Init outbound message buffer */
    pthread_mutex_init(&(kubernetes_client->outbound_message_lock), NULL);

    /* Start input thread */
    if (pthread_create(&(input_thread), NULL, guac_kubernetes_input_thread, (void*) client)) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR, "Unable to start input thread");
        goto fail;
    }

    /* Force a redraw of the attached display (there will be no content
     * otherwise, given the stream nature of attaching to a running
     * container) */
    guac_kubernetes_force_redraw(client);

    /* As long as client is connected, continue polling libwebsockets */
    while (client->state == GUAC_CLIENT_RUNNING) {

        /* Cease polling libwebsockets if an error condition is signalled */
        if (lws_service(kubernetes_client->context,
                    GUAC_KUBERNETES_SERVICE_INTERVAL) < 0)
            break;

    }

    /* Kill client and Wait for input thread to die */
    guac_terminal_stop(kubernetes_client->term);
    guac_client_stop(client);
    pthread_join(input_thread, NULL);

fail:

    /* Kill and free terminal, if allocated */
    if (kubernetes_client->term != NULL)
        guac_terminal_free(kubernetes_client->term);

    /* Clean up recording, if in progress */
    if (kubernetes_client->recording != NULL)
        guac_recording_free(kubernetes_client->recording);

    /* Free WebSocket context if successfully allocated */
    if (kubernetes_client->context != NULL)
        lws_context_destroy(kubernetes_client->context);

    guac_client_log(client, GUAC_LOG_INFO, "Kubernetes connection ended.");
    return NULL;

}

void guac_kubernetes_resize(guac_client* client, int rows, int columns) {

    char buffer[64];

    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Send request only if different from last request */
    if (kubernetes_client->rows != rows ||
            kubernetes_client->columns != columns) {

        kubernetes_client->rows = rows;
        kubernetes_client->columns = columns;

        /* Construct terminal resize message for Kubernetes */
        int length = snprintf(buffer, sizeof(buffer),
                "{\"Width\":%i,\"Height\":%i}", columns, rows);

        /* Schedule message for sending */
        guac_kubernetes_send_message(client, GUAC_KUBERNETES_CHANNEL_RESIZE,
                buffer, length);

    }

}

void guac_kubernetes_force_redraw(guac_client* client) {

    guac_kubernetes_client* kubernetes_client =
        (guac_kubernetes_client*) client->data;

    /* Get current terminal dimensions */
    guac_terminal* term = kubernetes_client->term;
    int rows = guac_terminal_get_rows(term);
    int columns = guac_terminal_get_columns(term);

    /* Force a redraw by increasing the terminal size by one character in
     * each dimension and then resizing it back to normal (the same technique
     * used by kubectl */
    guac_kubernetes_resize(client, rows + 1, columns + 1);
    guac_kubernetes_resize(client, rows, columns);

}

