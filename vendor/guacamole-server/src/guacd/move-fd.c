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
#include "move-fd.h"

/* Required for CMSG_* macros on BSD */
#define __BSD_VISIBLE 1

#include <errno.h>
#include <fcntl.h>
#include <string.h>
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/wait.h>
#include <unistd.h>

int guacd_send_fd(int sock, int fd) {

    struct msghdr message = {0};
    char message_data[] = {'G'};

    /* Assign data buffer */
    struct iovec io_vector[1];
    io_vector[0].iov_base = message_data;
    io_vector[0].iov_len  = sizeof(message_data);
    message.msg_iov    = io_vector;
    message.msg_iovlen = 1;

    /* Assign ancillary data buffer */
    char buffer[CMSG_SPACE(sizeof(fd))] = {0};
    message.msg_control = buffer;
    message.msg_controllen = sizeof(buffer);

    /* Set fields of control message header */
    struct cmsghdr* control = CMSG_FIRSTHDR(&message);
    control->cmsg_level = SOL_SOCKET;
    control->cmsg_type  = SCM_RIGHTS;
    control->cmsg_len   = CMSG_LEN(sizeof(fd));

    /* Add file descriptor to message data */
    memcpy(CMSG_DATA(control), &fd, sizeof(fd));

    /* Send file descriptor */
    return (sendmsg(sock, &message, 0) == sizeof(message_data));

}

int guacd_recv_fd(int sock) {

    int fd;

    struct msghdr message = {0};
    char message_data[1];

    /* Assign data buffer */
    struct iovec io_vector[1];
    io_vector[0].iov_base = message_data;
    io_vector[0].iov_len  = sizeof(message_data);
    message.msg_iov    = io_vector;
    message.msg_iovlen = 1;

    /* Assign ancillary data buffer */
    char buffer[CMSG_SPACE(sizeof(fd))];
    message.msg_control = buffer;
    message.msg_controllen = sizeof(buffer);

    /* Receive file descriptor */
    if (recvmsg(sock, &message, 0) == sizeof(message_data)) {

        /* Validate payload */
        if (message_data[0] != 'G') {
            errno = EPROTO;
            return -1;
        }

        /* Iterate control headers, looking for the sent file descriptor */
        struct cmsghdr* control;
        for (control = CMSG_FIRSTHDR(&message); control != NULL; control = CMSG_NXTHDR(&message, control)) {

            /* Pull file descriptor from data */
            if (control->cmsg_level == SOL_SOCKET && control->cmsg_type == SCM_RIGHTS) {
                memcpy(&fd, CMSG_DATA(control), sizeof(fd));
                return fd;
            }

        }

    } /* end if recvmsg() success */

    /* Failed to receive file descriptor */
    return -1;

}

