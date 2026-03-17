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
#include "guacamole/error.h"
#include "guacamole/tcp.h"

#include <errno.h>
#include <fcntl.h>
#include <netdb.h>
#include <netinet/in.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>

int guac_tcp_connect(const char* hostname, const char* port, const int timeout) {

    int retval;

    int fd = EBADFD;
    struct addrinfo* addresses;
    struct addrinfo* current_address;

    char connected_address[1024];
    char connected_port[64];

    struct addrinfo hints = {
        .ai_family   = AF_UNSPEC,
        .ai_socktype = SOCK_STREAM,
        .ai_protocol = IPPROTO_TCP
    };

    /* Get addresses for requested hostname and port. */
    if ((retval = getaddrinfo(hostname, port, &hints, &addresses))) {
        guac_error = GUAC_STATUS_INVALID_ARGUMENT;
        guac_error_message = "Error parsing address or port.";
        return retval;
    }

    /* Attempt connection to each address until success */
    for (current_address = addresses; current_address != NULL; current_address = current_address->ai_next) {

        /* Resolve hostname */
        if ((retval = getnameinfo(current_address->ai_addr,
                current_address->ai_addrlen,
                connected_address, sizeof(connected_address),
                connected_port, sizeof(connected_port),
                NI_NUMERICHOST | NI_NUMERICSERV))) {

            guac_error = GUAC_STATUS_INVALID_ARGUMENT;
            guac_error_message = "Error resolving host.";
            continue;
        }

        /* Get socket or return the error. */
        fd = socket(current_address->ai_family, SOCK_STREAM, 0);
        if (fd < 0) {
            freeaddrinfo(addresses);
            return fd;
        }

        /* Variable to store current socket options. */
        int opt;

        /* Get current socket options */
        if ((opt = fcntl(fd, F_GETFL, NULL)) < 0) {
            guac_error = GUAC_STATUS_INVALID_ARGUMENT;
            guac_error_message = "Failed to retrieve socket options.";
            close(fd);
            continue;
        }

        /* Set socket to non-blocking */
        if (fcntl(fd, F_SETFL, opt | O_NONBLOCK) < 0) {
            guac_error = GUAC_STATUS_INVALID_ARGUMENT;
            guac_error_message = "Failed to set non-blocking socket.";
            close(fd);
            continue;
        }

        /* Structure that stores our timeout setting. */
        struct timeval tv;
        tv.tv_sec = timeout;
        tv.tv_usec = 0;

        /* Connect and wait for timeout */
        if ((retval = connect(fd, current_address->ai_addr, current_address->ai_addrlen)) < 0) {
            if (errno == EINPROGRESS) {
                /* Set up timeout. */
                fd_set fdset;
                FD_ZERO(&fdset);
                FD_SET(fd, &fdset);
                
                retval = select(fd + 1, NULL, &fdset, NULL, &tv);
            }
            
            else {
                guac_error = GUAC_STATUS_REFUSED;
                guac_error_message = "Unable to connect via socket.";
                close(fd);
                continue;
            }
        }

        /* Successful connection */
        if (retval > 0) {
            /* Restore previous socket options. */
            if (fcntl(fd, F_SETFL, opt) < 0) {
                guac_error = GUAC_STATUS_INVALID_ARGUMENT;
                guac_error_message = "Failed to reset socket options.";
                close(fd);
                continue;
            }

            break;
        }

        if (retval == 0) {
            guac_error = GUAC_STATUS_REFUSED;
            guac_error_message = "Timeout connecting via socket.";
        }
        else {
            guac_error = GUAC_STATUS_INVALID_ARGUMENT;
            guac_error_message = "Error attempting to connect via socket.";
        }

        /* Some error has occurred - free resources before next iteration. */
        close(fd);

    }

    /* Free addrinfo */
    freeaddrinfo(addresses);

    /* If unable to connect to anything, set error status. */
    if (current_address == NULL) {
        guac_error = GUAC_STATUS_REFUSED;
        guac_error_message = "Unable to connect to remote host.";
    }

    /* Return the fd, or the error message if the socket connection failed. */
    return fd;

}
