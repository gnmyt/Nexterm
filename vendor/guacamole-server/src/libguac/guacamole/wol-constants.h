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

#ifndef GUAC_WOL_CONSTANTS_H
#define GUAC_WOL_CONSTANTS_H

/**
 * Header file that provides constants and defaults related to libguac
 * Wake-on-LAN support.
 * 
 * @file wol-constants.h
 */

/**
 * The default number of times to retry a connection to a server after waking
 * the server with a WOL packet before giving up.
 */
#define GUAC_WOL_DEFAULT_CONNECT_RETRIES 5

/**
 * The default number of seconds for the connection timeout when attempting
 * to connect to the remote system to see if it is awake.
 */
#define GUAC_WOL_DEFAULT_CONNECTION_TIMEOUT 10

/**
 * The value for the local IPv4 broadcast address.
 */
#define GUAC_WOL_LOCAL_IPV4_BROADCAST "255.255.255.255"

/**
 * The size of the magic Wake-on-LAN packet to send to wake a remote host.  This
 * consists of 6 bytes of 0xFF, and then the MAC address repeated 16 times.
 * https://en.wikipedia.org/wiki/Wake-on-LAN#Magic_packet
 */
#define GUAC_WOL_PACKET_SIZE 102

/**
 * The port number that the magic packet should contain as the destination.  In
 * reality this doesn't matter all that much, since the packet is not usually
 * processed by a full IP stack, but defining one is considered a standard
 * practice.
 */
#define GUAC_WOL_PORT 9

#endif /* GUAC_WOL_CONSTANTS_H */

