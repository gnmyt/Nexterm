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

#include "common-ssh/sftp.h"
#include "sftp.h"
#include "ssh.h"

#include <guacamole/client.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

int guac_sftp_file_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* filename) {

    guac_client* client = user->client;
    guac_ssh_client* ssh_client = (guac_ssh_client*) client->data;
    guac_common_ssh_sftp_filesystem* filesystem = ssh_client->sftp_filesystem;

    /* Handle file upload */
    return guac_common_ssh_sftp_handle_file_stream(filesystem, user, stream,
            mimetype, filename);

}

/**
 * Callback invoked on the current connection owner (if any) when a file
 * download is being initiated through the terminal.
 *
 * @param owner
 *     The guac_user that is the owner of the connection, or NULL if the
 *     connection owner has left.
 *
 * @param data
 *     The filename of the file that should be downloaded.
 *
 * @return
 *     The stream allocated for the file download, or NULL if no stream could
 *     be allocated.
 */
static void* guac_sftp_download_to_owner(guac_user* owner, void* data) {

    /* Do not bother attempting the download if the owner has left */
    if (owner == NULL)
        return NULL;

    guac_client* client = owner->client;
    guac_ssh_client* ssh_client = (guac_ssh_client*) client->data;
    guac_common_ssh_sftp_filesystem* filesystem = ssh_client->sftp_filesystem;

    /* Ignore download if filesystem has been unloaded */
    if (filesystem == NULL)
        return NULL;

    char* filename = (char*) data;

    /* Initiate download of requested file */
    return guac_common_ssh_sftp_download_file(filesystem, owner, filename);

}

guac_stream* guac_sftp_download_file(guac_client* client, char* filename) {

    /* Initiate download to the owner of the connection */
    return (guac_stream*) guac_client_for_owner(client,
            guac_sftp_download_to_owner, filename);

}

void guac_sftp_set_upload_path(guac_client* client, char* path) {

    guac_ssh_client* ssh_client = (guac_ssh_client*) client->data;
    guac_common_ssh_sftp_filesystem* filesystem = ssh_client->sftp_filesystem;

    /* Set upload path as specified */
    guac_common_ssh_sftp_set_upload_path(filesystem, path);

}

