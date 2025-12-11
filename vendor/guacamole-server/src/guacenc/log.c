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
#include "guacenc.h"
#include "log.h"

#include <guacamole/client.h>
#include <guacamole/error.h>

#include <stdarg.h>
#include <stdio.h>

int guacenc_log_level = GUACENC_DEFAULT_LOG_LEVEL;

void vguacenc_log(guac_client_log_level level, const char* format,
        va_list args) {

    const char* priority_name;
    char message[2048];

    /* Don't bother if the log level is too high */
    if (level > guacenc_log_level)
        return;

    /* Copy log message into buffer */
    vsnprintf(message, sizeof(message), format, args);

    /* Convert log level to human-readable name */
    switch (level) {

        /* Error log level */
        case GUAC_LOG_ERROR:
            priority_name = "ERROR";
            break;

        /* Warning log level */
        case GUAC_LOG_WARNING:
            priority_name = "WARNING";
            break;

        /* Informational log level */
        case GUAC_LOG_INFO:
            priority_name = "INFO";
            break;

        /* Debug log level */
        case GUAC_LOG_DEBUG:
            priority_name = "DEBUG";
            break;

        /* Any unknown/undefined log level */
        default:
            priority_name = "UNKNOWN";
            break;
    }

    /* Log to STDERR */
    fprintf(stderr, GUACENC_LOG_NAME ": %s: %s\n", priority_name, message);

}

void guacenc_log(guac_client_log_level level, const char* format, ...) {
    va_list args;
    va_start(args, format);
    vguacenc_log(level, format, args);
    va_end(args);
}

