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

#ifndef _GUAC_CLIENT_FNTYPES_H
#define _GUAC_CLIENT_FNTYPES_H

/**
 * Function type definitions related to the Guacamole client structure,
 * guac_client.
 *
 * @file client-fntypes.h
 */

#include "client-types.h"
#include "object-types.h"
#include "protocol-types.h"
#include "socket.h"
#include "stream-types.h"
#include "user-fntypes.h"
#include "user-types.h"

#include <stdarg.h>

/**
 * Handler for freeing up any extra data allocated by the client
 * implementation.
 *
 * @param client
 *     The client whose extra data should be freed (if any).
 *
 * @return
 *     Zero if the data was successfully freed, non-zero if an error prevents
 *     the data from being freed.
 */
typedef int guac_client_free_handler(guac_client* client);

/**
 * Handler that will run before immediately before pending users are promoted
 * to full users. The pending user socket should be used to communicate to the
 * pending users.
 *
 * @param client
 *     The client whose handler was invoked.
 *
 * @return
 *     Zero if the pending handler ran successfully, or a non-zero value if an
 *     error occurred.
 */
typedef int guac_client_join_pending_handler(guac_client* client);

/**
 * Handler for logging messages related to a given guac_client instance.
 *
 * @param client
 *     The client related to the message being logged.
 *
 * @param level
 *     The log level at which to log the given message.
 *
 * @param format
 *     A printf-style format string, defining the message to be logged.
 *
 * @param args
 *     The va_list containing the arguments to be used when filling the
 *     conversion specifiers ("%s", "%i", etc.) within the format string.
 */
typedef void guac_client_log_handler(guac_client* client,
        guac_client_log_level level, const char* format, va_list args);

/**
 * The entry point of a client plugin which must initialize the given
 * guac_client. In practice, this function will be called "guac_client_init".
 *
 * @param client
 *     The guac_client that must be initialized.
 *
 * @return
 *     Zero on success, non-zero if initialization fails for any reason.
 */
typedef int guac_client_init_handler(guac_client* client);

#endif

