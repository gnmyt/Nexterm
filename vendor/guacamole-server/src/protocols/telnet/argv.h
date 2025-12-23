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

#ifndef GUAC_TELNET_ARGV_H
#define GUAC_TELNET_ARGV_H

#include "config.h"

#include <guacamole/argv.h>
#include <guacamole/user.h>

/**
 * The name of the parameter that specifies/updates the color scheme used by
 * the terminal emulator.
 */
#define GUAC_TELNET_ARGV_COLOR_SCHEME "color-scheme"

/**
 * The name of the parameter that specifies/updates the name of the font used
 * by the terminal emulator.
 */
#define GUAC_TELNET_ARGV_FONT_NAME "font-name"

/**
 * The name of the parameter that specifies/updates the font size used by the
 * terminal emulator.
 */
#define GUAC_TELNET_ARGV_FONT_SIZE "font-size"

/**
 * Handles a received argument value from a Guacamole "argv" instruction,
 * updating the given connection parameter.
 */
guac_argv_callback guac_telnet_argv_callback;

/**
 * Sends the current values of all non-sensitive parameters which may be set
 * while the connection is running to the given user. Note that the user
 * receiving these values will not necessarily be able to set new values
 * themselves if their connection is read-only. This function can be used as
 * the callback for guac_client_foreach_user() and guac_client_for_owner()
 *
 * @param user
 *     The user that should receive the values of all non-sensitive parameters
 *     which may be set while the connection is running.
 *
 * @param data
 *     The guac_telnet_client instance associated with the current connection.
 *
 * @return
 *     Always NULL.
 */
void* guac_telnet_send_current_argv(guac_user* user, void* data);

/**
 * Sends the current values of all non-sensitive parameters which may be set
 * while the connection is running to the users associated with the provided
 * socket. Note that the users receiving these values will not necessarily be
 * able to set new values themselves if their connection is read-only.
 *
 * @param client
 *     The client associated with the users that should receive the values of
 *     all non-sensitive parameters which may be set while the connection is running.
 *
 * @param socket
 *     The socket to the arguments to the batch of users along.
 *
 * @return
 *     Always NULL.
 */
void guac_telnet_send_current_argv_batch(
        guac_client* client, guac_socket* socket);

#endif

