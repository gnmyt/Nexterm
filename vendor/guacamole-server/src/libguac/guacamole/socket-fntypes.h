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

#ifndef _GUAC_SOCKET_FNTYPES_H
#define _GUAC_SOCKET_FNTYPES_H

/**
 * Function type definitions related to the guac_socket object.
 *
 * @file socket-fntypes.h
 */

#include "socket-types.h"

#include <unistd.h>

/**
 * Generic read handler for socket read operations, modeled after the standard
 * POSIX read() function. When set within a guac_socket, a handler of this type
 * will be called when data needs to be read into the socket.
 *
 * @param socket The guac_socket being read from.
 * @param buf The arbitrary buffer we must populate with data.
 * @param count The maximum number of bytes to read into the buffer.
 * @return The number of bytes read, or -1 if an error occurs.
 */
typedef ssize_t guac_socket_read_handler(guac_socket* socket,
        void* buf, size_t count);

/**
 * Generic write handler for socket write operations, modeled after the standard
 * POSIX write() function. When set within a guac_socket, a handler of this type
 * will be called when data needs to be written to the socket.
 *
 * @param socket The guac_socket being written to.
 * @param buf The arbitrary buffer containing data to be written.
 * @param count The maximum number of bytes to written to the buffer.
 * @return The number of bytes written, or -1 if an error occurs.
 */
typedef ssize_t guac_socket_write_handler(guac_socket* socket,
        const void* buf, size_t count);

/**
 * Generic handler for socket select operations, similar to the POSIX select()
 * function. When guac_socket_select() is called on a guac_socket, its
 * guac_socket_select_handler will be invoked, if defined.
 *
 * @param socket The guac_socket being selected.
 * @param usec_timeout The maximum number of microseconds to wait for data, or
 *                     -1 to potentially wait forever.
 * @return Positive on success, zero if the timeout elapsed and no data is
 *         available, negative on error.
 */
typedef int guac_socket_select_handler(guac_socket* socket, int usec_timeout);

/**
 * Generic flush handler for socket flush operations. This function is not
 * modeled after any POSIX function. When set within a guac_socket, a handler
 * of this type will be called when guac_socket_flush() is called.
 *
 * @param socket
 *     The guac_socket being flushed.
 *
 * @return
 *     Zero on success, or non-zero if an error occurs during flush.
 */
typedef ssize_t guac_socket_flush_handler(guac_socket* socket);

/**
 * When set within a guac_socket, a handler of this type will be called
 * whenever exclusive access to the guac_socket is required, such as when
 * guac_socket_instruction_begin() is called.
 *
 * @param socket
 *     The guac_socket to which exclusive access is required.
 */
typedef void guac_socket_lock_handler(guac_socket* socket);

/**
 * When set within a guac_socket, a handler of this type will be called
 * whenever exclusive access to the guac_socket is no longer required, such as
 * when guac_socket_instruction_end() is called.
 *
 * @param socket
 *     The guac_socket to which exclusive access is no longer required.
 */
typedef void guac_socket_unlock_handler(guac_socket* socket);

/**
 * Generic handler for the closing of a socket, modeled after the standard
 * POSIX close() function. When set within a guac_socket, a handler of this type
 * will be called when the socket is closed.
 *
 * @param socket The guac_socket being closed.
 * @return Zero on success, or -1 if an error occurs.
 */
typedef int guac_socket_free_handler(guac_socket* socket);

#endif

