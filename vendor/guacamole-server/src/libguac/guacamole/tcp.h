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

#ifndef GUAC_TCP_H
#define GUAC_TCP_H

/**
 * Provides convenience functions for establishing low-level TCP connections.
 *
 * @file tcp.h
 */

#include "config.h"

#include <stddef.h>

/**
 * Given a hostname or IP address and port, attempt to connect to that system,
 * returning the file descriptor of an open socket if the connection succeeds,
 * or a negative value if it fails. The returned file descriptor must
 * eventually be freed with a call to close(). If this function fails,
 * guac_error will be set appropriately.
 *
 * @param hostname
 *     The hostname or IP address to which to attempt connections.
 *
 * @param port
 *     The TCP port to which to attempt to connect.
 *
 * @param timeout
 *     The number of seconds to try the TCP connection before timing out.
 *
 * @return
 *     A valid socket if the connection succeeds, or a negative integer if it
 *     fails.
 */
int guac_tcp_connect(const char* hostname, const char* port, const int timeout);

#endif // GUAC_TCP_H
