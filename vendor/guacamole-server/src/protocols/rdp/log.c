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

#include <stddef.h>

/**
 * The guac_client that should be used within this process for FreeRDP log
 * messages. As all Guacamole connections are isolated at the process level,
 * this will only ever be set to the guac_client of the current process'
 * connection.
 */
static guac_client* current_client = NULL;

/**
 * Logs the text data within the given message to the logging facilities of the
 * guac_client currently stored under current_client (the guac_client of the
 * current process).
 *
 * @param message
 *     The message to log.
 *
 * @return
 *     TRUE if the message was successfully logged, FALSE otherwise.
 */
static BOOL guac_rdp_wlog_text_message(const wLogMessage* message) {

    /* Fail if log not yet redirected */
    if (current_client == NULL)
        return FALSE;

    /* Log all received messages at the debug level */
    guac_client_log(current_client, GUAC_LOG_DEBUG, "%s", message->TextString);
    return TRUE;

}

void guac_rdp_redirect_wlog(guac_client* client) {

    wLogCallbacks callbacks = {
        .message = guac_rdp_wlog_text_message
    };

    current_client = client;

    /* Reconfigure root logger to use callback appender */
    wLog* root = WLog_GetRoot();
    WLog_SetLogAppenderType(root, WLOG_APPENDER_CALLBACK);

    /* Set appender callbacks to our own */
    wLogAppender* appender = WLog_GetLogAppender(root);
    WLog_ConfigureAppender(appender, "callbacks", &callbacks);

}

