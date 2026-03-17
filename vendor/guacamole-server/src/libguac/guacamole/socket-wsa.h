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

#ifndef GUAC_SOCKET_WSA_H
#define GUAC_SOCKET_WSA_H

/**
 * Provides an implementation of guac_socket specific to the Windows Socket API
 * (aka WSA or "winsock"). This header will only be available if libguac was
 * built with WSA support.
 *
 * @file socket-wsa.h
 */

#include "socket-types.h"

#include <winsock2.h>

/**
 * Creates a new guac_socket which will use the Windows Socket API (aka WSA or
 * "winsock") for all communication. Freeing this guac_socket will
 * automatically close the associated SOCKET handle.
 *
 * @param sock
 *     The WSA SOCKET handle to use for the connection underlying the created
 *     guac_socket.
 *
 * @return
 *     A newly-allocated guac_socket which will transparently use the Windows
 *     Socket API for all communication.
 */
guac_socket* guac_socket_open_wsa(SOCKET sock);

#endif

