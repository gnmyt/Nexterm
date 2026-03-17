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

#ifndef _GUAC_SSH_AGENT_H
#define _GUAC_SSH_AGENT_H

#include "config.h"

#include "ssh_key.h"

/**
 * Packet type of an agent identity request.
 */
#define SSH2_AGENT_REQUEST_IDENTITIES 0x0B

/**
 * Packet type of an agent identity response.
 */
#define SSH2_AGENT_IDENTITIES_ANSWER 0x0C

/**
 * Packet type of an agent sign request.
 */
#define SSH2_AGENT_SIGN_REQUEST 0x0D

/**
 * Packet type of an agent sign response.
 */
#define SSH2_AGENT_SIGN_RESPONSE 0x0E

/**
 * The comment to associate with public keys when listed.
 */
#define SSH_AGENT_COMMENT "Guacamole SSH Agent"

/**
 * The packet sent by the SSH agent when an operation is not supported.
 */
#define UNSUPPORTED "\x00\x00\x00\x0C\x05Unsupported"

/**
 * Data representing an SSH auth agent.
 */
typedef struct ssh_auth_agent {

    /**
     * The SSH channel being used for SSH agent protocol.
     */
    LIBSSH2_CHANNEL* channel;

    /**
     * The single private key to use for authentication.
     */
    ssh_key* identity;

    /**
     * Data read from the agent channel.
     */
    char buffer[4096];

    /**
     * The number of bytes of data currently stored in the buffer.
     */
    int buffer_length;

} ssh_auth_agent;

/**
 * Handler for an agent sign request.
 */
void ssh_auth_agent_sign(ssh_auth_agent* auth_agent,
        char* data, int data_length);

/**
 * Handler for an agent identity request.
 */
void ssh_auth_agent_list_identities(ssh_auth_agent* auth_agent);

/**
 * Generic handler for all packets received over the auth agent channel.
 */
void ssh_auth_agent_handle_packet(ssh_auth_agent* auth_agent,
        uint8_t type, char* data, int data_length);

/**
 * Reads and handles a single packet from the SSH agent channel associated
 * with the given ssh_auth_agent, returning the size of that packet, the size
 * of the partial packet read, or a negative value if an error occurs.
 */
int ssh_auth_agent_read(ssh_auth_agent* auth_agent);

/**
 * Libssh2 callback, invoked when the auth agent channel is opened.
 */
void ssh_auth_agent_callback(LIBSSH2_SESSION *session,
        LIBSSH2_CHANNEL *channel, void **abstract);

#endif

