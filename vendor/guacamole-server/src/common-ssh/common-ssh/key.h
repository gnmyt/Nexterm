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

#ifndef GUAC_COMMON_SSH_KEY_H
#define GUAC_COMMON_SSH_KEY_H

#include "config.h"

#include <guacamole/client.h>
#include <libssh2.h>

/**
 * OpenSSH v1 private keys are PEM-wrapped base64-encoded blobs. The encoded data begins with:
 *   "openssh-key-v1\0"
 */
#define OPENSSH_V1_KEY_HEADER "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEA"

/**
 * The base64-encoded prefix indicating an OpenSSH v1 private key is NOT protected by a
 * passphrase. Specifically, it is the following data fields and values:
 *   pascal string: cipher name ("none")
 *   pascal string: kdf name ("none")
 *   pascal string: kdf params (NULL)
 *   32-bit int: number of keys (1)
 */
#define OPENSSH_V1_UNENCRYPTED_KEY "AAAABG5vbmUAAAAEbm9uZQAAAAAAAAAB"

/**
 * Abstraction of a key used for SSH authentication.
 */
typedef struct guac_common_ssh_key {

    /**
     * The private key, encoded as necessary for SSH.
     */
    char* private_key;

    /**
     * The length of the private key, in bytes.
     */
    int private_key_length;

    /**
     * The private key's passphrase, if any.
     */
    char *passphrase;

} guac_common_ssh_key;

/**
 * Allocates a new key containing the given private key data and specified
 * passphrase. If unable to read the key, NULL is returned.
 *
 * @param data
 *     The base64-encoded data to decode when reading the key.
 *
 * @param length
 *     The length of the provided data, in bytes.
 *
 * @param passphrase
 *     The passphrase to use when decrypting the key, if any, or an empty
 *     string or NULL if no passphrase is needed.
 *
 * @return
 *     The decoded, decrypted private key, or NULL if the key could not be
 *     decoded.
 */
guac_common_ssh_key* guac_common_ssh_key_alloc(char* data, int length,
        char* passphrase);

/**
 * Returns a statically-allocated string describing the most recent SSH key
 * error.
 *
 * @return
 *     A statically-allocated string describing the most recent SSH key error.
 */
const char* guac_common_ssh_key_error();

/**
 * Frees all memory associated with the given key.
 *
 * @param key
 *     The key to free.
 */
void guac_common_ssh_key_free(guac_common_ssh_key* key);

/**
 * Verifies the host key for the given hostname/port combination against
 * one or more known_hosts entries.  The known_host entries can either be a
 * single host_key, provided by the client, or a set of known_hosts entries
 * provided in the /etc/guacamole/ssh_known_hosts file.  Failure to correctly
 * load the known_hosts entries will result in a connection abort and a returned
 * error code.  A return code of zero indicates that either no known_hosts entries
 * were provided, or that the verification succeeded (match).  Negative values
 * indicate internal libssh2 error codes; positive values indicate a failure
 * during verification of the host key against the known hosts.
 *
 * @param session
 *     A pointer to the LIBSSH2_SESSION structure of the SSH connection already
 *     in progress.
 *
 * @param client
 *     The current guac_client instance for which the known_hosts checking is
 *     being performed.
 *
 * @param host_key
 *     The known host entry provided by the client.  If this is non-null and not
 *     empty, it will be the only host key loaded and used for verification.  If
 *     this is null or empty an attempt will be made to read the
 *     /etc/guacamole/ssh_known_hosts file and load entries from it.
 *
 * @param hostname
 *     The hostname or IP of the server that is being verified.
 *
 * @param port
 *     The port number of the server being verified.
 *
 * @param remote_hostkey
 *     The host key of the remote system being verified.
 *
 * @param remote_hostkey_len
 *     The length of the remote host key being verified
 *
 * @return
 *     The status of the known_hosts check.  This will be zero if no entries
 *     are provided or if the match succeeds, negative to indicate internal
 *     libssh2 errors, or positive to indicate failures during host key
 *     checking.
 */
int guac_common_ssh_verify_host_key(LIBSSH2_SESSION* session, guac_client* client,
        const char* host_key, const char* hostname, int port, const char* remote_hostkey,
        const size_t remote_hostkey_len);

#endif

