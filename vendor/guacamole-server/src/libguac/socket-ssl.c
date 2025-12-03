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
#include "guacamole/socket-ssl.h"
#include "guacamole/socket.h"
#include "wait-fd.h"

#include <pthread.h>
#include <stdlib.h>

#include <openssl/ssl.h>

static ssize_t __guac_socket_ssl_read_handler(guac_socket* socket,
        void* buf, size_t count) {

    /* Read from socket */
    guac_socket_ssl_data* data = (guac_socket_ssl_data*) socket->data;
    int retval;

    retval = SSL_read(data->ssl, buf, count);

    /* Record errors in guac_error */
    if (retval <= 0) {
        guac_error = GUAC_STATUS_SEE_ERRNO;
        guac_error_message = "Error reading data from secure socket";
    }

    return retval;

}

static ssize_t __guac_socket_ssl_write_handler(guac_socket* socket,
        const void* buf, size_t count) {

    /* Write data to socket */
    guac_socket_ssl_data* data = (guac_socket_ssl_data*) socket->data;
    int retval;

    retval = SSL_write(data->ssl, buf, count);

    /* Record errors in guac_error */
    if (retval <= 0) {
        guac_error = GUAC_STATUS_SEE_ERRNO;
        guac_error_message = "Error writing data to secure socket";
    }

    return retval;

}

static int __guac_socket_ssl_select_handler(guac_socket* socket, int usec_timeout) {

    guac_socket_ssl_data* data = (guac_socket_ssl_data*) socket->data;
    int retval = guac_wait_for_fd(data->fd, usec_timeout);

    /* Properly set guac_error */
    if (retval <  0) {
        guac_error = GUAC_STATUS_SEE_ERRNO;
        guac_error_message = "Error while waiting for data on secure socket";
    }

    else if (retval == 0) {
        guac_error = GUAC_STATUS_TIMEOUT;
        guac_error_message = "Timeout while waiting for data on secure socket";
    }

    return retval;

}

static int __guac_socket_ssl_free_handler(guac_socket* socket) {

    /* Shutdown SSL */
    guac_socket_ssl_data* data = (guac_socket_ssl_data*) socket->data;
    SSL_shutdown(data->ssl);
    SSL_free(data->ssl);

    /* Close file descriptor */
    close(data->fd);

    pthread_mutex_destroy(&(data->socket_lock));

    guac_mem_free(data);
    return 0;
}

/**
 * Acquires exclusive access to the given socket.
 *
 * @param socket
 *      The guac_socket to which exclusive access is requested.
 */
static void __guac_socket_ssl_lock_handler(guac_socket* socket) {

    guac_socket_ssl_data* data = (guac_socket_ssl_data*) socket->data;

    /* Acquire exclusive access to the socket */
    pthread_mutex_lock(&(data->socket_lock));

}

/**
 * Releases exclusive access to the given socket.
 *
 * @param socket
 *      The guac_socket to which exclusive access is released.
 */
static void __guac_socket_ssl_unlock_handler(guac_socket* socket) {

    guac_socket_ssl_data* data = (guac_socket_ssl_data*) socket->data;

    /* Relinquish exclusive access to the socket */
    pthread_mutex_unlock(&(data->socket_lock));

}

guac_socket* guac_socket_open_secure(SSL_CTX* context, int fd) {

    /* Create new SSL structure */
    SSL* ssl = SSL_new(context);
    if (ssl == NULL)
        return NULL;

    /* Allocate socket and associated data */
    guac_socket* socket = guac_socket_alloc();
    guac_socket_ssl_data* data = guac_mem_alloc(sizeof(guac_socket_ssl_data));

    /* Init SSL */
    data->context = context;
    data->ssl = ssl;
    SSL_set_fd(data->ssl, fd);

    /* Accept SSL connection, handle errors */
    if (SSL_accept(ssl) <= 0) {

        guac_error = GUAC_STATUS_INTERNAL_ERROR;
        guac_error_message = "SSL accept failed";

        guac_mem_free(data);
        guac_socket_free(socket);
        SSL_free(ssl);
        return NULL;
    }

    pthread_mutexattr_t lock_attributes;
    pthread_mutexattr_init(&lock_attributes);
    pthread_mutexattr_setpshared(&lock_attributes, PTHREAD_PROCESS_SHARED);
    pthread_mutex_init(&(data->socket_lock), &lock_attributes);

    /* Store file descriptor as socket data */
    data->fd = fd;
    socket->data = data;

    /* Set read/write handlers */
    socket->read_handler   = __guac_socket_ssl_read_handler;
    socket->write_handler  = __guac_socket_ssl_write_handler;
    socket->select_handler = __guac_socket_ssl_select_handler;
    socket->free_handler   = __guac_socket_ssl_free_handler;
    socket->lock_handler   = __guac_socket_ssl_lock_handler;
    socket->unlock_handler = __guac_socket_ssl_unlock_handler;

    return socket;

}

