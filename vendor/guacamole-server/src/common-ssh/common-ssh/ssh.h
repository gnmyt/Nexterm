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

#ifndef GUAC_COMMON_SSH_H
#define GUAC_COMMON_SSH_H

#include "user.h"

#include <guacamole/client.h>
#include <libssh2.h>

/**
 * Handler for retrieving additional credentials.
 * 
 * @param client
 *     The Guacamole Client associated with this need for additional
 *     credentials.
 * 
 * @param cred_name
 *     The name of the credential being requested, which will be shared
 *     with the client in order to generate a meaningful prompt.
 * 
 * @return
 *     A newly-allocated string containing the credentials provided by
 *     the user, which must be freed by a call to guac_mem_free().
 */
typedef char* guac_ssh_credential_handler(guac_client* client, char* cred_name);

/**
 * An SSH session, backed by libssh2 and associated with a particular
 * Guacamole client.
 */
typedef struct guac_common_ssh_session {

    /**
     * The Guacamole client using this SSH session.
     */
    guac_client* client;

    /**
     * The user that will be authenticating via SSH.
     */
    guac_common_ssh_user* user;

    /**
     * The underlying SSH session from libssh2.
     */
    LIBSSH2_SESSION* session;

    /**
     * The file descriptor of the socket being used for the SSH connection.
     */
    int fd;
    
    /**
     * Callback function to retrieve credentials.
     */
    guac_ssh_credential_handler* credential_handler;

} guac_common_ssh_session;

/**
 * Initializes the underlying SSH and encryption libraries used by Guacamole.
 * This function must be called before any other guac_common_ssh_*() functions
 * are called.
 *
 * @param client
 *     The Guacamole client that will be using SSH.
 *
 * @return
 *     Zero if initialization, or non-zero if an error occurs.
 */
int guac_common_ssh_init(guac_client* client);

/**
 * Cleans up the underlying SSH and encryption libraries used by Guacamole.
 * This function must be called once no other guac_common_ssh_*() functions
 * will be used.
 */
void guac_common_ssh_uninit();

/**
 * Connects to the SSH server running at the given hostname and port, and
 * authenticates as the given user. If an error occurs while connecting or
 * authenticating, the Guacamole client will automatically and fatally abort.
 * The user object provided must eventually be explicitly destroyed, but should
 * not be destroyed until this session is destroyed, assuming the session is
 * successfully created.
 *
 * @param client
 *     The Guacamole client that will be using SSH.
 *
 * @param hostname
 *     The hostname of the SSH server to connect to.
 *
 * @param port
 *     The port to connect to on the given hostname.
 *
 * @param user
 *     The user to authenticate as, once connected.
 *
 * @param timeout
 *     The number of seconds to attempt to connect to the SSH server before
 *     timing out.
 * 
 * @param keepalive
 *     How frequently the connection should send keepalive packets, in
 *     seconds.  Zero disables keepalive packets, and 2 is the minimum
 *     configurable value.
 * 
 * @param host_key
 *     The known public host key of the server, as provided by the client.  If
 *     provided the identity of the server will be checked against this key,
 *     and a mis-match between this and the server identity will cause the
 *     connection to fail.  If not provided, no checks will be done and the
 *     connection will proceed.
 * 
 * @param credential_handler
 *     The handler function for retrieving additional credentials from the user
 *     as required by the SSH server, or NULL if the user will not be asked
 *     for additional credentials.
 *
 * @return
 *     A new SSH session if the connection and authentication succeed, or NULL
 *     if the connection or authentication were not successful.
 */
guac_common_ssh_session* guac_common_ssh_create_session(guac_client* client,
        const char* hostname, const char* port, guac_common_ssh_user* user,
        int timeout, int keepalive, const char* host_key,
        guac_ssh_credential_handler* credential_handler);

/**
 * Disconnects and destroys the given SSH session, freeing all associated
 * resources. Any associated user must be explicitly destroyed, and will not
 * be destroyed automatically.
 *
 * @param session
 *     The SSH session to destroy.
 */
void guac_common_ssh_destroy_session(guac_common_ssh_session* session);

#endif

