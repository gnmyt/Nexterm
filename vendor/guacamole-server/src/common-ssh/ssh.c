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

#include "common-ssh/key.h"
#include "common-ssh/ssh.h"
#include "common-ssh/user.h"

#include <guacamole/client.h>
#include <guacamole/fips.h>
#include <guacamole/mem.h>
#include <guacamole/string.h>
#include <guacamole/tcp.h>
#include <libssh2.h>

#ifdef LIBSSH2_USES_GCRYPT
#include <gcrypt.h>
#endif

#include <openssl/err.h>
#include <openssl/ssl.h>

#include <errno.h>
#include <fcntl.h>
#include <netdb.h>
#include <netinet/in.h>
#include <pthread.h>
#include <pwd.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>

#ifdef LIBSSH2_USES_GCRYPT
GCRY_THREAD_OPTION_PTHREAD_IMPL;
#endif

/**
 * A list of all key exchange algorithms that are both FIPS-compliant, and
 * OpenSSL-supported. Note that "ext-info-c" is also included. While not a key
 * exchange algorithm per se, it must be in the list to ensure that the server
 * will send a SSH_MSG_EXT_INFO response, which is required to perform RSA key
 * upgrades.
 */
#define FIPS_COMPLIANT_KEX_ALGORITHMS "diffie-hellman-group-exchange-sha256,ext-info-c"

/**
 * A list of ciphers that are both FIPS-compliant, and OpenSSL-supported.
 */
#define FIPS_COMPLIANT_CIPHERS "aes128-ctr,aes192-ctr,aes256-ctr,aes128-cbc,aes192-cbc,aes256-cbc"

#ifdef OPENSSL_REQUIRES_THREADING_CALLBACKS
/**
 * Array of mutexes, used by OpenSSL.
 */
static pthread_mutex_t* guac_common_ssh_openssl_locks = NULL;

/**
 * Called by OpenSSL when locking or unlocking the Nth mutex.
 *
 * @param mode
 *     A bitmask denoting the action to be taken on the Nth lock, such as
 *     CRYPTO_LOCK or CRYPTO_UNLOCK.
 *
 * @param n
 *     The index of the lock to lock or unlock.
 *
 * @param file
 *     The filename of the function setting the lock, for debugging purposes.
 *
 * @param line
 *     The line number of the function setting the lock, for debugging
 *     purposes.
 */
static void guac_common_ssh_openssl_locking_callback(int mode, int n,
        const char* file, int line){

    /* Lock given mutex upon request */
    if (mode & CRYPTO_LOCK)
        pthread_mutex_lock(&(guac_common_ssh_openssl_locks[n]));

    /* Unlock given mutex upon request */
    else if (mode & CRYPTO_UNLOCK)
        pthread_mutex_unlock(&(guac_common_ssh_openssl_locks[n]));

}

/**
 * Called by OpenSSL when determining the current thread ID.
 *
 * @return
 *     An ID which uniquely identifies the current thread.
 */
static unsigned long guac_common_ssh_openssl_id_callback() {
    return (unsigned long) pthread_self();
}

/**
 * Creates the given number of mutexes, such that OpenSSL will have at least
 * this number of mutexes at its disposal.
 *
 * @param count
 *     The number of mutexes (locks) to create.
 */
static void guac_common_ssh_openssl_init_locks(int count) {

    int i;

    /* Allocate required number of locks */
    guac_common_ssh_openssl_locks =
        guac_mem_alloc(sizeof(pthread_mutex_t), count);

    /* Initialize each lock */
    for (i=0; i < count; i++)
        pthread_mutex_init(&(guac_common_ssh_openssl_locks[i]), NULL);

}

/**
 * Frees the given number of mutexes.
 *
 * @param count
 *     The number of mutexes (locks) to free.
 */
static void guac_common_ssh_openssl_free_locks(int count) {

    int i;

    /* SSL lock array was not initialized */
    if (guac_common_ssh_openssl_locks == NULL)
        return;

    /* Free all locks */
    for (i=0; i < count; i++)
        pthread_mutex_destroy(&(guac_common_ssh_openssl_locks[i]));

    /* Free lock array */
    guac_mem_free(guac_common_ssh_openssl_locks);

}
#endif

int guac_common_ssh_init(guac_client* client) {

#ifdef LIBSSH2_USES_GCRYPT
    
    if (!gcry_control(GCRYCTL_INITIALIZATION_FINISHED_P)) {
    
        /* Init threadsafety in libgcrypt */
        gcry_control(GCRYCTL_SET_THREAD_CBS, &gcry_threads_pthread);
        
        /* Initialize GCrypt */
        if (!gcry_check_version(GCRYPT_VERSION)) {
            guac_client_log(client, GUAC_LOG_ERROR, "libgcrypt version mismatch.");
            return 1;
        }

        /* Mark initialization as completed. */
        gcry_control(GCRYCTL_INITIALIZATION_FINISHED, 0);
    
    }
#endif

#ifdef OPENSSL_REQUIRES_THREADING_CALLBACKS
    /* Init threadsafety in OpenSSL */
    guac_common_ssh_openssl_init_locks(CRYPTO_num_locks());
    CRYPTO_set_id_callback(guac_common_ssh_openssl_id_callback);
    CRYPTO_set_locking_callback(guac_common_ssh_openssl_locking_callback);
#endif

#if OPENSSL_VERSION_NUMBER < 0x10100000L
    /* Init OpenSSL - only required for OpenSSL Versions < 1.1.0 */
    SSL_library_init();
    ERR_load_crypto_strings();
#endif

    /* Init libssh2 */
    libssh2_init(0);

    /* Success */
    return 0;

}

void guac_common_ssh_uninit() {
#ifdef OPENSSL_REQUIRES_THREADING_CALLBACKS
    guac_common_ssh_openssl_free_locks(CRYPTO_num_locks());
#endif
}

/**
 * Callback for the keyboard-interactive authentication method. Currently
 * supports just one prompt for the password. This callback is invoked as
 * needed to fulfill a call to libssh2_userauth_keyboard_interactive().
 *
 * @param name
 *     An arbitrary name which should be printed to the terminal for the
 *     benefit of the user. This is currently ignored.
 *
 * @param name_len
 *     The length of the name string, in bytes.
 *
 * @param instruction
 *     Arbitrary instructions which should be printed to the terminal for the
 *     benefit of the user. This is currently ignored.
 *
 * @param instruction_len
 *     The length of the instruction string, in bytes.
 *
 * @param num_prompts
 *     The number of keyboard-interactive prompts for which responses are
 *     requested. This callback currently only supports one prompt, and assumes
 *     that this prompt is requesting the password.
 *
 * @param prompts
 *     An array of all keyboard-interactive prompts for which responses are
 *     requested.
 *
 * @param responses
 *     A parallel array into which all prompt responses should be stored. Each
 *     entry within this array corresponds to the entry in the prompts array
 *     with the same index.
 *
 * @param abstract
 *     The value of the abstract parameter provided when the SSH session was
 *     created with libssh2_session_init_ex().
 */
static void guac_common_ssh_kbd_callback(const char *name, int name_len,
        const char *instruction, int instruction_len, int num_prompts,
        const LIBSSH2_USERAUTH_KBDINT_PROMPT *prompts,
        LIBSSH2_USERAUTH_KBDINT_RESPONSE *responses,
        void **abstract) {

    guac_common_ssh_session* common_session =
        (guac_common_ssh_session*) *abstract;

    guac_client* client = common_session->client;

    /* Send password if only one prompt */
    if (num_prompts == 1) {
        char* password = common_session->user->password;
        responses[0].text = guac_strdup(password);
        responses[0].length = strlen(password);
    }

    /* If more than one prompt, a single password is not enough */
    else
        guac_client_log(client, GUAC_LOG_WARNING,
                "Unsupported number of keyboard-interactive prompts: %i",
                num_prompts);

}

/**
 * Authenticates the user associated with the given session over SSH. All
 * required credentials must already be present within the user object
 * associated with the given session.
 *
 * @param session
 *     The session associated with the user to be authenticated.
 *
 * @return
 *     Zero if authentication succeeds, or non-zero if authentication has
 *     failed.
 */
static int guac_common_ssh_authenticate(guac_common_ssh_session* common_session) {

    guac_client* client = common_session->client;
    guac_common_ssh_user* user = common_session->user;
    LIBSSH2_SESSION* session = common_session->session;

    /* Get user credentials */
    guac_common_ssh_key* key = user->private_key;

    char* public_key = user->public_key;

    /* Validate username provided */
    if (user->username == NULL) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                "SSH authentication requires a username.");
        return 1;
    }

    /* Get list of supported authentication methods */
    size_t username_len = strlen(user->username);
    char* user_authlist = libssh2_userauth_list(session, user->username,
            username_len);

    /* If auth list is NULL, then authentication has succeeded with NONE */
    if (user_authlist == NULL) {
        guac_client_log(client, GUAC_LOG_DEBUG,
            "SSH NONE authentication succeeded.");
        return 0;
    }

    guac_client_log(client, GUAC_LOG_DEBUG,
            "Supported authentication methods: %s", user_authlist);

    /* Authenticate with private key, if provided */
    if (key != NULL) {

        /* Check if public key auth is supported on the server */
        if (strstr(user_authlist, "publickey") == NULL) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                    "Public key authentication is not supported by "
                    "the SSH server");
            return 1;
        }

        int public_key_length = public_key == NULL ? 0 : strlen(public_key);

        /* Attempt public key auth */
        if (libssh2_userauth_publickey_frommemory(session, user->username,
                    username_len, public_key, public_key_length, key->private_key,
                    key->private_key_length, key->passphrase)) {

            /* Abort on failure */
            char* error_message;
            libssh2_session_last_error(session, &error_message, NULL, 0);
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                    "Public key authentication failed: %s", error_message);

            return 1;

        }

        /* Private key authentication succeeded */
        return 0;

    }

    /* Attempt authentication with username + password. */
    if (user->password == NULL && common_session->credential_handler)
            user->password = common_session->credential_handler(client, "Password: ");
    
    /* Authenticate with password, if provided */
    if (user->password != NULL) {

        /* Check if password auth is supported on the server */
        if (strstr(user_authlist, "password") != NULL) {

            /* Attempt password authentication */
            if (libssh2_userauth_password(session, user->username, user->password)) {

                /* Abort on failure */
                char* error_message;
                libssh2_session_last_error(session, &error_message, NULL, 0);
                guac_client_abort(client,
                        GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                        "Password authentication failed: %s", error_message);

                return 1;
            }

            /* Password authentication succeeded */
            return 0;

        }

        /* Check if keyboard-interactive auth is supported on the server */
        if (strstr(user_authlist, "keyboard-interactive") != NULL) {

            /* Attempt keyboard-interactive auth using provided password */
            if (libssh2_userauth_keyboard_interactive(session, user->username,
                        &guac_common_ssh_kbd_callback)) {

                /* Abort on failure */
                char* error_message;
                libssh2_session_last_error(session, &error_message, NULL, 0);
                guac_client_abort(client,
                        GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                        "Keyboard-interactive authentication failed: %s",
                        error_message);

                return 1;
            }

            /* Keyboard-interactive authentication succeeded */
            return 0;

        }

        /* No known authentication types available */
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                "Password and keyboard-interactive authentication are not "
                "supported by the SSH server");
        return 1;

    }

    /* No credentials provided */
    guac_client_abort(client, GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
            "SSH authentication requires either a private key or a password.");
    return 1;

}

guac_common_ssh_session* guac_common_ssh_create_session(guac_client* client,
        const char* hostname, const char* port, guac_common_ssh_user* user,
        int timeout, int keepalive, const char* host_key,
        guac_ssh_credential_handler* credential_handler) {

    int fd = guac_tcp_connect(hostname, port, timeout);
    if (fd < 0) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
            "Failed to open TCP connection to %s on %s.", hostname, port);
        return NULL;
    }

    /* Allocate new session */
    guac_common_ssh_session* common_session =
        guac_mem_alloc(sizeof(guac_common_ssh_session));

    /* Open SSH session */
    LIBSSH2_SESSION* session = libssh2_session_init_ex(NULL, NULL,
            NULL, common_session);
    if (session == NULL) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Session allocation failed.");
        guac_mem_free(common_session);
        close(fd);
        return NULL;
    }

    /*
     * If FIPS mode is enabled, prefer only FIPS-compatible algorithms and
     * ciphers that are also supported by libssh2. For more info, see:
     * https://csrc.nist.gov/CSRC/media/projects/cryptographic-module-validation-program/documents/security-policies/140sp2906.pdf
     */
    if (guac_fips_enabled()) {
        libssh2_session_method_pref(session, LIBSSH2_METHOD_KEX, FIPS_COMPLIANT_KEX_ALGORITHMS);
        libssh2_session_method_pref(session, LIBSSH2_METHOD_CRYPT_CS, FIPS_COMPLIANT_CIPHERS);
        libssh2_session_method_pref(session, LIBSSH2_METHOD_CRYPT_SC, FIPS_COMPLIANT_CIPHERS);
    }

    /* Perform handshake */
    if (libssh2_session_handshake(session, fd)) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR,
                "SSH handshake failed.");
        guac_mem_free(common_session);
        close(fd);
        return NULL;
    }

    /* Get host key of remote system we're connecting to */
    size_t remote_hostkey_len;
    const char *remote_hostkey = libssh2_session_hostkey(session, &remote_hostkey_len, NULL);

    /* Failure to retrieve a host key means we should abort */
    if (!remote_hostkey) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
            "Failed to get host key for %s", hostname);
        guac_mem_free(common_session);
        close(fd);
        return NULL;
    }

    /* SSH known host key checking. */
    int known_host_check = guac_common_ssh_verify_host_key(session, client, host_key,
                                                           hostname, atoi(port), remote_hostkey,
                                                           remote_hostkey_len);

    /* Abort on any error codes */
    if (known_host_check != 0) {
        char* err_msg;
        libssh2_session_last_error(session, &err_msg, NULL, 0);

        if (known_host_check < 0)
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Error occurred attempting to check host key: %s", err_msg);

        if (known_host_check > 0)
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "Host key did not match any provided known host keys. %s", err_msg);

        guac_mem_free(common_session);
        close(fd);
        return NULL;
    }

    /* Store basic session data */
    common_session->client = client;
    common_session->user = user;
    common_session->session = session;
    common_session->fd = fd;
    common_session->credential_handler = credential_handler;

    /* Attempt authentication */
    if (guac_common_ssh_authenticate(common_session)) {
        guac_mem_free(common_session);
        close(fd);
        return NULL;
    }

    /* Warn if keepalive below minimum value */
    if (keepalive < 0) {
        keepalive = 0;
        guac_client_log(client, GUAC_LOG_WARNING, "negative keepalive intervals "
            "are converted to 0, disabling keepalive.");
    }
    else if (keepalive == 1) {
        guac_client_log(client, GUAC_LOG_WARNING, "keepalive interval will "
            "be rounded up to minimum value of 2.");
    }

    /* Configure session keepalive */
    libssh2_keepalive_config(common_session->session, 1, keepalive);

    /* Return created session */
    return common_session;

}

void guac_common_ssh_destroy_session(guac_common_ssh_session* session) {

    /* Disconnect and clean up libssh2 */
    libssh2_session_disconnect(session->session, "Bye");
    libssh2_session_free(session->session);

    /* Free all other data */
    guac_mem_free(session);

}
