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
#include "guacamole/error.h"
#include "guacamole/socket.h"
#include "wait-fd.h"

#include <pthread.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/time.h>
#include <unistd.h>

#ifdef ENABLE_WINSOCK
#include <winsock2.h>
#endif

/**
 * Data associated with an open socket which writes to a file descriptor.
 */
typedef struct guac_socket_fd_data {

    /**
     * The associated file descriptor;
     */
    int fd;

    /**
     * The number of bytes currently in the main write buffer.
     */
    int written;

    /**
     * The main write buffer. Bytes written go here before being flushed
     * to the open file descriptor.
     */
    char out_buf[GUAC_SOCKET_OUTPUT_BUFFER_SIZE];

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

} guac_socket_fd_data;

/**
 * Writes the entire contents of the given buffer to the file descriptor
 * associated with the given socket, retrying as necessary until the whole
 * buffer is written, and aborting if an error occurs.
 *
 * @param socket
 *     The guac_socket associated with the file descriptor to which the given
 *     buffer should be written.
 *
 * @param buf
 *     The buffer of data to write to the given guac_socket.
 *
 * @param count
 *     The number of bytes within the given buffer.
 *
 * @return
 *     The number of bytes written, which will be exactly the size of the given
 *     buffer, or a negative value if an error occurs.
 */
ssize_t guac_socket_fd_write(guac_socket* socket,
        const void* buf, size_t count) {

    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;
    const char* buffer = buf;

    /* Write until completely written */
    while (count > 0) {

        int retval;

#ifdef ENABLE_WINSOCK
        /* WSA only works with send() */
        retval = send(data->fd, buffer, count, 0);
#else
        /* Use write() for all other platforms */
        retval = write(data->fd, buffer, count);
#endif

        /* Record errors in guac_error */
        if (retval < 0) {
            guac_error = GUAC_STATUS_SEE_ERRNO;
            guac_error_message = "Error writing data to socket";
            return retval;
        }

        /* Advance buffer to next chunk */
        buffer += retval;
        count  -= retval;

    }

    return 0;

}

/**
 * Attempts to read from the underlying file descriptor of the given
 * guac_socket, populating the given buffer.
 *
 * @param socket
 *     The guac_socket being read from.
 *
 * @param buf
 *     The arbitrary buffer which we must populate with data.
 *
 * @param count
 *     The maximum number of bytes to read into the buffer.
 *
 * @return
 *     The number of bytes read, or -1 if an error occurs.
 */
static ssize_t guac_socket_fd_read_handler(guac_socket* socket,
        void* buf, size_t count) {

    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;

    int retval;

#ifdef ENABLE_WINSOCK
    /* Winsock only works with recv() */
    retval = recv(data->fd, buf, count, 0);
#else
    /* Use read() for all other platforms */
    retval = read(data->fd, buf, count);
#endif

    /* Record errors in guac_error */
    if (retval < 0) {
        guac_error = GUAC_STATUS_SEE_ERRNO;
        guac_error_message = "Error reading data from socket";
    }

    return retval;

}

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
static ssize_t guac_socket_fd_flush(guac_socket* socket) {

    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;

    /* Flush remaining bytes in buffer */
    if (data->written > 0) {

        /* Write ALL bytes in buffer immediately */
        if (guac_socket_fd_write(socket, data->out_buf, data->written))
            return 1;

        data->written = 0;
    }

    return 0;

}

/**
 * Flushes the internal buffer of the given guac_socket, writing all data
 * to the underlying file descriptor.
 *
 * @param socket
 *     The guac_socket to flush.
 *
 * @return
 *     Zero if the flush operation was successful, non-zero otherwise.
 */
static ssize_t guac_socket_fd_flush_handler(guac_socket* socket) {

    int retval;
    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;

    /* Acquire exclusive access to buffer */
    pthread_mutex_lock(&(data->buffer_lock));

    /* Flush contents of buffer */
    retval = guac_socket_fd_flush(socket);

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
static ssize_t guac_socket_fd_write_buffered(guac_socket* socket,
        const void* buf, size_t count) {

    size_t original_count = count;
    const char* current = buf;
    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;

    /* Append to buffer, flush if necessary */
    while (count > 0) {

        int chunk_size;
        int remaining = sizeof(data->out_buf) - data->written;

        /* If no space left in buffer, flush and retry */
        if (remaining == 0) {

            /* Abort if error occurs during flush */
            if (guac_socket_fd_flush(socket))
                return -1;

            /* Retry buffer append */
            continue;

        }

        /* Calculate size of chunk to be written to buffer */
        chunk_size = count;
        if (chunk_size > remaining)
            chunk_size = remaining;

        /* Update output buffer */
        memcpy(data->out_buf + data->written, current, chunk_size);
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
static ssize_t guac_socket_fd_write_handler(guac_socket* socket,
        const void* buf, size_t count) {

    int retval;
    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;
    
    /* Acquire exclusive access to buffer */
    pthread_mutex_lock(&(data->buffer_lock));

    /* Write provided data to buffer */
    retval = guac_socket_fd_write_buffered(socket, buf, count);

    /* Relinquish exclusive access to buffer */
    pthread_mutex_unlock(&(data->buffer_lock));

    return retval;

}

/**
 * Waits for data on the underlying file descriptor of the given socket to
 * become available such that the next read operation will not block.
 *
 * @param socket
 *     The guac_socket to wait for.
 *
 * @param usec_timeout
 *     The maximum amount of time to wait for data, in microseconds, or -1 to
 *     potentially wait forever.
 *
 * @return
 *     A positive value on success, zero if the timeout elapsed and no data is
 *     available, or a negative value if an error occurs.
 */
static int guac_socket_fd_select_handler(guac_socket* socket,
        int usec_timeout) {

    /* Wait for data on socket */
    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;
    int retval = guac_wait_for_fd(data->fd, usec_timeout);

    /* Properly set guac_error */
    if (retval <  0) {
        guac_error = GUAC_STATUS_SEE_ERRNO;
        guac_error_message = "Error while waiting for data on socket";
    }

    else if (retval == 0) {
        guac_error = GUAC_STATUS_TIMEOUT;
        guac_error_message = "Timeout while waiting for data on socket";
    }

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
static int guac_socket_fd_free_handler(guac_socket* socket) {

    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;

    /* Destroy locks */
    pthread_mutex_destroy(&(data->socket_lock));
    pthread_mutex_destroy(&(data->buffer_lock));

    /* Close file descriptor */
    close(data->fd);

    guac_mem_free(data);
    return 0;

}

/**
 * Acquires exclusive access to the given socket.
 *
 * @param socket
 *     The guac_socket to which exclusive access is required.
 */
static void guac_socket_fd_lock_handler(guac_socket* socket) {

    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;

    /* Acquire exclusive access to socket */
    pthread_mutex_lock(&(data->socket_lock));

}

/**
 * Relinquishes exclusive access to the given socket.
 *
 * @param socket
 *     The guac_socket to which exclusive access is no longer required.
 */
static void guac_socket_fd_unlock_handler(guac_socket* socket) {

    guac_socket_fd_data* data = (guac_socket_fd_data*) socket->data;

    /* Relinquish exclusive access to socket */
    pthread_mutex_unlock(&(data->socket_lock));

}

guac_socket* guac_socket_open(int fd) {

    pthread_mutexattr_t lock_attributes;

    /* Allocate socket and associated data */
    guac_socket* socket = guac_socket_alloc();
    guac_socket_fd_data* data = guac_mem_alloc(sizeof(guac_socket_fd_data));

    /* Store file descriptor as socket data */
    data->fd = fd;
    data->written = 0;
    socket->data = data;

    pthread_mutexattr_init(&lock_attributes);
    pthread_mutexattr_setpshared(&lock_attributes, PTHREAD_PROCESS_SHARED);

    /* Init locks */
    pthread_mutex_init(&(data->socket_lock), &lock_attributes);
    pthread_mutex_init(&(data->buffer_lock), &lock_attributes);
    
    /* Set read/write handlers */
    socket->read_handler   = guac_socket_fd_read_handler;
    socket->write_handler  = guac_socket_fd_write_handler;
    socket->select_handler = guac_socket_fd_select_handler;
    socket->lock_handler   = guac_socket_fd_lock_handler;
    socket->unlock_handler = guac_socket_fd_unlock_handler;
    socket->flush_handler  = guac_socket_fd_flush_handler;
    socket->free_handler   = guac_socket_fd_free_handler;

    return socket;

}

