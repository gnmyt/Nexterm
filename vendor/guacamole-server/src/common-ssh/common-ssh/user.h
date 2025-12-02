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

#ifndef GUAC_COMMON_SSH_USER_H
#define GUAC_COMMON_SSH_USER_H

#include "key.h"

/**
 * Data describing an SSH user, including their credentials.
 */
typedef struct guac_common_ssh_user {

    /**
     * The username of this user.
     */
    char* username;

    /**
     * The password which should be used to authenticate this user, if any, or
     * NULL if a private key will be used instead.
     */
    char* password;

    /**
     * The private key which should be used to authenticate this user, if any,
     * or NULL if a password will be used instead.
     */
    guac_common_ssh_key* private_key;

    /**
     * The public key which should be used to authenticate this user, if any,
     * or NULL if a password or just a private key will be used instead.
     */
    char* public_key;

} guac_common_ssh_user;

/**
 * Creates a new SSH user with the given username. When additionally populated
 * with a password or private key, this user can then be used for
 * authentication.
 *
 * @param username
 *     The username of the user being created.
 *
 * @return
 *     A new SSH user having the given username, but no associated password
 *     or private key.
 */
guac_common_ssh_user* guac_common_ssh_create_user(const char* username);

/**
 * Destroys the given user object, releasing all associated resources.
 *
 * @param user
 *     The user to destroy.
 */
void guac_common_ssh_destroy_user(guac_common_ssh_user* user);

/**
 * Associates the given user with the given password, such that that password
 * is used for future authentication attempts.
 *
 * @param user
 *     The user to associate with the given password.
 *
 * @param password
 *     The password to associate with the given user.
 */
void guac_common_ssh_user_set_password(guac_common_ssh_user* user,
        const char* password);

/**
 * Imports the given private key, associating that key with the given user. If
 * necessary to decrypt the key, a passphrase may be specified. The private key
 * must be provided in base64 form. If the private key is imported
 * successfully, it will be used for future authentication attempts.
 *
 * @param user
 *     The user to associate with the given private key.
 *
 * @param private_key
 *     The base64-encoded private key to import.
 *
 * @param passphrase
 *     The passphrase to use to decrypt the given private key, or NULL if no
 *     passphrase should be used.
 *
 * @return
 *     Zero if the private key is successfully imported, or non-zero if the
 *     private key could not be imported due to an error.
 */
int guac_common_ssh_user_import_key(guac_common_ssh_user* user,
        char* private_key, char* passphrase);

/**
 * Imports the given public key, associating that key with the given user.
 * If the public key is imported successfully, it will be used for
 * future authentication attempts.
 *
 * @param user
 *     The user to associate with the given private key.
 *
 * @param public_key
 *     The base64-encoded public key to import.
 *
 * @return
 *     Zero if public key is successfully imported, or non-zero if the
 *     public key could not be imported due to an error.
 */
int guac_common_ssh_user_import_public_key(guac_common_ssh_user* user,
        char* public_key);

#endif

