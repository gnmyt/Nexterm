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

#include "common/json.h"
#include "download.h"
#include "fs.h"
#include "ls.h"
#include "rdp.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/object.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/string.h>
#include <guacamole/user.h>
#include <winpr/file.h>
#include <winpr/nt.h>
#include <winpr/shell.h>

#include <stdlib.h>

int guac_rdp_download_ack_handler(guac_user* user, guac_stream* stream,
        char* message, guac_protocol_status status) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_download_status* download_status = (guac_rdp_download_status*) stream->data;

    /* Get filesystem, return error if no filesystem */
    guac_rdp_fs* fs = rdp_client->filesystem;
    if (fs == NULL) {
        guac_protocol_send_ack(user->socket, stream, "FAIL (NO FS)",
                GUAC_PROTOCOL_STATUS_SERVER_ERROR);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* If successful, read data */
    if (status == GUAC_PROTOCOL_STATUS_SUCCESS) {

        /* Attempt read into buffer */
        char buffer[4096];
        int bytes_read = guac_rdp_fs_read(fs,
                download_status->file_id,
                download_status->offset, buffer, sizeof(buffer));

        /* If bytes read, send as blob */
        if (bytes_read > 0) {
            download_status->offset += bytes_read;
            guac_protocol_send_blob(user->socket, stream,
                    buffer, bytes_read);
        }

        /* If EOF, send end */
        else if (bytes_read == 0) {
            guac_protocol_send_end(user->socket, stream);
            guac_user_free_stream(user, stream);
            guac_mem_free(download_status);
        }

        /* Otherwise, fail stream */
        else {
            guac_user_log(user, GUAC_LOG_ERROR,
                    "Error reading file for download");
            guac_protocol_send_end(user->socket, stream);
            guac_user_free_stream(user, stream);
            guac_mem_free(download_status);
        }

        guac_socket_flush(user->socket);

    }

    /* Otherwise, return stream to user */
    else
        guac_user_free_stream(user, stream);

    return 0;

}

int guac_rdp_download_get_handler(guac_user* user, guac_object* object,
        char* name) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Get filesystem, ignore request if no filesystem */
    guac_rdp_fs* fs = rdp_client->filesystem;
    if (fs == NULL)
        return 0;

    /* Attempt to open file for reading */
    int file_id = guac_rdp_fs_open(fs, name, GENERIC_READ, 0, FILE_OPEN, 0);
    if (file_id < 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Unable to read file \"%s\"",
                name);
        return 0;
    }

    /* Get opened file */
    guac_rdp_fs_file* file = guac_rdp_fs_get_file(fs, file_id);
    if (file == NULL) {
        guac_client_log(fs->client, GUAC_LOG_DEBUG,
                "%s: Successful open produced bad file_id: %i",
                __func__, file_id);
        return 0;
    }

    /* If directory, send contents of directory */
    if (file->attributes & FILE_ATTRIBUTE_DIRECTORY) {

        /* Create stream data */
        guac_rdp_ls_status* ls_status = guac_mem_alloc(sizeof(guac_rdp_ls_status));
        ls_status->fs = fs;
        ls_status->file_id = file_id;
        guac_strlcpy(ls_status->directory_name, name,
                sizeof(ls_status->directory_name));

        /* Allocate stream for body */
        guac_stream* stream = guac_user_alloc_stream(user);
        stream->ack_handler = guac_rdp_ls_ack_handler;
        stream->data = ls_status;

        /* Init JSON object state */
        guac_common_json_begin_object(user, stream,
                &ls_status->json_state);

        /* Associate new stream with get request */
        guac_protocol_send_body(user->socket, object, stream,
                GUAC_USER_STREAM_INDEX_MIMETYPE, name);

    }

    /* Otherwise, send file contents if downloads are allowed */
    else if (!fs->disable_download) {

        /* Create stream data */
        guac_rdp_download_status* download_status = guac_mem_alloc(sizeof(guac_rdp_download_status));
        download_status->file_id = file_id;
        download_status->offset = 0;

        /* Allocate stream for body */
        guac_stream* stream = guac_user_alloc_stream(user);
        stream->data = download_status;
        stream->ack_handler = guac_rdp_download_ack_handler;

        /* Associate new stream with get request */
        guac_protocol_send_body(user->socket, object, stream,
                "application/octet-stream", name);

    }

    else
        guac_client_log(client, GUAC_LOG_INFO, "Unable to download file "
                "\"%s\", file downloads have been disabled.", name);

    guac_socket_flush(user->socket);
    return 0;
}

void* guac_rdp_download_to_user(guac_user* user, void* data) {

    /* Do not bother attempting the download if the user has left */
    if (user == NULL)
        return NULL;

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_fs* filesystem = rdp_client->filesystem;

    /* Ignore download if filesystem has been unloaded */
    if (filesystem == NULL)
        return NULL;

    /* Ignore download if downloads have been disabled */
    if (filesystem->disable_download) {
        guac_client_log(client, GUAC_LOG_WARNING, "A download attempt has "
                "been blocked due to downloads being disabled, however it "
                "should have been blocked at a higher level. This is likely "
                "a bug.");
        return NULL;
    }

    /* Attempt to open requested file */
    char* path = (char*) data;
    int file_id = guac_rdp_fs_open(filesystem, path,
            FILE_READ_DATA, 0, FILE_OPEN, 0);

    /* If file opened successfully, start stream */
    if (file_id >= 0) {

        /* Associate stream with transfer status */
        guac_stream* stream = guac_user_alloc_stream(user);
        guac_rdp_download_status* download_status = guac_mem_alloc(sizeof(guac_rdp_download_status));
        stream->data = download_status;
        stream->ack_handler = guac_rdp_download_ack_handler;
        download_status->file_id = file_id;
        download_status->offset = 0;

        guac_user_log(user, GUAC_LOG_DEBUG, "%s: Initiating download "
                "of \"%s\"", __func__, path);

        /* Begin stream */
        guac_protocol_send_file(user->socket, stream,
                "application/octet-stream", guac_rdp_fs_basename(path));
        guac_socket_flush(user->socket);

        /* Download started successfully */
        return stream;

    }

    /* Download failed */
    guac_user_log(user, GUAC_LOG_ERROR, "Unable to download \"%s\"", path);
    return NULL;

}

