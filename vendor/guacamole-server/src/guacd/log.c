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
#include "log.h"

#include <guacamole/client.h>
#include <guacamole/error.h>

#include <stdarg.h>
#include <stdio.h>
#include <syslog.h>
#include <unistd.h>

int guacd_log_level = GUAC_LOG_INFO;

void vguacd_log(guac_client_log_level level, const char* format,
        va_list args) {

    const char* priority_name;
    int priority;

    char message[2048];

    /* Don't bother if the log level is too high */
    if (level > guacd_log_level)
        return;

    /* Copy log message into buffer */
    vsnprintf(message, sizeof(message), format, args);

    /* Convert log level to syslog priority */
    switch (level) {

        /* Error log level */
        case GUAC_LOG_ERROR:
            priority = LOG_ERR;
            priority_name = "ERROR";
            break;

        /* Warning log level */
        case GUAC_LOG_WARNING:
            priority = LOG_WARNING;
            priority_name = "WARNING";
            break;

        /* Informational log level */
        case GUAC_LOG_INFO:
            priority = LOG_INFO;
            priority_name = "INFO";
            break;

        /* Debug log level */
        case GUAC_LOG_DEBUG:
            priority = LOG_DEBUG;
            priority_name = "DEBUG";
            break;

        /* Trace log level */
        case GUAC_LOG_TRACE:
            priority = LOG_DEBUG;
            priority_name = "TRACE";
            break;

        /* Any unknown/undefined log level */
        default:
            priority = LOG_INFO;
            priority_name = "UNKNOWN";
            break;
    }

    /* Log to syslog */
    syslog(priority, "%s", message);

    /* Log to STDERR */
    fprintf(stderr, GUACD_LOG_NAME "[%i]: %s:\t%s\n",
            getpid(), priority_name, message);

}

void guacd_log(guac_client_log_level level, const char* format, ...) {
    va_list args;
    va_start(args, format);
    vguacd_log(level, format, args);
    va_end(args);
}

void guacd_client_log(guac_client* client, guac_client_log_level level,
        const char* format, va_list args) {
    vguacd_log(level, format, args);
}

void guacd_log_guac_error(guac_client_log_level level, const char* message) {

    if (guac_error != GUAC_STATUS_SUCCESS) {

        /* If error message provided, include in log */
        if (guac_error_message != NULL)
            guacd_log(level, "%s: %s",
                    message,
                    guac_error_message);

        /* Otherwise just log with standard status string */
        else
            guacd_log(level, "%s: %s",
                    message,
                    guac_status_string(guac_error));

    }

    /* Just log message if no status code */
    else
        guacd_log(level, "%s", message);

}

void guacd_log_handshake_failure() {

    if (guac_error == GUAC_STATUS_CLOSED)
        guacd_log(GUAC_LOG_DEBUG,
                "Guacamole connection closed during handshake");
    else if (guac_error == GUAC_STATUS_PROTOCOL_ERROR)
        guacd_log(GUAC_LOG_ERROR,
                "Guacamole protocol violation. Perhaps the version of "
                "guacamole-client is incompatible with this version of "
                "guacd?");
    else
        guacd_log(GUAC_LOG_WARNING,
                "Guacamole handshake failed: %s",
                guac_status_string(guac_error));

}

