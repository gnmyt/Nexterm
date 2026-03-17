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
#include "common-ssh/user.h"

#include <guacamole/mem.h>
#include <guacamole/string.h>

#include <stdlib.h>
#include <string.h>

guac_common_ssh_user* guac_common_ssh_create_user(const char* username) {

    guac_common_ssh_user* user = guac_mem_alloc(sizeof(guac_common_ssh_user));

    /* Init user */
    user->username = guac_strdup(username);
    user->password = NULL;
    user->private_key = NULL;
    user->public_key = NULL;

    return user;

}

void guac_common_ssh_destroy_user(guac_common_ssh_user* user) {

    /* Free private key, if present */
    if (user->private_key != NULL)
        guac_common_ssh_key_free(user->private_key);

    /* Free all other data */
    guac_mem_free(user->password);
    guac_mem_free(user->username);
    guac_mem_free(user->public_key);
    guac_mem_free(user);

}

void guac_common_ssh_user_set_password(guac_common_ssh_user* user,
        const char* password) {

    /* Replace current password with given value */
    guac_mem_free(user->password);
    user->password = guac_strdup(password);

}

int guac_common_ssh_user_import_key(guac_common_ssh_user* user,
        char* private_key, char* passphrase) {

    /* Free existing private key, if present */
    if (user->private_key != NULL)
        guac_common_ssh_key_free(user->private_key);

    /* Attempt to read key without passphrase if none given */
    if (passphrase == NULL)
        user->private_key = guac_common_ssh_key_alloc(private_key,
                strlen(private_key), "");

    /* Otherwise, use provided passphrase */
    else
        user->private_key = guac_common_ssh_key_alloc(private_key,
                strlen(private_key), passphrase);

    /* Fail if key could not be read */
    return user->private_key == NULL;

}

int guac_common_ssh_user_import_public_key(guac_common_ssh_user* user,
        char* public_key) {

    /* Free existing public key, if present */
    guac_mem_free(user->public_key);
    user->public_key = guac_strdup(public_key);

    /* Fail if key could not be read */
    return user->public_key == NULL;

}

