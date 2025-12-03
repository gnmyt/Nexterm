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

#include "config.h"

#include "guacamole/mem.h"
#include "guacamole/client.h"
#include "guacamole/error.h"
#include "guacamole/socket.h"
#include "guacamole/user.h"

#include <pthread.h>
#include <stdlib.h>

/**
 * A function that will broadcast arbitrary data to a subset of users for
 * the provided client, using the provided user callback for any user-specific
 * operations.
 *
 * @param client
 *     The guac_client associated with the users to broadcast to.
 *
 * @param callback
 *     A callback that should be invoked with each broadcasted user.
 *
 * @param data
 *     Arbitrary data that may be used to broadcast to the subset of users.
 */
typedef void guac_socket_broadcast_handler(
        guac_client* client, guac_user_callback* callback, void* data);

/**
 * Data associated with an open socket which writes to a subset of connected
 * users of a particular guac_client.
 */
typedef struct guac_socket_broadcast_data {

    /**
     * The guac_client whose connected users should receive all instructions
     * written to this socket.
     */
    guac_client* client;

    /**
     * Lock which is acquired when an instruction is being written, and
     * released when the instruction is finished being written.
     */
    pthread_mutex_t socket_lock;

    /**
     * The function to broadcast
     */
    guac_socket_broadcast_handler* broadcast_handler;

} guac_socket_broadcast_data;

/**
 * Single chunk of data, to be broadcast to all users.
 */
typedef struct __write_chunk {

    /**
     * The buffer to write.
     */
    const void* buffer;

    /**
     * The number of bytes in the buffer.
     */
    size_t length;

} __write_chunk;

/**
 * Callback which handles read requests on the broadcast socket. This callback
 * always fails, as the broadcast socket is write-only; it cannot be read.
 *
 * @param socket
 *     The broadcast socket to read from.
 *
 * @param buf
 *     The buffer into which data should be read.
 *
 * @param count
 *     The number of bytes to attempt to read.
 *
 * @return
 *     The number of bytes read, or -1 if an error occurs. This implementation
 *     always returns -1, as the broadcast socket is write-only and cannot be
 *     read.
 */
static ssize_t __guac_socket_broadcast_read_handler(guac_socket* socket,
        void* buf, size_t count) {

    /* Broadcast socket reads are not allowed */
    return -1;

}

/**
 * Callback invoked by the broadcast handler which write a given chunk of
 * data to that user's socket. If the write attempt fails, the user is
 * signalled to stop with guac_user_stop().
 *
 * @param user
 *     The user that the chunk of data should be written to.
 *
 * @param data
 *     A pointer to a __write_chunk which describes the data to be written.
 *
 * @return
 *     Always NULL.
 */
static void* __write_chunk_callback(guac_user* user, void* data) {

    __write_chunk* chunk = (__write_chunk*) data;

    /* Attempt write, disconnect on failure */
    if (guac_socket_write(user->socket, chunk->buffer, chunk->length))
        guac_user_stop(user);

    return NULL;

}

/**
 * Socket write handler which operates on each of the sockets of all connected
 * users. This write handler will always succeed, but any failing user-specific
 * writes will invoke guac_user_stop() on the failing user.
 *
 * @param socket
 *     The socket to which the given data must be written.
 *
 * @param buf
 *     The buffer containing the data to write.
 *
 * @param count
 *     The number of bytes to attempt to write from the given buffer.
 *
 * @return
 *     The number of bytes written, or -1 if an error occurs. This handler will
 *     always succeed, and thus will always return the exact number of bytes
 *     specified by count.
 */
static ssize_t __guac_socket_broadcast_write_handler(guac_socket* socket,
        const void* buf, size_t count) {

    guac_socket_broadcast_data* data =
        (guac_socket_broadcast_data*) socket->data;

    /* Build chunk */
    __write_chunk chunk;
    chunk.buffer = buf;
    chunk.length = count;

    /* Broadcast chunk to the users */
    data->broadcast_handler(data->client, __write_chunk_callback, &chunk);

    return count;

}

/**
 * Callback which is invoked by the broadcast handler to flush all
 * pending data on the given user's socket. If an error occurs while flushing
 * a user's socket, that user is signalled to stop with guac_user_stop().
 *
 * @param user
 *     The user whose socket should be flushed.
 *
 * @param data
 *     Arbitrary data passed to the broadcast handler. This is not needed
 *     by this callback, and should be left as NULL.
 *
 * @return
 *     Always NULL.
 */
static void* __flush_callback(guac_user* user, void* data) {

    /* Attempt flush, disconnect on failure */
    if (guac_socket_flush(user->socket))
        guac_user_stop(user);

    return NULL;

}

/**
 * Socket flush handler which operates on each of the sockets of all connected
 * users. This flush handler will always succeed, but any failing user-specific
 * flush will invoke guac_user_stop() on the failing user.
 *
 * @param socket
 *     The broadcast socket to flush.
 *
 * @return
 *     Zero if the flush operation succeeds, non-zero if the operation fails.
 *     This handler will always succeed, and thus will always return zero.
 */
static ssize_t __guac_socket_broadcast_flush_handler(guac_socket* socket) {

    guac_socket_broadcast_data* data =
        (guac_socket_broadcast_data*) socket->data;

    /* Flush the users */
    data->broadcast_handler(data->client, __flush_callback, NULL);

    return 0;

}

/**
 * Callback which is invoked by the broadcast handler to lock the given
 * user's socket in preparation for the beginning of a Guacamole protocol
 * instruction.
 *
 * @param user
 *     The user whose socket should be locked.
 *
 * @param data
 *     Arbitrary data passed to the broadcast handler. This is not needed
 *     by this callback, and should be left as NULL.
 *
 * @return
 *     Always NULL.
 */
static void* __lock_callback(guac_user* user, void* data) {

    /* Lock socket */
    guac_socket_instruction_begin(user->socket);

    return NULL;

}

/**
 * Socket lock handler which acquires the socket locks of all connected users.
 * Socket-level locks are acquired in preparation for the beginning of a new
 * Guacamole instruction to ensure that parallel writes are only interleaved at
 * instruction boundaries.
 *
 * @param socket
 *     The broadcast socket to lock.
 */
static void __guac_socket_broadcast_lock_handler(guac_socket* socket) {

    guac_socket_broadcast_data* data =
        (guac_socket_broadcast_data*) socket->data;

    /* Acquire exclusive access to socket */
    pthread_mutex_lock(&(data->socket_lock));

    /* Lock sockets of the users */
    data->broadcast_handler(data->client, __lock_callback, NULL);

}

/**
 * Callback which is invoked by the broadcast handler to unlock the given
 * user's socket at the end of a Guacamole protocol instruction.
 *
 * @param user
 *     The user whose socket should be unlocked.
 *
 * @param data
 *     Arbitrary data passed to the broadcast handler. This is not needed
 *     by this callback, and should be left as NULL.
 *
 * @return
 *     Always NULL.
 */
static void* __unlock_callback(guac_user* user, void* data) {

    /* Unlock socket */
    guac_socket_instruction_end(user->socket);

    return NULL;

}

/**
 * Socket unlock handler which releases the socket locks of all connected users.
 * Socket-level locks are released after a Guacamole instruction has finished
 * being written.
 *
 * @param socket
 *     The broadcast socket to unlock.
 */
static void __guac_socket_broadcast_unlock_handler(guac_socket* socket) {

    guac_socket_broadcast_data* data =
        (guac_socket_broadcast_data*) socket->data;

    /* Unlock sockets of all users */
    data->broadcast_handler(data->client, __unlock_callback, NULL);

    /* Relinquish exclusive access to socket */
    pthread_mutex_unlock(&(data->socket_lock));

}

/**
 * Callback which handles select operations on the broadcast socket, waiting
 * for data to become available such that the next read operation will not
 * block. This callback always fails, as the broadcast socket is write-only; it
 * cannot be read.
 *
 * @param socket
 *     The broadcast socket to wait for.
 *
 * @param usec_timeout
 *     The maximum amount of time to wait for data, in microseconds, or -1 to
 *     potentially wait forever.
 *
 * @return
 *     A positive value on success, zero if the timeout elapsed and no data is
 *     available, or a negative value if an error occurs. This implementation
 *     always returns -1, as the broadcast socket is write-only and cannot be
 *     read.
 */
static int __guac_socket_broadcast_select_handler(guac_socket* socket,
        int usec_timeout) {

    /* Selecting the broadcast socket is not possible */
    return -1;

}

/**
 * Frees all implementation-specific data associated with the given socket, but
 * not the socket object itself.
 *
 * @param socket
 *     The guac_socket whose associated data should be freed.
 *
 * @return
 *     Zero if the data was successfully freed, non-zero otherwise. This
 *     implementation always succeeds, and will always return zero.
 */
static int __guac_socket_broadcast_free_handler(guac_socket* socket) {

    guac_socket_broadcast_data* data =
        (guac_socket_broadcast_data*) socket->data;

    /* Destroy locks */
    pthread_mutex_destroy(&(data->socket_lock));

    guac_mem_free(data);
    return 0;

}

/**
 * Construct and return a socket that will broadcast to the users given by
 * by the provided broadcast handler.
 *
 * @param client
 *     The client who's users are being broadcast to.
 *
 * @param broadcast_handler
 *     The handler that will perform the broadcast against a subset of users
 *     of the provided client.
 *
 * @return
 *     The newly constructed broadcast socket
 */
static guac_socket* __guac_socket_init(
        guac_client* client, guac_socket_broadcast_handler* broadcast_handler) {

    pthread_mutexattr_t lock_attributes;

    /* Allocate socket and associated data */
    guac_socket* socket = guac_socket_alloc();
    guac_socket_broadcast_data* data =
        guac_mem_alloc(sizeof(guac_socket_broadcast_data));

    /* Set the provided broadcast handler */
    data->broadcast_handler = broadcast_handler;

    /* Store client as socket data */
    data->client = client;
    socket->data = data;

    pthread_mutexattr_init(&lock_attributes);
    pthread_mutexattr_setpshared(&lock_attributes, PTHREAD_PROCESS_SHARED);

    /* Init lock */
    pthread_mutex_init(&(data->socket_lock), &lock_attributes);

    /* Set read/write handlers */
    socket->read_handler   = __guac_socket_broadcast_read_handler;
    socket->write_handler  = __guac_socket_broadcast_write_handler;
    socket->select_handler = __guac_socket_broadcast_select_handler;
    socket->flush_handler  = __guac_socket_broadcast_flush_handler;
    socket->lock_handler   = __guac_socket_broadcast_lock_handler;
    socket->unlock_handler = __guac_socket_broadcast_unlock_handler;
    socket->free_handler   = __guac_socket_broadcast_free_handler;

    return socket;

}

guac_socket* guac_socket_broadcast(guac_client* client) {

    /* Broadcast to all connected non-pending users*/
    return __guac_socket_init(client, guac_client_foreach_user);

}

guac_socket* guac_socket_broadcast_pending(guac_client* client) {

    /* Broadcast to all connected pending users*/
    return __guac_socket_init(client, guac_client_foreach_pending_user);

}

