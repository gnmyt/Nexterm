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

#include "fs.h"
#include "rdp.h"
#include "upload.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/object.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>
#include <winpr/nt.h>

#include <stdlib.h>

/**
 * Writes the given filename to the given upload path, sanitizing the filename
 * and translating the filename to the root directory.
 *
 * @param filename
 *     The filename to sanitize and move to the root directory.
 *
 * @param path
 *     A pointer to a buffer which should receive the sanitized path. The
 *     buffer must have at least GUAC_RDP_FS_MAX_PATH bytes available.
 */
static void __generate_upload_path(const char* filename, char* path) {

    int i;

    /* Add initial backslash */
    *(path++) = '\\';

    for (i=1; i<GUAC_RDP_FS_MAX_PATH; i++) {

        /* Get current, stop at end */
        char c = *(filename++);
        if (c == '\0')
            break;

        /* Replace special characters with underscores */
        if (c == '/' || c == '\\')
            c = '_';

        *(path++) = c;

    }

    /* Terminate path */
    *path = '\0';

}

int guac_rdp_upload_file_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* filename) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    int file_id;
    char file_path[GUAC_RDP_FS_MAX_PATH];

    /* Get filesystem, return error if no filesystem */
    guac_rdp_fs* fs = rdp_client->filesystem;
    if (fs == NULL) {
        guac_protocol_send_ack(user->socket, stream, "FAIL (NO FS)",
                GUAC_PROTOCOL_STATUS_SERVER_ERROR);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Ignore upload if uploads have been disabled */
    if (fs->disable_upload) {
        guac_client_log(client, GUAC_LOG_WARNING, "A upload attempt has "
                "been blocked due to uploads being disabled, however it "
                "should have been blocked at a higher level. This is likely "
                "a bug.");
        guac_protocol_send_ack(user->socket, stream, "FAIL (UPLOAD DISABLED)",
                GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Translate name */
    __generate_upload_path(filename, file_path);

    /* Open file */
    file_id = guac_rdp_fs_open(fs, file_path, GENERIC_WRITE, 0,
            FILE_OVERWRITE_IF, 0);
    if (file_id < 0) {
        guac_protocol_send_ack(user->socket, stream, "FAIL (CANNOT OPEN)",
                GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Init upload status */
    guac_rdp_upload_status* upload_status = guac_mem_alloc(sizeof(guac_rdp_upload_status));
    upload_status->offset = 0;
    upload_status->file_id = file_id;
    stream->data = upload_status;
    stream->blob_handler = guac_rdp_upload_blob_handler;
    stream->end_handler = guac_rdp_upload_end_handler;

    guac_protocol_send_ack(user->socket, stream, "OK (STREAM BEGIN)",
            GUAC_PROTOCOL_STATUS_SUCCESS);
    guac_socket_flush(user->socket);
    return 0;

}

int guac_rdp_upload_blob_handler(guac_user* user, guac_stream* stream,
        void* data, int length) {

    int bytes_written;
    guac_rdp_upload_status* upload_status = (guac_rdp_upload_status*) stream->data;

    /* Get filesystem, return error if no filesystem */
    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_fs* fs = rdp_client->filesystem;
    if (fs == NULL) {
        guac_protocol_send_ack(user->socket, stream, "FAIL (NO FS)",
                GUAC_PROTOCOL_STATUS_SERVER_ERROR);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Write entire block */
    while (length > 0) {

        /* Attempt write */
        bytes_written = guac_rdp_fs_write(fs, upload_status->file_id,
                upload_status->offset, data, length);

        /* On error, abort */
        if (bytes_written < 0) {
            guac_protocol_send_ack(user->socket, stream,
                    "FAIL (BAD WRITE)",
                    GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN);
            guac_socket_flush(user->socket);
            return 0;
        }

        /* Update counters */
        upload_status->offset += bytes_written;
        data += bytes_written;
        length -= bytes_written;

    }

    guac_protocol_send_ack(user->socket, stream, "OK (DATA RECEIVED)",
            GUAC_PROTOCOL_STATUS_SUCCESS);
    guac_socket_flush(user->socket);
    return 0;

}

int guac_rdp_upload_end_handler(guac_user* user, guac_stream* stream) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_upload_status* upload_status = (guac_rdp_upload_status*) stream->data;

    /* Get filesystem, return error if no filesystem */
    guac_rdp_fs* fs = rdp_client->filesystem;
    if (fs == NULL) {
        guac_protocol_send_ack(user->socket, stream, "FAIL (NO FS)",
                GUAC_PROTOCOL_STATUS_SERVER_ERROR);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Close file */
    guac_rdp_fs_close(fs, upload_status->file_id);

    /* Acknowledge stream end */
    guac_protocol_send_ack(user->socket, stream, "OK (STREAM END)",
            GUAC_PROTOCOL_STATUS_SUCCESS);
    guac_socket_flush(user->socket);

    guac_mem_free(upload_status);
    return 0;

}

int guac_rdp_upload_put_handler(guac_user* user, guac_object* object,
        guac_stream* stream, char* mimetype, char* name) {

    guac_client* client = user->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /* Get filesystem, return error if no filesystem */
    guac_rdp_fs* fs = rdp_client->filesystem;
    if (fs == NULL) {
        guac_protocol_send_ack(user->socket, stream, "FAIL (NO FS)",
                GUAC_PROTOCOL_STATUS_SERVER_ERROR);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Ignore upload if uploads have been disabled */
    if (fs->disable_upload) {
        guac_client_log(client, GUAC_LOG_WARNING, "A upload attempt has "
                "been blocked due to uploads being disabled, however it "
                "should have been blocked at a higher level. This is likely "
                "a bug.");
        guac_protocol_send_ack(user->socket, stream, "FAIL (UPLOAD DISABLED)",
                GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Open file */
    int file_id = guac_rdp_fs_open(fs, name, GENERIC_WRITE, 0,
            FILE_OVERWRITE_IF, 0);

    /* Abort on failure */
    if (file_id < 0) {
        guac_protocol_send_ack(user->socket, stream, "FAIL (CANNOT OPEN)",
                GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Init upload stream data */
    guac_rdp_upload_status* upload_status = guac_mem_alloc(sizeof(guac_rdp_upload_status));
    upload_status->offset = 0;
    upload_status->file_id = file_id;

    /* Allocate stream, init for file upload */
    stream->data = upload_status;
    stream->blob_handler = guac_rdp_upload_blob_handler;
    stream->end_handler = guac_rdp_upload_end_handler;

    /* Acknowledge stream creation */
    guac_protocol_send_ack(user->socket, stream, "OK (STREAM BEGIN)",
            GUAC_PROTOCOL_STATUS_SUCCESS);
    guac_socket_flush(user->socket);
    return 0;
}

