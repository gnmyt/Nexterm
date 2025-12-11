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

#ifndef GUACD_MOVE_FD_H
#define GUACD_MOVE_FD_H

#include "config.h"

/**
 * Sends the given file descriptor along the given socket, allowing the
 * receiving process to use that file descriptor normally. Returns non-zero on
 * success, zero on error, just as a normal call to sendmsg() would. If an
 * error does occur, errno will be set appropriately.
 *
 * @param sock
 *     The file descriptor of an open UNIX domain socket along which the file
 *     descriptor specified by fd should be sent.
 *
 * @param fd
 *     The file descriptor to send along the given UNIX domain socket.
 *
 * @return
 *     Non-zero if the send operation succeeded, zero on error.
 */
int guacd_send_fd(int sock, int fd);

/**
 * Waits for a file descriptor on the given socket, returning the received file
 * descriptor. The file descriptor must have been sent via guacd_send_fd. If an
 * error occurs, -1 is returned, and errno will be set appropriately.
 *
 * @param sock
 *     The file descriptor of an open UNIX domain socket along which the file
 *     descriptor will be sent (by guacd_send_fd()).
 *
 * @return
 *     The received file descriptor, or -1 if an error occurs preventing
 *     receipt of the file descriptor.
 */
int guacd_recv_fd(int sock);

#endif

