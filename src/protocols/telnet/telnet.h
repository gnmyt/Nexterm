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

#ifndef GUAC_TELNET_H
#define GUAC_TELNET_H

#include "config.h"
#include "settings.h"
#include "terminal/terminal.h"

#include <guacamole/recording.h>
#include <libtelnet.h>

#include <stdint.h>

/**
 * Telnet-specific client data.
 */
typedef struct guac_telnet_client {

    /**
     * Telnet connection settings.
     */
    guac_telnet_settings* settings;

    /**
     * The telnet client thread.
     */
    pthread_t client_thread;

    /**
     * The file descriptor of the socket connected to the telnet server,
     * or -1 if no connection has been established.
     */
    int socket_fd;

    /**
     * Telnet connection, used by the telnet client thread.
     */
    telnet_t* telnet;

    /**
     * Whether window size should be sent when the window is resized.
     */
    int naws_enabled;

    /**
     * Whether all user input should be automatically echoed to the
     * terminal.
     */
    int echo_enabled;

    /**
     * The terminal which will render all output from the telnet client.
     */
    guac_terminal* term;

    /**
     * The in-progress session recording, or NULL if no recording is in
     * progress.
     */
    guac_recording* recording;

} guac_telnet_client;

/**
 * Main telnet client thread, handling transfer of telnet output to STDOUT.
 */
void* guac_telnet_client_thread(void* data);

/**
 * Send a telnet NAWS message indicating the given terminal window dimensions
 * in characters.
 */
void guac_telnet_send_naws(telnet_t* telnet, uint16_t width, uint16_t height);

/**
 * Sends the given username by setting the remote USER environment variable
 * using the telnet NEW-ENVIRON option.
 */
void guac_telnet_send_user(telnet_t* telnet, const char* username);

#endif

