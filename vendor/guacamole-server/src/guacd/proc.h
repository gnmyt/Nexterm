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

#ifndef GUACD_PROC_H
#define GUACD_PROC_H

#include "config.h"

#include <guacamole/client.h>
#include <guacamole/parser.h>

#include <unistd.h>

/**
 * The number of milliseconds to wait for messages in any phase before
 * timing out and closing the connection with an error.
 */
#define GUACD_TIMEOUT 15000

/**
 * The number of microseconds to wait for messages in any phase before
 * timing out and closing the connection with an error. This is always
 * equal to GUACD_TIMEOUT * 1000.
 */
#define GUACD_USEC_TIMEOUT (GUACD_TIMEOUT*1000)

/**
 * The number of seconds to wait for any particular guac_client instance
 * to be freed following disconnect. If the free operation does not complete
 * within this period of time, the associated process will be forcibly
 * terminated.
 */
#define GUACD_CLIENT_FREE_TIMEOUT 5

/**
 * Process information of the internal remote desktop client.
 */
typedef struct guacd_proc {

    /**
     * The process ID of the client. This will only be available to the
     * parent process. The child process will see this as 0.
     */
    pid_t pid;

    /**
     * The file descriptor of the UNIX domain socket to use for sending and
     * receiving file descriptors of new users. This parent will see this
     * as the file descriptor for communicating with the child and vice
     * versa.
     */
    int fd_socket;

    /**
     * The actual client instance. This will be visible to both child and
     * parent process, but only the child will have a full guac_client
     * instance, containing handlers from the plugin, etc.
     *
     * The parent process will receive a skeleton guac_client, containing only
     * a proper connection_id and logging handlers. The actual
     * protocol-specific handling will be absent.
     */
    guac_client* client;

} guacd_proc;

/**
 * Creates a new background process for handling the given protocol, returning
 * a structure allowing communication with and monitoring of the process
 * created. Within the child process, this function does not return - the
 * entire child process simply terminates instead.
 *
 * @param protocol
 *     The protocol for which this process is client being created.
 *
 * @return
 *     A newly-allocated process structure pointing to the file descriptor of
 *     the background process specific to the specified protocol, or NULL of
 *     the process could not be created.
 */
guacd_proc* guacd_create_proc(const char* protocol);

/**
 * Signals the given process to stop accepting new users and clean up. This
 * will eventually cause the child process to exit.
 *
 * @param proc
 *     The process to stop.
 */
void guacd_proc_stop(guacd_proc* proc);

#endif

