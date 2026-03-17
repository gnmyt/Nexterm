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
#include "guacamole/protocol.h"
#include "guacamole/socket.h"
#include "guacamole/unicode.h"

#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/**
 * The maximum number of bytes to buffer before sending a "nest" instruction.
 * As some of the 8 KB space available for each instruction will be taken up by
 * the "nest" opcode and other parameters, and 1 KB will be more than enough
 * space for that extra data, this space is reduced to an even 7 KB.
 */
#define GUAC_SOCKET_NEST_BUFFER_SIZE 7168

/**
 * Internal data associated with an open socket which writes via a series of
 * "nest" instructions to some underlying, parent socket.
 */
typedef struct guac_socket_nest_data {

    /**
     * The underlying socket which should be used to write "nest" instructions.
     */
    guac_socket* parent;

    /**
     * The arbitrary index of the nested socket, assigned at time of
     * allocation.
     */
    int index;

    /**
     * The number of bytes currently in the main write buffer.
     */
    int written;

    /**
     * The main write buffer. Bytes written go here before being flushed
     * as nest instructions. Space is included for the null terminator
     * required by guac_protocol_send_nest().
     */
    char buffer[GUAC_SOCKET_NEST_BUFFER_SIZE];

    /**
     * Lock which is acquired when an instruction is being written, and
     * released when the instruction is finished being written.
     */
    pthread_mutex_t socket_lock;

    /**
     * Lock which protects access to the internal buffer of this socket,
     * guaranteeing atomicity of writes and flushes.
     */
    pthread_mutex_t buffer_lock;

} guac_socket_nest_data;

/**
 * Flushes the contents of the output buffer of the given socket immediately,
 * without first locking access to the output buffer. This function must ONLY
 * be called if the buffer lock has already been acquired.
 *
 * @param socket
 *     The guac_socket to flush.
 *
 * @return
 *     Zero if the flush operation was successful, non-zero otherwise.
 */
static ssize_t guac_socket_nest_flush(guac_socket* socket) {

    guac_socket_nest_data* data = (guac_socket_nest_data*) socket->data;

    /* Flush remaining bytes in buffer */
    if (data->written > 0) {

        /* Determine length of buffer containing complete UTF-8 characters
         * (buffer may end with a partial, multi-byte character) */
        int length = 0;
        while (length < data->written)
            length += guac_utf8_charsize(*(data->buffer + length));

        /* Add null terminator, preserving overwritten character for later
         * restoration (guac_protocol_send_nest() requires null-terminated
         * strings) */
        char overwritten = data->buffer[length];
        data->buffer[length] = '\0';

        /* Write ALL bytes in buffer as nest instruction */
        int retval = guac_protocol_send_nest(data->parent, data->index, data->buffer);

        /* Restore original value overwritten by null terminator */
        data->buffer[length] = overwritten;

        if (retval)
            return 1;

        /* Shift any remaining data to beginning of buffer */
        memcpy(data->buffer, data->buffer + length, data->written - length);
        data->written -= length;

    }

    return 0;

}

/**
 * Flushes the internal buffer of the given guac_socket, writing all data
 * to the underlying socket using "nest" instructions.
 *
 * @param socket
 *     The guac_socket to flush.
 *
 * @return
 *     Zero if the flush operation was successful, non-zero otherwise.
 */
static ssize_t guac_socket_nest_flush_handler(guac_socket* socket) {

    int retval;
    guac_socket_nest_data* data = (guac_socket_nest_data*) socket->data;

    /* Acquire exclusive access to buffer */
    pthread_mutex_lock(&(data->buffer_lock));

    /* Flush contents of buffer */
    retval = guac_socket_nest_flush(socket);

    /* Relinquish exclusive access to buffer */
    pthread_mutex_unlock(&(data->buffer_lock));

    return retval;

}

/**
 * Writes the contents of the buffer to the output buffer of the given socket,
 * flushing the output buffer as necessary, without first locking access to the
 * output buffer. This function must ONLY be called if the buffer lock has
 * already been acquired.
 *
 * @param socket
 *     The guac_socket to write the given buffer to.
 *
 * @param buf
 *     The buffer to write to the given socket.
 *
 * @param count
 *     The number of bytes in the given buffer.
 *
 * @return
 *     The number of bytes written, or a negative value if an error occurs
 *     during write.
 */
static ssize_t guac_socket_nest_write_buffered(guac_socket* socket,
        const void* buf, size_t count) {

    size_t original_count = count;
    const char* current = buf;
    guac_socket_nest_data* data = (guac_socket_nest_data*) socket->data;

    /* Append to buffer, flush if necessary */
    while (count > 0) {

        int chunk_size;

        /* Calculate space remaining, including one extra byte for the null
         * terminator added upon flush */
        int remaining = sizeof(data->buffer) - data->written - 1;

        /* If no space left in buffer, flush and retry */
        if (remaining == 0) {

            /* Abort if error occurs during flush */
            if (guac_socket_nest_flush(socket))
                return -1;

            /* Retry buffer append */
            continue;

        }

        /* Calculate size of chunk to be written to buffer */
        chunk_size = count;
        if (chunk_size > remaining)
            chunk_size = remaining;

        /* Update output buffer */
        memcpy(data->buffer + data->written, current, chunk_size);
        data->written += chunk_size;

        /* Update provided buffer */
        current += chunk_size;
        count   -= chunk_size;

    }

    /* All bytes have been written, possibly some to the internal buffer */
    return original_count;

}

/**
 * Appends the provided data to the internal buffer for future writing. The
 * actual write attempt will occur only upon flush, or when the internal buffer
 * is full.
 *
 * @param socket
 *     The guac_socket being write to.
 *
 * @param buf
 *     The arbitrary buffer containing the data to be written.
 *
 * @param count
 *     The number of bytes contained within the buffer.
 *
 * @return
 *     The number of bytes written, or -1 if an error occurs.
 */
static ssize_t guac_socket_nest_write_handler(guac_socket* socket,
        const void* buf, size_t count) {

    int retval;
    guac_socket_nest_data* data = (guac_socket_nest_data*) socket->data;
    
    /* Acquire exclusive access to buffer */
    pthread_mutex_lock(&(data->buffer_lock));

    /* Write provided data to buffer */
    retval = guac_socket_nest_write_buffered(socket, buf, count);

    /* Relinquish exclusive access to buffer */
    pthread_mutex_unlock(&(data->buffer_lock));

    return retval;

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
static int guac_socket_nest_free_handler(guac_socket* socket) {

    /* Free associated data */
    guac_socket_nest_data* data = (guac_socket_nest_data*) socket->data;
    guac_mem_free(data);

    return 0;

}

/**
 * Acquires exclusive access to the given socket.
 *
 * @param socket
 *     The guac_socket to which exclusive access is required.
 */
static void guac_socket_nest_lock_handler(guac_socket* socket) {

    guac_socket_nest_data* data = (guac_socket_nest_data*) socket->data;

    /* Acquire exclusive access to socket */
    pthread_mutex_lock(&(data->socket_lock));

}

/**
 * Relinquishes exclusive access to the given socket.
 *
 * @param socket
 *     The guac_socket to which exclusive access is no longer required.
 */
static void guac_socket_nest_unlock_handler(guac_socket* socket) {

    guac_socket_nest_data* data = (guac_socket_nest_data*) socket->data;

    /* Relinquish exclusive access to socket */
    pthread_mutex_unlock(&(data->socket_lock));

}

guac_socket* guac_socket_nest(guac_socket* parent, int index) {

    /* Allocate socket and associated data */
    guac_socket* socket = guac_socket_alloc();
    guac_socket_nest_data* data = guac_mem_alloc(sizeof(guac_socket_nest_data));

    /* Store nested socket details as socket data */
    data->parent = parent;
    data->index = index;
    socket->data = data;

    /* Set relevant handlers */
    socket->write_handler  = guac_socket_nest_write_handler;
    socket->lock_handler   = guac_socket_nest_lock_handler;
    socket->unlock_handler = guac_socket_nest_unlock_handler;
    socket->flush_handler  = guac_socket_nest_flush_handler;
    socket->free_handler   = guac_socket_nest_free_handler;

    return socket;

}

