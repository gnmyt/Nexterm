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

#ifndef _GUAC_CLIENT_CONSTANTS_H
#define _GUAC_CLIENT_CONSTANTS_H

/**
 * Constants related to the Guacamole client structure, guac_client.
 *
 * @file client-constants.h
 */

/**
 * The maximum number of inbound or outbound streams supported by any one
 * guac_client.
 */
#define GUAC_CLIENT_MAX_STREAMS 512

/**
 * The index of a closed stream.
 */
#define GUAC_CLIENT_CLOSED_STREAM_INDEX -1

/**
 * The character prefix which identifies a client ID.
 */
#define GUAC_CLIENT_ID_PREFIX '$'

/**
 * The flag set in the mouse button mask when the left mouse button is down.
 */
#define GUAC_CLIENT_MOUSE_LEFT 0x01

/**
 * The flag set in the mouse button mask when the middle mouse button is down.
 */
#define GUAC_CLIENT_MOUSE_MIDDLE 0x02

/**
 * The flag set in the mouse button mask when the right mouse button is down.
 */
#define GUAC_CLIENT_MOUSE_RIGHT 0x04

/**
 * The flag set in the mouse button mask when the mouse scrollwheel is scrolled
 * up. Note that mouse scrollwheels are actually sets of two buttons. One
 * button is pressed and released for an upward scroll, and the other is
 * pressed and released for a downward scroll. Some mice may actually implement
 * these as separate buttons, not a wheel.
 */
#define GUAC_CLIENT_MOUSE_SCROLL_UP 0x08

/**
 * The flag set in the mouse button mask when the mouse scrollwheel is scrolled
 * down. Note that mouse scrollwheels are actually sets of two buttons. One
 * button is pressed and released for an upward scroll, and the other is
 * pressed and released for a downward scroll. Some mice may actually implement
 * these as separate buttons, not a wheel.
 */
#define GUAC_CLIENT_MOUSE_SCROLL_DOWN 0x10

/**
 * The minimum number of buffers to create before allowing free'd buffers to
 * be reclaimed. In the case a protocol rapidly creates, uses, and destroys
 * buffers, this can prevent unnecessary reuse of the same buffer (which
 * would make draw operations unnecessarily synchronous).
 */
#define GUAC_BUFFER_POOL_INITIAL_SIZE 1024

#endif

