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

#include "common-ssh/buffer.h"
#include "common-ssh/key.h"

#include <guacamole/mem.h>
#include <guacamole/string.h>

#include <openssl/bio.h>
#include <openssl/bn.h>
#include <openssl/dsa.h>
#include <openssl/err.h>
#include <openssl/evp.h>
#include <openssl/obj_mac.h>
#include <openssl/pem.h>
#include <openssl/rsa.h>

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

/**
 * Check for a PKCS#1/PKCS#8 ENCRYPTED marker.
 *
 * @param data
 *     The buffer to scan.
 * @param length
 *     The length of the buffer.
 *
 * @return
 *     True if the buffer contains the marker, false otherwise.
 */
static bool is_pkcs_encrypted_key(char* data, int length) {
    return guac_strnstr(data, "ENCRYPTED", length) != NULL;
}

/**
 * Check for a PEM header & initial base64-encoded data indicating this is an
 * OpenSSH v1 key.
 *
 * @param data
 *     The buffer to scan.
 * @param length
 *     The length of the buffer.
 *
 * @return
 *     True if the buffer contains a private key, false otherwise.
 */
static bool is_ssh_private_key(char* data, int length) {
    if (length < sizeof(OPENSSH_V1_KEY_HEADER) - 1) {
        return false;
    }
    return !strncmp(data, OPENSSH_V1_KEY_HEADER, sizeof(OPENSSH_V1_KEY_HEADER) - 1);
}

/**
 * Assuming an offset into a key past the header, check for the base64-encoded
 * data indicating this key is not protected by a passphrase.
 *
 * @param data
 *     The buffer to scan.
 * @param length
 *     The length of the buffer.
 *
 * @return
 *     True if the buffer contains an unencrypted key, false otherwise.
 */
static bool is_ssh_key_unencrypted(char* data, int length) {
    if (length < sizeof(OPENSSH_V1_UNENCRYPTED_KEY) - 1) {
        return false;
    }
    return !strncmp(data, OPENSSH_V1_UNENCRYPTED_KEY, sizeof(OPENSSH_V1_UNENCRYPTED_KEY) - 1);
}

/**
 * A passphrase is needed if the key is an encrypted PKCS#1/PKCS#8 key OR if
 * the key is both an OpenSSH v1 key AND there isn't a marker indicating the
 * key is unprotected.
 *
 * @param data
 *     The buffer to scan.
 * @param length
 *     The length of the buffer.
 *
 * @return
 *     True if the buffer contains a key needing a passphrase, false otherwise.
 */
static bool is_passphrase_needed(char* data, int length) {
    /* Is this an encrypted PKCS#1/PKCS#8 key? */
    if (is_pkcs_encrypted_key(data, length)) {
        return true;
    }

    /* Is this an OpenSSH v1 key? */
    if (is_ssh_private_key(data, length)) {
        /* This is safe due to the check in is_ssh_private_key. */
        data += sizeof(OPENSSH_V1_KEY_HEADER) - 1;
        length -= sizeof(OPENSSH_V1_KEY_HEADER) - 1;
        /* If this is NOT unprotected, we need a passphrase. */
        if (!is_ssh_key_unencrypted(data, length)) {
            return true;
        }
    }

    return false;
}

guac_common_ssh_key* guac_common_ssh_key_alloc(char* data, int length,
        char* passphrase) {

    /* Because libssh2 will do the actual key parsing (to let it deal with
     * different key algorithms) we need to perform a heuristic here to check
     * if a passphrase is needed. This could allow junk keys through that
     * would never be able to auth. libssh2 should display errors to help
     * admins track down malformed keys and delete or replace them. */

    if (is_passphrase_needed(data, length) && (passphrase == NULL || *passphrase == '\0'))
        return NULL;

    guac_common_ssh_key* key = guac_mem_alloc(sizeof(guac_common_ssh_key));

    /* NOTE: Older versions of libssh2 will at times ignore the declared key
     * length and instead recalculate the length using strlen(). This has since
     * been fixed, but as of this writing the fix has not yet been released.
     * Below, we add our own null terminator to ensure that such calls to
     * strlen() will work without issue. We can remove this workaround once
     * copies of libssh2 that use strlen() on key data are not in common use. */

    /* Copy private key to structure */
    key->private_key_length = length;
    key->private_key = guac_mem_alloc(guac_mem_ckd_add_or_die(length, 1)); /* Extra byte added here for null terminator (see above) */
    memcpy(key->private_key, data, length);
    key->private_key[length] = '\0'; /* Manually-added null terminator (see above) */
    key->passphrase = guac_strdup(passphrase);

    return key;

}

const char* guac_common_ssh_key_error() {

    /* Return static error string */
    return ERR_reason_error_string(ERR_get_error());

}

void guac_common_ssh_key_free(guac_common_ssh_key* key) {
    guac_mem_free(key->private_key);
    guac_mem_free(key->passphrase);
    guac_mem_free(key);
}

int guac_common_ssh_verify_host_key(LIBSSH2_SESSION* session, guac_client* client,
        const char* host_key, const char* hostname, int port, const char* remote_hostkey,
        const size_t remote_hostkey_len) {

    LIBSSH2_KNOWNHOSTS* ssh_known_hosts = libssh2_knownhost_init(session);
    int known_hosts = 0;

    /* Add host key provided from settings */
    if (host_key && strcmp(host_key, "") != 0) {

        known_hosts = libssh2_knownhost_readline(ssh_known_hosts, host_key, strlen(host_key),
                LIBSSH2_KNOWNHOST_FILE_OPENSSH);

        /* readline function returns 0 on success, so we increment to indicate a valid entry */
        if (known_hosts == 0)
            known_hosts++;

    }

    /* Otherwise, we look for a ssh_known_hosts file within GUACAMOLE_HOME and read that in. */
    else {

        const char *guac_known_hosts = "/etc/guacamole/ssh_known_hosts";
        if (access(guac_known_hosts, F_OK) != -1)
            known_hosts = libssh2_knownhost_readfile(ssh_known_hosts, guac_known_hosts, LIBSSH2_KNOWNHOST_FILE_OPENSSH);

    }

    /* If there's an error provided, abort connection and return that. */
    if (known_hosts < 0) {

        char* errmsg;
        int errval = libssh2_session_last_error(session, &errmsg, NULL, 0);
        guac_client_log(client, GUAC_LOG_ERROR,
            "Error %d trying to load SSH host keys: %s", errval, errmsg);

        libssh2_knownhost_free(ssh_known_hosts);
        return known_hosts;

    }

    /* No host keys were loaded, so we bail out checking and continue the connection. */
    else if (known_hosts == 0) {
        guac_client_log(client, GUAC_LOG_WARNING,
            "No known host keys provided, host identity will not be verified.");
        libssh2_knownhost_free(ssh_known_hosts);
        return known_hosts;
    }

    /* Check remote host key against known hosts */
    int kh_check = libssh2_knownhost_checkp(ssh_known_hosts, hostname, port,
                                            remote_hostkey, remote_hostkey_len,
                                            LIBSSH2_KNOWNHOST_TYPE_PLAIN|
                                            LIBSSH2_KNOWNHOST_KEYENC_RAW,
                                            NULL);

    /* Deal with the return of the host key check */
    switch (kh_check) {
        case LIBSSH2_KNOWNHOST_CHECK_MATCH:
            guac_client_log(client, GUAC_LOG_DEBUG,
                "Host key match found for %s", hostname);
            break;
        case LIBSSH2_KNOWNHOST_CHECK_NOTFOUND:
            guac_client_log(client, GUAC_LOG_ERROR,
                "Host key not found for %s.", hostname);
            break;
        case LIBSSH2_KNOWNHOST_CHECK_MISMATCH:
            guac_client_log(client, GUAC_LOG_ERROR,
                "Host key does not match known hosts entry for %s", hostname);
            break;
        case LIBSSH2_KNOWNHOST_CHECK_FAILURE:
        default:
            guac_client_log(client, GUAC_LOG_ERROR,
                "Host %s could not be checked against known hosts.",
                hostname);
    }

    /* Return the check value */
    libssh2_knownhost_free(ssh_known_hosts);
    return kh_check;

}
