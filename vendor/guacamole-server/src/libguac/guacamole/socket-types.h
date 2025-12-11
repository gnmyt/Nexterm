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

#ifndef _GUAC_SOCKET_TYPES_H
#define _GUAC_SOCKET_TYPES_H

/**
 * Type definitions related to the guac_socket object.
 *
 * @file socket-types.h
 */

/**
 * The core I/O object of Guacamole. guac_socket provides buffered input and
 * output as well as convenience methods for efficiently writing base64 data.
 */
typedef struct guac_socket guac_socket;

/**
 * Possible current states of a guac_socket.
 */
typedef enum guac_socket_state {

    /**
     * The socket is open and can be written to / read from.
     */
    GUAC_SOCKET_OPEN,

    /**
     * The socket is closed. Reads and writes will fail.
     */
    GUAC_SOCKET_CLOSED

} guac_socket_state;

#endif

