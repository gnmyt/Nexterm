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

#ifndef __GUACD_LOG_H
#define __GUACD_LOG_H

#include "config.h"

#include <guacamole/client.h>

/**
 * The maximum level at which to log messages. All other messages will be
 * dropped.
 */
extern int guacd_log_level;

/**
 * The string to prepend to all log messages.
 */
#define GUACD_LOG_NAME "guacd"

/**
 * Writes a message to guacd's logs. This function takes a format and va_list,
 * similar to vprintf.
 */
void vguacd_log(guac_client_log_level level, const char* format, va_list args);

/**
 * Writes a message to guacd's logs. This function accepts parameters
 * identically to printf.
 */
void guacd_log(guac_client_log_level level, const char* format, ...);

/**
 * Writes a message using the logging facilities of the given client. This
 * function accepts parameters identically to printf.
 */
void guacd_client_log(guac_client* client, guac_client_log_level level,
        const char* format, va_list args);

/**
 * Prints an error message to guacd's logs, automatically including any
 * information present in guac_error. This function accepts parameters
 * identically to printf.
 */
void guacd_log_guac_error(guac_client_log_level level, const char* message);

/**
 * Logs a reasonable explanatory message regarding handshake failure based on
 * the current value of guac_error.
 */
void guacd_log_handshake_failure();

#endif

