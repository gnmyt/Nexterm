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

#ifndef GUACENC_LOG_H
#define GUACENC_LOG_H

#include "config.h"

#include <guacamole/client.h>

#include <stdarg.h>

/**
 * The maximum level at which to log messages. All other messages will be
 * dropped.
 */
extern int guacenc_log_level;

/**
 * The string to prepend to all log messages.
 */
#define GUACENC_LOG_NAME "guacenc"

/**
 * Writes a message to guacenc's logs. This function takes a format and
 * va_list, similar to vprintf.
 *
 * @param level
 *     The level at which to log this message.
 *
 * @param format
 *     A printf-style format string to log.
 *
 * @param args
 *     The va_list containing the arguments to be used when filling the format
 *     string for printing.
 */
void vguacenc_log(guac_client_log_level level, const char* format,
        va_list args);

/**
 * Writes a message to guacenc's logs. This function accepts parameters
 * identically to printf.
 *
 * @param level
 *     The level at which to log this message.
 *
 * @param format
 *     A printf-style format string to log.
 *
 * @param ...
 *     Arguments to use when filling the format string for printing.
 */
void guacenc_log(guac_client_log_level level, const char* format, ...);

#endif

