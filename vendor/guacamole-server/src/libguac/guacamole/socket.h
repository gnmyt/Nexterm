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

#ifndef _GUAC_SOCKET_H
#define _GUAC_SOCKET_H

/**
 * Defines the guac_socket object and functions for using and manipulating it.
 *
 * @file socket.h
 */

#include "client-types.h"
#include "socket-constants.h"
#include "socket-fntypes.h"
#include "socket-types.h"
#include "timestamp-types.h"

#include <pthread.h>
#include <stdint.h>
#include <unistd.h>

struct guac_socket {

    /**
     * Arbitrary socket-specific data.
     */
    void* data;

    /**
     * Handler which will be called when data needs to be read from the socket.
     */
    guac_socket_read_handler* read_handler;

    /**
     * Handler which will be called whenever data is written to this socket.
     */
    guac_socket_write_handler* write_handler;

    /**
     * Handler which will be called whenever this socket needs to be flushed.
     */
    guac_socket_flush_handler* flush_handler;

    /**
     * Handler which will be called whenever a socket needs to be acquired for
     * exclusive access, such as when an instruction is about to be written.
     */
    guac_socket_lock_handler* lock_handler;

    /**
     * Handler which will be called whenever exclusive access to a socket is
     * being released, such as when an instruction has finished being written.
     */
    guac_socket_unlock_handler* unlock_handler;

    /**
     * Handler which will be called whenever guac_socket_select() is invoked
     * on this socket.
     */
    guac_socket_select_handler* select_handler;

    /**
     * Handler which will be called when the socket is free'd (closed).
     */
    guac_socket_free_handler* free_handler;

    /**
     * The current state of this guac_socket.
     */
    guac_socket_state state;

    /**
     * The timestamp associated with the time the last block of data was
     * written to this guac_socket.
     */
    guac_timestamp last_write_timestamp;

    /**
     * The number of bytes present in the base64 "ready" buffer.
     */
    int __ready;

    /**
     * The base64 "ready" buffer. Once this buffer is filled, the data is encoded
     * as base64 and flushed to the main write buffer.
     */
    unsigned char __ready_buf[GUAC_SOCKET_BASE64_READY_BUFFER_SIZE];

    /**
     * The buffer to hold the result of encoding the ready buffer as base64.
     */
    char __encoded_buf[GUAC_SOCKET_BASE64_ENCODED_BUFFER_SIZE];

    /**
     * Whether automatic keep-alive is enabled.
     */
    int __keep_alive_enabled;

    /**
     * The keep-alive thread.
     */
    pthread_t __keep_alive_thread;

};

/**
 * Allocates a new, completely blank guac_socket. This guac_socket will do
 * absolutely nothing when used unless its handlers are defined.
 *
 * @returns A newly-allocated guac_socket, or NULL if the guac_socket could
 *          not be allocated.
 */
guac_socket* guac_socket_alloc();

/**
 * Frees the given guac_socket and all associated resources.
 *
 * @param socket The guac_socket to free.
 */
void guac_socket_free(guac_socket* socket);

/**
 * Declares that the given socket must automatically send a keep-alive ping
 * to ensure neither side of the socket times out while the socket is open.
 * This ping will take the form of a "nop" instruction.
 *
 * @param socket
 *     The guac_socket to declare as requiring an automatic keep-alive ping.
 */
void guac_socket_require_keep_alive(guac_socket* socket);

/**
 * Marks the beginning of a Guacamole protocol instruction.
 *
 * @param socket
 *     The guac_socket beginning an instruction.
 */
void guac_socket_instruction_begin(guac_socket* socket);

/**
 * Marks the end of a Guacamole protocol instruction.
 *
 * @param socket
 *     The guac_socket ending an instruction.
 */
void guac_socket_instruction_end(guac_socket* socket);

/**
 * Allocates and initializes a new guac_socket object with the given open
 * file descriptor. The file descriptor will be automatically closed when
 * the allocated guac_socket is freed.
 *
 * If an error occurs while allocating the guac_socket object, NULL is returned,
 * and guac_error is set appropriately.
 *
 * @param fd An open file descriptor that this guac_socket object should manage.
 * @return A newly allocated guac_socket object associated with the given
 *         file descriptor, or NULL if an error occurs while allocating
 *         the guac_socket object.
 */
guac_socket* guac_socket_open(int fd);

/**
 * Allocates and initializes a new guac_socket which writes all data via
 * nest instructions to the given existing, open guac_socket. Freeing the
 * returned guac_socket has no effect on the underlying, nested guac_socket.
 *
 * If an error occurs while allocating the guac_socket object, NULL is returned,
 * and guac_error is set appropriately.
 *
 * @deprecated
 *     The "nest" instruction and the corresponding guac_socket
 *     implementation are no longer necessary, having been replaced by
 *     the streaming instructions ("blob", "ack", "end"). Code using nested
 *     sockets or the "nest" instruction should instead write to a normal
 *     socket directly.
 *
 * @param parent The guac_socket this new guac_socket should write nest
 *               instructions to.
 * @param index The stream index to use for the written nest instructions.
 * @return A newly allocated guac_socket object associated with the given
 *         guac_socket and stream index, or NULL if an error occurs while
 *         allocating the guac_socket object.
 */
guac_socket* guac_socket_nest(guac_socket* parent, int index);

/**
 * Allocates and initializes a new guac_socket which delegates all socket
 * operations to the given primary socket, while simultaneously duplicating all
 * written data to the secondary socket. Freeing the returned guac_socket will
 * free both primary and secondary sockets.
 *
 * Return values (error codes) will come only from the primary socket. Locks
 * (like those used by guac_socket_instruction_begin() and
 * guac_socket_instruction_end()) will affect only the primary socket.
 *
 * If an error occurs while allocating the guac_socket object, NULL is returned,
 * and guac_error is set appropriately.
 *
 * @param primary
 *     The primary guac_socket to which all socket operations should be
 *     delegated. The error codes returned by socket operations, if any, will
 *     always come from this socket. This socket will also be the only socket
 *     locked when instructions begin (or unlocked when instructions end).
 *
 * @param secondary
 *     The secondary guac_socket to which all data written to the primary
 *     guac_socket should be copied. If an error prevents the write from
 *     succeeding, that error will be ignored. Only errors from the primary
 *     guac_socket will be acknowledged.
 *
 * @return
 *     A newly allocated guac_socket object associated with the given primary
 *     and secondary sockets, or NULL if an error occurs while allocating the
 *     guac_socket object.
 */
guac_socket* guac_socket_tee(guac_socket* primary, guac_socket* secondary);

/**
 * Allocates and initializes a new guac_socket which duplicates all
 * instructions written across the sockets of each connected user of the
 * given guac_client. The returned socket is a write-only socket. Attempts
 * to read from the socket will fail. If a write occurs while no users are
 * connected, that write will simply be dropped.
 *
 * Return values (error codes) from each user's socket will not affect the
 * in-progress write, but each failing user will be forcibly stopped with
 * guac_user_stop().
 *
 * If an error occurs while allocating the guac_socket object, NULL is returned,
 * and guac_error is set appropriately.
 *
 * @param client
 *     The client associated with the group of connected users across which
 *     duplicates of all instructions should be written.
 *
 * @return
 *     A write-only guac_socket object which broadcasts copies of all
 *     instructions written across all non-pending connected users of the given
 *     guac_client, or NULL if an error occurs while allocating the guac_socket
 *     object.
 */
guac_socket* guac_socket_broadcast(guac_client* client);

/**
 * Allocates and initializes a new guac_socket which duplicates all
 * instructions written across the sockets of each pending connected
 * user of the given guac_client. The returned socket is a write-only socket.
 * Attempts to read from the socket will fail.  If a write occurs while no
 * users are connected, that write will simply be dropped.
 *
 * Return values (error codes) from each user's socket will not affect the
 * in-progress write, but each failing user will be forcibly stopped with
 * guac_user_stop().
 *
 * If an error occurs while allocating the guac_socket object, NULL is returned,
 * and guac_error is set appropriately.
 *
 * @param client
 *     The client associated with the group of pending users across which
 *     duplicates of all instructions should be written.
 *
 * @return
 *     A write-only guac_socket object which broadcasts copies of all
 *     instructions written across all pending connected users of the given
 *     guac_client, or NULL if an error occurs while allocating the guac_socket
 *     object.
 */
guac_socket* guac_socket_broadcast_pending(guac_client* client);

/**
 * Writes the given unsigned int to the given guac_socket object. The data
 * written may be buffered until the buffer is flushed automatically or
 * manually.
 *
 * If an error occurs while writing, a non-zero value is returned, and
 * guac_error is set appropriately.
 *
 * @param socket The guac_socket object to write to.
 * @param i The unsigned int to write.
 * @return Zero on success, or non-zero if an error occurs while writing.
 */
ssize_t guac_socket_write_int(guac_socket* socket, int64_t i);

/**
 * Writes the given string to the given guac_socket object. The data
 * written may be buffered until the buffer is flushed automatically or
 * manually.
 *
 * If an error occurs while writing, a non-zero value is returned, and
 * guac_error is set appropriately.
 *
 * @param socket The guac_socket object to write to.
 * @param str The string to write.
 * @return Zero on success, or non-zero if an error occurs while writing.
*/
ssize_t guac_socket_write_string(guac_socket* socket, const char* str);

/**
 * Writes the given binary data to the given guac_socket object as base64-
 * encoded data. The data written may be buffered until the buffer is flushed
 * automatically or manually. Beware that, because base64 data is buffered
 * on top of the write buffer already used, a call to guac_socket_flush_base64()
 * MUST be made before non-base64 writes (or writes of an independent block of
 * base64 data) can be made.
 *
 * If an error occurs while writing, a non-zero value is returned, and
 * guac_error is set appropriately.
 *
 * @param socket The guac_socket object to write to.
 * @param buf A buffer containing the data to write.
 * @param count The number of bytes to write.
 * @return Zero on success, or non-zero if an error occurs while writing.
 */
ssize_t guac_socket_write_base64(guac_socket* socket, const void* buf, size_t count);

/**
 * Writes the given data to the specified socket. The data written may be
 * buffered until the buffer is flushed automatically or manually.
 *
 * If an error occurs while writing, a non-zero value is returned, and
 * guac_error is set appropriately.
 *
 * @param socket The guac_socket object to write to.
 * @param buf A buffer containing the data to write.
 * @param count The number of bytes to write.
 * @return Zero on success, or non-zero if an error occurs while writing.
 */
ssize_t guac_socket_write(guac_socket* socket, const void* buf, size_t count);

/**
 * Attempts to read data from the socket, filling up to the specified number
 * of bytes in the given buffer.
 *
 * If an error occurs while writing, a non-zero value is returned, and
 * guac_error is set appropriately.
 *
 * @param socket The guac_socket to read from.
 * @param buf The buffer to read bytes into.
 * @param count The maximum number of bytes to read.
 * @return The number of bytes read, or non-zero if an error occurs while
 *         reading.
 */
ssize_t guac_socket_read(guac_socket* socket, void* buf, size_t count);

/**
 * Flushes the base64 buffer, writing padding characters as necessary.
 *
 * If an error occurs while writing, a non-zero value is returned, and
 * guac_error is set appropriately.
 *
 * @param socket The guac_socket object to flush
 * @return Zero on success, or non-zero if an error occurs during flush.
 */
ssize_t guac_socket_flush_base64(guac_socket* socket);

/**
 * Flushes the write buffer.
 *
 * If an error occurs while writing, a non-zero value is returned, and
 * guac_error is set appropriately.
 *
 * @param socket The guac_socket object to flush
 * @return Zero on success, or non-zero if an error occurs during flush.
 */
ssize_t guac_socket_flush(guac_socket* socket);

/**
 * Waits for input to be available on the given guac_socket object until the
 * specified timeout elapses.
 *
 * If an error occurs while waiting, a negative value is returned, and
 * guac_error is set appropriately.
 *
 * If a timeout occurs while waiting, zero value is returned, and
 * guac_error is set to GUAC_STATUS_INPUT_TIMEOUT.
 *
 * @param socket The guac_socket object to wait for.
 * @param usec_timeout The maximum number of microseconds to wait for data, or
 *                     -1 to potentially wait forever.
 * @return Positive on success, zero if the timeout elapsed and no data is
 *         available, negative on error.
 */
int guac_socket_select(guac_socket* socket, int usec_timeout);

#endif

