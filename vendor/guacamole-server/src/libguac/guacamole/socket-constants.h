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

#ifndef _GUAC_SOCKET_CONSTANTS_H
#define _GUAC_SOCKET_CONSTANTS_H

/**
 * Constants related to the guac_socket object.
 *
 * @file socket-constants.h
 */

/**
 * The number of bytes to buffer within each socket before flushing.
 */
#define GUAC_SOCKET_OUTPUT_BUFFER_SIZE 8192

/**
 * The number of milliseconds to wait between keep-alive pings on a socket
 * with keep-alive enabled.
 */
#define GUAC_SOCKET_KEEP_ALIVE_INTERVAL 5000

/**
 * The number of bytes of data to buffer prior to bulk conversion to base64.
 */
#define GUAC_SOCKET_BASE64_READY_BUFFER_SIZE 768

/**
 * The size of the buffer required to hold GUAC_SOCKET_BASE64_READY_BUFFER_SIZE
 * bytes encoded as base64.
 */
#define GUAC_SOCKET_BASE64_ENCODED_BUFFER_SIZE 1024

#endif

