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

#ifndef GUACD_CONNECTION_H
#define GUACD_CONNECTION_H

#include "config.h"

#include "proc-map.h"

#ifdef ENABLE_SSL
#include <openssl/ssl.h>
#endif

/**
 * Parameters required by each connection thread.
 */
typedef struct guacd_connection_thread_params {

    /**
     * The shared map of all connected clients.
     */
    guacd_proc_map* map;

#ifdef ENABLE_SSL
    /**
     * SSL context for encrypted connections to guacd. If SSL is not active,
     * this will be NULL.
     */
    SSL_CTX* ssl_context;
#endif

    /**
     * The file descriptor associated with the newly-accepted connection.
     */
    int connected_socket_fd;

} guacd_connection_thread_params;

/**
 * Handles an inbound connection to guacd, allowing guacd to continue listening
 * for other connections. The file descriptor of the inbound connection will
 * either be given to a new process for a new remote desktop connection, or
 * will be passed to an existing process for joining an existing remote desktop
 * connection. It is expected that this thread will operate detached. The
 * creating process need not join on the resulting thread.
 *
 * @param data
 *     A pointer to a guacd_connection_thread_params structure containing the
 *     shared overall map of currently-connected processes, the file
 *     descriptor associated with the newly-established connection that is to
 *     be either (1) associated with a new process or (2) passed on to an
 *     existing process, and the SSL context for the encryption surrounding
 *     that connection (if any).
 *
 * @return
 *     Always NULL.
 */
void* guacd_connection_thread(void* data);

/**
 * Parameters required by the per-connection I/O transfer thread.
 */
typedef struct guacd_connection_io_thread_params {

    /**
     * The guac_parser which may contain buffered, but unparsed, data from the
     * original guac_socket which must be transferred to the
     * connection-specific process.
     */
    guac_parser* parser;

    /**
     * The guac_socket which is directly handling I/O from a user's connection
     * to guacd.
     */
    guac_socket* socket;

    /**
     * The file descriptor which is being handled by a guac_socket within the
     * connection-specific process.
     */
    int fd;

} guacd_connection_io_thread_params;

/**
 * Transfers data back and forth between the guacd-side guac_socket and the
 * file descriptor used by the process-side guac_socket. Note that both the
 * provided guac_parser and the guac_socket will be freed once this thread
 * terminates, which will occur when no further data can be read from the
 * guac_socket.
 *
 * @param data
 *     A pointer to a guacd_connection_io_thread_params structure containing
 *     the guac_socket and file descriptor to transfer data between
 *     (bidirectionally), as well as the guac_parser associated with the
 *     guac_socket (which may have unhandled data in its parsing buffers).
 *
 * @return
 *     Always NULL.
 */
void* guacd_connection_io_thread(void* data);

#endif

