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

#include <guacamole/client.h>
#include <winpr/wlog.h>
#include <winpr/wtypes.h>

#include <pthread.h>
#include <stddef.h>

/**
 * The guac_client that should be used for FreeRDP log messages.
 *
 * FreeRDP's WLog root logger is global to the process, so this necessarily is
 * too. Where guacd isolates each connection in its own process, this is simply
 * the guac_client of that process' one connection. Embedders which run several
 * connections within a single process (such as the Nexterm engine) instead
 * share this between all of them: it refers to whichever connection most
 * recently redirected the log.
 *
 * Access is guarded by current_client_lock.
 */
static guac_client* current_client = NULL;

/**
 * Mutex guarding current_client. This ensures a message which is already being
 * logged cannot have its guac_client freed out from under it: unredirecting
 * blocks until any in-progress message completes.
 */
static pthread_mutex_t current_client_lock = PTHREAD_MUTEX_INITIALIZER;

/**
 * Logs the text data within the given message to the logging facilities of the
 * guac_client currently stored under current_client.
 *
 * @param message
 *     The message to log.
 *
 * @return
 *     TRUE if the message was successfully logged, FALSE otherwise.
 */
static BOOL guac_rdp_wlog_text_message(const wLogMessage* message) {

    BOOL logged = FALSE;

    pthread_mutex_lock(&current_client_lock);

    /* Fail if log not yet redirected, or if the client it referred to has since
     * been freed */
    if (current_client != NULL) {
        /* Log all received messages at the debug level */
        guac_client_log(current_client, GUAC_LOG_DEBUG, "%s", message->TextString);
        logged = TRUE;
    }

    pthread_mutex_unlock(&current_client_lock);
    return logged;

}

void guac_rdp_unredirect_wlog(guac_client* client) {

    pthread_mutex_lock(&current_client_lock);

    if (current_client == client)
        current_client = NULL;

    pthread_mutex_unlock(&current_client_lock);

}

static void guac_rdp_init_wlog(void) {

    wLogCallbacks callbacks = {
        .message = guac_rdp_wlog_text_message
    };

    /* Reconfigure root logger to use callback appender */
    wLog* root = WLog_GetRoot();
    WLog_SetLogAppenderType(root, WLOG_APPENDER_CALLBACK);

    /* Set appender callbacks to our own */
    wLogAppender* appender = WLog_GetLogAppender(root);
    WLog_ConfigureAppender(appender, "callbacks", &callbacks);

}

/**
 * Guarantees the root logger is configured exactly once per process.
 */
static pthread_once_t wlog_init_once = PTHREAD_ONCE_INIT;

void guac_rdp_redirect_wlog(guac_client* client) {

    pthread_mutex_lock(&current_client_lock);
    current_client = client;
    pthread_mutex_unlock(&current_client_lock);

    /* Configure the root logger exactly once per process.
     *
     * WinPR's root logger and its appender are global. Reconfiguring them for
     * every connection is safe under guacd, where each process serves exactly
     * one connection, but not where several connections share a process (such
     * as the Nexterm engine): WLog_SetLogAppenderType() frees and reallocates
     * the appender, so a connection starting up will pull the appender out from
     * under any other thread currently logging through it, corrupting the heap.
     *
     * The configuration is identical for every connection, so doing it once is
     * sufficient. Which guac_client the messages are routed to is handled
     * separately, by current_client above. */
    pthread_once(&wlog_init_once, guac_rdp_init_wlog);

}

