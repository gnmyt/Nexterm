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

#include "common-ssh/sftp.h"
#include "common-ssh/ssh.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/object.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <guacamole/string.h>
#include <guacamole/user.h>
#include <libssh2.h>

#include <fcntl.h>
#include <libgen.h>
#include <stdlib.h>
#include <string.h>

int guac_common_ssh_sftp_normalize_path(char* fullpath,
        const char* path) {

    int path_depth = 0;
    const char* path_components[GUAC_COMMON_SSH_SFTP_MAX_DEPTH];

    /* If original path is not absolute, normalization fails */
    if (path[0] != '\\' && path[0] != '/')
        return 0;

    /* Create scratch copy of path excluding leading slash (we will be
     * replacing path separators with null terminators and referencing those
     * substrings directly as path components) */
    char path_scratch[GUAC_COMMON_SSH_SFTP_MAX_PATH - 1];
    int length = guac_strlcpy(path_scratch, path + 1,
            sizeof(path_scratch));

    /* Fail if provided path is too long */
    if (length >= sizeof(path_scratch))
        return 0;

    /* Locate all path components within path */
    const char* current_path_component = &(path_scratch[0]);
    for (int i = 0; i <= length; i++) {

        /* If current character is a path separator, parse as component */
        char c = path_scratch[i];
        if (c == '/' || c == '\\' || c == '\0') {

            /* Terminate current component */
            path_scratch[i] = '\0';

            /* If component refers to parent, just move up in depth */
            if (strcmp(current_path_component, "..") == 0) {
                if (path_depth > 0)
                    path_depth--;
            }

            /* Otherwise, if component not current directory, add to list */
            else if (strcmp(current_path_component, ".") != 0
                    && strcmp(current_path_component, "") != 0) {

                /* Fail normalization if path is too deep */
                if (path_depth >= GUAC_COMMON_SSH_SFTP_MAX_DEPTH)
                    return 0;

                path_components[path_depth++] = current_path_component;

            }

            /* Update start of next component */
            current_path_component = &(path_scratch[i+1]);

        } /* end if separator */

    } /* end for each character */

    /* Add leading slash for resulting absolute path */
    fullpath[0] = '/';

    /* Append normalized components to path, separated by slashes */
    guac_strljoin(fullpath + 1, path_components, path_depth,
            "/", GUAC_COMMON_SSH_SFTP_MAX_PATH - 1);

    return 1;

}

/**
 * Translates the last error message received by the SFTP layer of an SSH
 * session into a Guacamole protocol status code.
 *
 * @param filesystem
 *     The object (not guac_object) defining the filesystem associated with the
 *     SFTP and SSH sessions.
 *
 * @return
 *     The Guacamole protocol status code corresponding to the last reported
 *     error of the SFTP layer, if nay, or GUAC_PROTOCOL_STATUS_SUCCESS if no
 *     error has occurred.
 */
static guac_protocol_status guac_sftp_get_status(
        guac_common_ssh_sftp_filesystem* filesystem) {

    /* Get libssh2 objects */
    LIBSSH2_SFTP*    sftp    = filesystem->sftp_session;
    LIBSSH2_SESSION* session = filesystem->ssh_session->session;

    /* Return success code if no error occurred */
    if (libssh2_session_last_errno(session) != LIBSSH2_ERROR_SFTP_PROTOCOL)
        return GUAC_PROTOCOL_STATUS_SUCCESS;

    /* Translate SFTP error codes defined by
     * https://tools.ietf.org/html/draft-ietf-secsh-filexfer-02 (the most
     * commonly-implemented standard) */
    switch (libssh2_sftp_last_error(sftp)) {

        /* SSH_FX_OK (not an error) */
        case 0:
            return GUAC_PROTOCOL_STATUS_SUCCESS;

        /* SSH_FX_EOF (technically not an error) */
        case 1:
            return GUAC_PROTOCOL_STATUS_SUCCESS;

        /* SSH_FX_NO_SUCH_FILE */
        case 2:
            return GUAC_PROTOCOL_STATUS_RESOURCE_NOT_FOUND;

        /* SSH_FX_PERMISSION_DENIED */
        case 3:
            return GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN;

        /* SSH_FX_FAILURE */
        case 4:
            return GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR;

        /* SSH_FX_BAD_MESSAGE */
        case 5:
            return GUAC_PROTOCOL_STATUS_SERVER_ERROR;

        /* SSH_FX_NO_CONNECTION / SSH_FX_CONNECTION_LOST */
        case 6:
        case 7:
            return GUAC_PROTOCOL_STATUS_UPSTREAM_TIMEOUT;

        /* SSH_FX_OP_UNSUPPORTED */
        case 8:
            return GUAC_PROTOCOL_STATUS_UNSUPPORTED;

        /* Return generic error if cause unknown */
        default:
            return GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR;

    }

}

/**
 * Concatenates the given filename with the given path, separating the two
 * with a single forward slash. The full result must be no more than
 * GUAC_COMMON_SSH_SFTP_MAX_PATH bytes long, counting null terminator.
 *
 * @param fullpath
 *     The buffer to store the result within. This buffer must be at least
 *     GUAC_COMMON_SSH_SFTP_MAX_PATH bytes long.
 *
 * @param path
 *     The path to append the filename to.
 *
 * @param filename
 *     The filename to append to the path.
 *
 * @return
 *     Non-zero if the filename is valid and was successfully appended to the
 *     path, zero otherwise.
 */
static int guac_ssh_append_filename(char* fullpath, const char* path,
        const char* filename) {

    int length;

    /* Disallow "." as a filename */
    if (strcmp(filename, ".") == 0)
        return 0;

    /* Disallow ".." as a filename */
    if (strcmp(filename, "..") == 0)
        return 0;

    /* Filenames may not contain slashes */
    if (strchr(filename, '/') != NULL)
        return 0;

    /* Copy base path */
    length = guac_strlcpy(fullpath, path, GUAC_COMMON_SSH_SFTP_MAX_PATH);

    /*
     * Append trailing slash only if:
     *  1) Trailing slash is not already present
     *  2) Path is non-empty
     */
    if (length > 0 && fullpath[length - 1] != '/')
        length += guac_strlcpy(fullpath + length, "/",
                GUAC_COMMON_SSH_SFTP_MAX_PATH - length);

    /* Append filename */
    length += guac_strlcpy(fullpath + length, filename,
            GUAC_COMMON_SSH_SFTP_MAX_PATH - length);

    /* Verify path length is within maximum */
    if (length >= GUAC_COMMON_SSH_SFTP_MAX_PATH)
        return 0;

    /* Append was successful */
    return 1;

}

/**
 * Concatenates the given paths, separating the two with a single forward
 * slash. The full result must be no more than GUAC_COMMON_SSH_SFTP_MAX_PATH
 * bytes long, counting null terminator.
 *
 * @param fullpath
 *     The buffer to store the result within. This buffer must be at least
 *     GUAC_COMMON_SSH_SFTP_MAX_PATH bytes long.
 *
 * @param path_a
 *     The path to place at the beginning of the resulting path.
 *
 * @param path_b
 *     The path to append after path_a within the resulting path.
 *
 * @return
 *     Non-zero if the paths were successfully concatenated together, zero
 *     otherwise.
 */
static int guac_ssh_append_path(char* fullpath, const char* path_a,
        const char* path_b) {

    int length;

    /* Copy first half of path */
    length = guac_strlcpy(fullpath, path_a, GUAC_COMMON_SSH_SFTP_MAX_PATH);
    if (length >= GUAC_COMMON_SSH_SFTP_MAX_PATH)
        return 0;

    /* Ensure path ends with trailing slash */
    if (length == 0 || fullpath[length - 1] != '/')
        length += guac_strlcpy(fullpath + length, "/",
                GUAC_COMMON_SSH_SFTP_MAX_PATH - length);

    /* Skip past leading slashes in second path */
    while (*path_b == '/')
       path_b++;

    /* Append final half of path */
    length += guac_strlcpy(fullpath + length, path_b,
            GUAC_COMMON_SSH_SFTP_MAX_PATH - length);

    /* Verify path length is within maximum */
    if (length >= GUAC_COMMON_SSH_SFTP_MAX_PATH)
        return 0;

    /* Append was successful */
    return 1;

}

/**
 * Handler for blob messages which continue an inbound SFTP data transfer
 * (upload). The data associated with the given stream is expected to be a
 * pointer to an open LIBSSH2_SFTP_HANDLE for the file to which the data
 * should be written.
 *
 * @param user
 *     The user receiving the blob message.
 *
 * @param stream
 *     The Guacamole protocol stream associated with the received blob message.
 *
 * @param data
 *     The data received within the blob.
 *
 * @param length
 *     The length of the received data, in bytes.
 *
 * @return
 *     Zero if the blob is handled successfully, or non-zero on error.
 */
static int guac_common_ssh_sftp_blob_handler(guac_user* user,
        guac_stream* stream, void* data, int length) {

    /* Pull file from stream */
    LIBSSH2_SFTP_HANDLE* file = (LIBSSH2_SFTP_HANDLE*) stream->data;

    /* Attempt write */
    if (libssh2_sftp_write(file, data, length) == length) {
        guac_user_log(user, GUAC_LOG_DEBUG, "%i bytes written", length);
        guac_protocol_send_ack(user->socket, stream, "SFTP: OK",
                GUAC_PROTOCOL_STATUS_SUCCESS);
        guac_socket_flush(user->socket);
    }

    /* Inform of any errors */
    else {
        guac_user_log(user, GUAC_LOG_INFO, "Unable to write to file");
        guac_protocol_send_ack(user->socket, stream, "SFTP: Write failed",
                GUAC_PROTOCOL_STATUS_SERVER_ERROR);
        guac_socket_flush(user->socket);
    }

    return 0;

}

/**
 * Handler for end messages which terminate an inbound SFTP data transfer
 * (upload). The data associated with the given stream is expected to be a
 * pointer to an open LIBSSH2_SFTP_HANDLE for the file to which the data
 * has been written and which should now be closed.
 *
 * @param user
 *     The user receiving the end message.
 *
 * @param stream
 *     The Guacamole protocol stream associated with the received end message.
 *
 * @return
 *     Zero if the file is closed successfully, or non-zero on error.
 */
static int guac_common_ssh_sftp_end_handler(guac_user* user,
        guac_stream* stream) {

    /* Pull file from stream */
    LIBSSH2_SFTP_HANDLE* file = (LIBSSH2_SFTP_HANDLE*) stream->data;

    /* Attempt to close file */
    if (libssh2_sftp_close(file) == 0) {
        guac_user_log(user, GUAC_LOG_DEBUG, "File closed");
        guac_protocol_send_ack(user->socket, stream, "SFTP: OK",
                GUAC_PROTOCOL_STATUS_SUCCESS);
        guac_socket_flush(user->socket);
    }
    else {
        guac_user_log(user, GUAC_LOG_INFO, "Unable to close file");
        guac_protocol_send_ack(user->socket, stream, "SFTP: Close failed",
                GUAC_PROTOCOL_STATUS_SERVER_ERROR);
        guac_socket_flush(user->socket);
    }

    return 0;

}

int guac_common_ssh_sftp_handle_file_stream(
        guac_common_ssh_sftp_filesystem* filesystem, guac_user* user,
        guac_stream* stream, char* mimetype, char* filename) {

    char fullpath[GUAC_COMMON_SSH_SFTP_MAX_PATH];
    LIBSSH2_SFTP_HANDLE* file;

    /* Ignore upload if uploads have been disabled */
    if (filesystem->disable_upload) {
        guac_user_log(user, GUAC_LOG_WARNING, "A upload attempt has "
                "been blocked due to uploads being disabled, however it "
                "should have been blocked at a higher level. This is likely "
                "a bug.");
        guac_protocol_send_ack(user->socket, stream, "SFTP: Upload disabled",
                GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN);
        guac_socket_flush(user->socket);
        return 0;
    }

    /* Concatenate filename with path */
    if (!guac_ssh_append_filename(fullpath, filesystem->upload_path,
                filename)) {

        guac_user_log(user, GUAC_LOG_DEBUG,
                "Filename \"%s\" is invalid or resulting path is too long",
                filename);

        /* Abort transfer - invalid filename */
        guac_protocol_send_ack(user->socket, stream, 
                "SFTP: Illegal filename",
                GUAC_PROTOCOL_STATUS_CLIENT_BAD_REQUEST);

        guac_socket_flush(user->socket);
        return 0;
    }

    /* Open file via SFTP */
    file = libssh2_sftp_open(filesystem->sftp_session, fullpath,
            LIBSSH2_FXF_WRITE | LIBSSH2_FXF_CREAT | LIBSSH2_FXF_TRUNC,
            S_IRUSR | S_IWUSR);

    /* Inform of status */
    if (file != NULL) {

        guac_user_log(user, GUAC_LOG_DEBUG,
                "File \"%s\" opened",
                fullpath);

        guac_protocol_send_ack(user->socket, stream, "SFTP: File opened",
                GUAC_PROTOCOL_STATUS_SUCCESS);
        guac_socket_flush(user->socket);
    }
    else {
        guac_user_log(user, GUAC_LOG_INFO,
                "Unable to open file \"%s\"", fullpath);
        guac_protocol_send_ack(user->socket, stream, "SFTP: Open failed",
                guac_sftp_get_status(filesystem));
        guac_socket_flush(user->socket);
    }

    /* Set handlers for file stream */
    stream->blob_handler = guac_common_ssh_sftp_blob_handler;
    stream->end_handler = guac_common_ssh_sftp_end_handler;

    /* Store file within stream */
    stream->data = file;
    return 0;

}

/**
 * Handler for ack messages which continue an outbound SFTP data transfer
 * (download), signaling the current status and requesting additional data.
 * The data associated with the given stream is expected to be a pointer to an
 * open LIBSSH2_SFTP_HANDLE for the file from which the data is to be read.
 *
 * @param user
 *     The user receiving the ack message.
 *
 * @param stream
 *     The Guacamole protocol stream associated with the received ack message.
 *
 * @param message
 *     An arbitrary human-readable message describing the nature of the
 *     success or failure denoted by the ack message.
 *
 * @param status
 *     The status code associated with the ack message, which may indicate
 *     success or an error.
 *
 * @return
 *     Zero if the file is read from successfully, or non-zero on error.
 */
static int guac_common_ssh_sftp_ack_handler(guac_user* user,
        guac_stream* stream, char* message, guac_protocol_status status) {

    /* Pull file from stream */
    LIBSSH2_SFTP_HANDLE* file = (LIBSSH2_SFTP_HANDLE*) stream->data;

    /* If successful, read data */
    if (status == GUAC_PROTOCOL_STATUS_SUCCESS) {

        /* Attempt read into buffer */
        char buffer[4096];
        int bytes_read = libssh2_sftp_read(file, buffer, sizeof(buffer)); 

        /* If bytes read, send as blob */
        if (bytes_read > 0) {
            guac_protocol_send_blob(user->socket, stream,
                    buffer, bytes_read);

            guac_user_log(user, GUAC_LOG_DEBUG, "%i bytes sent to user",
                    bytes_read);

        }

        /* If bytes could not be read, handle EOF or error condition */
        else {

            /* If EOF, send end */
            if (bytes_read == 0) {
                guac_user_log(user, GUAC_LOG_DEBUG, "File sent");
                guac_protocol_send_end(user->socket, stream);
                guac_user_free_stream(user, stream);
            }

            /* Otherwise, fail stream */
            else {
                guac_user_log(user, GUAC_LOG_INFO, "Error reading file");
                guac_protocol_send_end(user->socket, stream);
                guac_user_free_stream(user, stream);
            }

            /* Close file */
            if (libssh2_sftp_close(file) == 0)
                guac_user_log(user, GUAC_LOG_DEBUG, "File closed");
            else
                guac_user_log(user, GUAC_LOG_INFO, "Unable to close file");

        }

        guac_socket_flush(user->socket);

    }

    /* Otherwise, return stream to user */
    else
        guac_user_free_stream(user, stream);

    return 0;
}

guac_stream* guac_common_ssh_sftp_download_file(
        guac_common_ssh_sftp_filesystem* filesystem, guac_user* user,
        char* filename) {

    guac_stream* stream;
    LIBSSH2_SFTP_HANDLE* file;

    /* Ignore download if downloads have been disabled */
    if (filesystem->disable_download) {
        guac_user_log(user, GUAC_LOG_WARNING, "A download attempt has "
                "been blocked due to downloads being disabled, however it "
                "should have been blocked at a higher level. This is likely "
                "a bug.");
        return NULL;
    }

    /* Attempt to open file for reading */
    file = libssh2_sftp_open(filesystem->sftp_session, filename,
            LIBSSH2_FXF_READ, 0);
    if (file == NULL) {
        guac_user_log(user, GUAC_LOG_INFO, 
                "Unable to read file \"%s\"", filename);
        return NULL;
    }

    /* Allocate stream */
    stream = guac_user_alloc_stream(user);
    stream->ack_handler = guac_common_ssh_sftp_ack_handler;
    stream->data = file;

    /* Send stream start, strip name */
    filename = basename(filename);
    guac_protocol_send_file(user->socket, stream,
            "application/octet-stream", filename);
    guac_socket_flush(user->socket);

    guac_user_log(user, GUAC_LOG_DEBUG, "Sending file \"%s\"", filename);
    return stream;

}

void guac_common_ssh_sftp_set_upload_path(
        guac_common_ssh_sftp_filesystem* filesystem, const char* path) {

    guac_client* client = filesystem->ssh_session->client;

    /* Ignore requests which exceed maximum-allowed path */
    int length = strnlen(path, GUAC_COMMON_SSH_SFTP_MAX_PATH)+1;
    if (length > GUAC_COMMON_SSH_SFTP_MAX_PATH) {
        guac_client_log(client, GUAC_LOG_ERROR,
                "Submitted path exceeds limit of %i bytes",
                GUAC_COMMON_SSH_SFTP_MAX_PATH);
        return;
    }

    /* Copy path */
    memcpy(filesystem->upload_path, path, length);
    guac_client_log(client, GUAC_LOG_DEBUG, "Upload path set to \"%s\"", path);

}

/**
 * Handler for ack messages received due to receipt of a "body" or "blob"
 * instruction associated with a SFTP directory list operation.
 *
 * @param user
 *     The user receiving the ack message.
 *
 * @param stream
 *     The Guacamole protocol stream associated with the received ack message.
 *
 * @param message
 *     An arbitrary human-readable message describing the nature of the
 *     success or failure denoted by this ack message.
 *
 * @param status
 *     The status code associated with this ack message, which may indicate
 *     success or an error.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
static int guac_common_ssh_sftp_ls_ack_handler(guac_user* user,
        guac_stream* stream, char* message, guac_protocol_status status) {

    int bytes_read;

    char filename[GUAC_COMMON_SSH_SFTP_MAX_PATH];
    LIBSSH2_SFTP_ATTRIBUTES attributes;

    guac_common_ssh_sftp_ls_state* list_state =
        (guac_common_ssh_sftp_ls_state*) stream->data;

    guac_common_ssh_sftp_filesystem* filesystem = list_state->filesystem;

    LIBSSH2_SFTP* sftp = filesystem->sftp_session;

    /* If unsuccessful, free stream and abort */
    if (status != GUAC_PROTOCOL_STATUS_SUCCESS) {
        libssh2_sftp_closedir(list_state->directory);
        guac_user_free_stream(user, stream);
        guac_mem_free(list_state);
        return 0;
    }

    /* While directory entries remain */
    while ((bytes_read = libssh2_sftp_readdir(list_state->directory,
                filename, sizeof(filename), &attributes)) > 0) {

        char absolute_path[GUAC_COMMON_SSH_SFTP_MAX_PATH];

        /* Skip current and parent directory entries */
        if (strcmp(filename, ".") == 0 || strcmp(filename, "..") == 0)
            continue;

        /* Concatenate into absolute path - skip if invalid */
        if (!guac_ssh_append_filename(absolute_path, 
                    list_state->directory_name, filename)) {

            guac_user_log(user, GUAC_LOG_DEBUG,
                    "Skipping filename \"%s\" - filename is invalid or "
                    "resulting path is too long", filename);

            continue;
        }

        /* Stat explicitly if symbolic link (might point to directory) */
        if (LIBSSH2_SFTP_S_ISLNK(attributes.permissions))
            libssh2_sftp_stat(sftp, absolute_path, &attributes);

        /* Determine mimetype */
        const char* mimetype;
        if (LIBSSH2_SFTP_S_ISDIR(attributes.permissions))
            mimetype = GUAC_USER_STREAM_INDEX_MIMETYPE;
        else
            mimetype = "application/octet-stream";

        /* Write entry, waiting for next ack if a blob is written */
        if (guac_common_json_write_property(user, stream,
                    &list_state->json_state, absolute_path, mimetype))
            break;

    }

    /* Complete JSON and cleanup at end of directory */
    if (bytes_read <= 0) {

        /* Complete JSON object */
        guac_common_json_end_object(user, stream, &list_state->json_state);
        guac_common_json_flush(user, stream, &list_state->json_state);

        /* Clean up resources */
        libssh2_sftp_closedir(list_state->directory);
        guac_mem_free(list_state);

        /* Signal of stream */
        guac_protocol_send_end(user->socket, stream);
        guac_user_free_stream(user, stream);

    }

    guac_socket_flush(user->socket);
    return 0;

}

/**
 * Translates a stream name for the given SFTP filesystem object into the
 * absolute path corresponding to the actual file it represents.
 *
 * @param fullpath
 *     The buffer to populate with the translated path. This buffer MUST be at
 *     least GUAC_COMMON_SSH_SFTP_MAX_PATH bytes in size.
 *
 * @param object
 *     The Guacamole protocol object associated with the SFTP filesystem.
 *
 * @param name
 *     The name of the stream (file) to translate into an absolute path.
 *
 * @return
 *     Non-zero if translation succeeded, zero otherwise.
 */
static int guac_common_ssh_sftp_translate_name(char* fullpath,
        guac_object* object, char* name) {

    char normalized_name[GUAC_COMMON_SSH_SFTP_MAX_PATH];

    guac_common_ssh_sftp_filesystem* filesystem =
        (guac_common_ssh_sftp_filesystem*) object->data;

    /* Normalize stream name into a path, and append to the root path */
    return guac_common_ssh_sftp_normalize_path(normalized_name, name)
        && guac_ssh_append_path(fullpath, filesystem->root_path,
                normalized_name);

}

/**
 * Handler for get messages. In context of SFTP and the filesystem exposed via
 * the Guacamole protocol, get messages request the body of a file within the
 * filesystem.
 *
 * @param user
 *     The user who sent the get message.
 *
 * @param object
 *     The Guacamole protocol object associated with the get request itself.
 *
 * @param name
 *     The name of the input stream (file) being requested.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
static int guac_common_ssh_sftp_get_handler(guac_user* user,
        guac_object* object, char* name) {

    char fullpath[GUAC_COMMON_SSH_SFTP_MAX_PATH];

    guac_common_ssh_sftp_filesystem* filesystem =
        (guac_common_ssh_sftp_filesystem*) object->data;

    LIBSSH2_SFTP* sftp = filesystem->sftp_session;
    LIBSSH2_SFTP_ATTRIBUTES attributes;

    /* Translate stream name into filesystem path */
    if (!guac_common_ssh_sftp_translate_name(fullpath, object, name)) {
        guac_user_log(user, GUAC_LOG_INFO, "Unable to generate real path "
                "for stream \"%s\"", name);
        return 0;
    }

    /* Attempt to read file information */
    if (libssh2_sftp_stat(sftp, fullpath, &attributes)) {
        guac_user_log(user, GUAC_LOG_INFO, "Unable to read file \"%s\"",
                fullpath);
        return 0;
    }

    /* If directory, send contents of directory */
    if (LIBSSH2_SFTP_S_ISDIR(attributes.permissions)) {

        /* Open as directory */
        LIBSSH2_SFTP_HANDLE* dir = libssh2_sftp_opendir(sftp, fullpath);
        if (dir == NULL) {
            guac_user_log(user, GUAC_LOG_INFO,
                    "Unable to read directory \"%s\"", fullpath);
            return 0;
        }

        /* Init directory listing state */
        guac_common_ssh_sftp_ls_state* list_state =
            guac_mem_alloc(sizeof(guac_common_ssh_sftp_ls_state));

        list_state->directory = dir;
        list_state->filesystem = filesystem;

        int length = guac_strlcpy(list_state->directory_name, name,
                sizeof(list_state->directory_name));

        /* Bail out if directory name is too long to store */
        if (length >= sizeof(list_state->directory_name)) {
            guac_user_log(user, GUAC_LOG_INFO, "Unable to read directory "
                    "\"%s\": Path too long", fullpath);
            guac_mem_free(list_state);
            return 0;
        }

        /* Allocate stream for body */
        guac_stream* stream = guac_user_alloc_stream(user);
        stream->ack_handler = guac_common_ssh_sftp_ls_ack_handler;
        stream->data = list_state;

        /* Init JSON object state */
        guac_common_json_begin_object(user, stream, &list_state->json_state);

        /* Associate new stream with get request */
        guac_protocol_send_body(user->socket, object, stream,
                GUAC_USER_STREAM_INDEX_MIMETYPE, name);

    }

    /* Otherwise, send file contents */
    else {

        /* If downloads are disabled, log and return. */
        if (filesystem->disable_download) {
            guac_user_log(user, GUAC_LOG_INFO,
                    "Unable to download file \"%s\", "
                    "file downloads have been disabled.", fullpath);
            return 0;
        }
        
        /* Open as normal file */
        LIBSSH2_SFTP_HANDLE* file = libssh2_sftp_open(sftp, fullpath,
            LIBSSH2_FXF_READ, 0);
        if (file == NULL) {
            guac_user_log(user, GUAC_LOG_INFO,
                    "Unable to read file \"%s\"", fullpath);
            return 0;
        }

        /* Allocate stream for body */
        guac_stream* stream = guac_user_alloc_stream(user);
        stream->ack_handler = guac_common_ssh_sftp_ack_handler;
        stream->data = file;

        /* Associate new stream with get request */
        guac_protocol_send_body(user->socket, object, stream,
                "application/octet-stream", name);

    }

    guac_socket_flush(user->socket);
    return 0;
}

/**
 * Handler for put messages. In context of SFTP and the filesystem exposed via
 * the Guacamole protocol, put messages request write access to a file within
 * the filesystem.
 *
 * @param user
 *     The user who sent the put message.
 *
 * @param object
 *     The Guacamole protocol object associated with the put request itself.
 *
 * @param stream
 *     The Guacamole protocol stream along which the user will be sending
 *     file data.
 *
 * @param mimetype
 *     The mimetype of the data being send along the stream.
 *
 * @param name
 *     The name of the input stream (file) being requested.
 *
 * @return
 *     Zero on success, non-zero on error.
 */
static int guac_common_ssh_sftp_put_handler(guac_user* user,
        guac_object* object, guac_stream* stream, char* mimetype, char* name) {

    char fullpath[GUAC_COMMON_SSH_SFTP_MAX_PATH];

    guac_common_ssh_sftp_filesystem* filesystem =
        (guac_common_ssh_sftp_filesystem*) object->data;

    /* Ignore upload if uploads have been disabled */
    if (filesystem->disable_upload) {
        guac_user_log(user, GUAC_LOG_WARNING, "A upload attempt has "
                "been blocked due to uploads being disabled, however it "
                "should have been blocked at a higher level. This is likely "
                "a bug.");
        guac_protocol_send_ack(user->socket, stream, "SFTP: Upload disabled",
                GUAC_PROTOCOL_STATUS_CLIENT_FORBIDDEN);
        guac_socket_flush(user->socket);
        return 0;
    }

    LIBSSH2_SFTP* sftp = filesystem->sftp_session;

    /* Translate stream name into filesystem path */
    if (!guac_common_ssh_sftp_translate_name(fullpath, object, name)) {
        guac_user_log(user, GUAC_LOG_INFO, "Unable to generate real path "
                "for stream \"%s\"", name);
        return 0;
    }

    /* Open file via SFTP */
    LIBSSH2_SFTP_HANDLE* file = libssh2_sftp_open(sftp, fullpath,
            LIBSSH2_FXF_WRITE | LIBSSH2_FXF_CREAT | LIBSSH2_FXF_TRUNC,
            S_IRUSR | S_IWUSR);

    /* Acknowledge stream if successful */
    if (file != NULL) {
        guac_user_log(user, GUAC_LOG_DEBUG, "File \"%s\" opened", fullpath);
        guac_protocol_send_ack(user->socket, stream, "SFTP: File opened",
                GUAC_PROTOCOL_STATUS_SUCCESS);
    }

    /* Abort on failure */
    else {
        guac_user_log(user, GUAC_LOG_INFO,
                "Unable to open file \"%s\"", fullpath);
        guac_protocol_send_ack(user->socket, stream, "SFTP: Open failed",
                guac_sftp_get_status(filesystem));
    }

    /* Set handlers for file stream */
    stream->blob_handler = guac_common_ssh_sftp_blob_handler;
    stream->end_handler = guac_common_ssh_sftp_end_handler;

    /* Store file within stream */
    stream->data = file;

    guac_socket_flush(user->socket);
    return 0;
}

void* guac_common_ssh_expose_sftp_filesystem(guac_user* user, void* data) {

    guac_common_ssh_sftp_filesystem* filesystem =
        (guac_common_ssh_sftp_filesystem*) data;

    /* No need to expose if there is no filesystem or the user has left */
    if (user == NULL || filesystem == NULL)
        return NULL;

    /* Allocate and expose filesystem object for user */
    return guac_common_ssh_alloc_sftp_filesystem_object(filesystem, user);

}

guac_object* guac_common_ssh_alloc_sftp_filesystem_object(
        guac_common_ssh_sftp_filesystem* filesystem, guac_user* user) {

    /* Init filesystem */
    guac_object* fs_object = guac_user_alloc_object(user);
    fs_object->get_handler = guac_common_ssh_sftp_get_handler;
    
    /* Only handle uploads if not disabled. */
    if (!filesystem->disable_upload)
        fs_object->put_handler = guac_common_ssh_sftp_put_handler;
    
    fs_object->data = filesystem;

    /* Send filesystem to user */
    guac_protocol_send_filesystem(user->socket, fs_object, filesystem->name);
    guac_socket_flush(user->socket);

    return fs_object;

}

guac_common_ssh_sftp_filesystem* guac_common_ssh_create_sftp_filesystem(
        guac_common_ssh_session* session, const char* root_path,
        const char* name, int disable_download, int disable_upload) {

    /* Request SFTP */
    LIBSSH2_SFTP* sftp_session = libssh2_sftp_init(session->session);
    if (sftp_session == NULL)
        return NULL;

    /* Allocate data for SFTP session */
    guac_common_ssh_sftp_filesystem* filesystem =
        guac_mem_alloc(sizeof(guac_common_ssh_sftp_filesystem));

    /* Associate SSH session with SFTP data and user */
    filesystem->ssh_session = session;
    filesystem->sftp_session = sftp_session;
    
    /* Copy over disable flags */
    filesystem->disable_download = disable_download;
    filesystem->disable_upload = disable_upload;

    /* Normalize and store the provided root path */
    if (!guac_common_ssh_sftp_normalize_path(filesystem->root_path,
                root_path)) {
        guac_client_log(session->client, GUAC_LOG_WARNING, "Cannot create "
                "SFTP filesystem - \"%s\" is not a valid path.", root_path);
        guac_mem_free(filesystem);
        return NULL;
    }

    /* Generate filesystem name from root path if no name is provided */
    if (name != NULL)
        filesystem->name = guac_strdup(name);
    else
        filesystem->name = guac_strdup(filesystem->root_path);

    /* Initially upload files to current directory */
    strcpy(filesystem->upload_path, ".");

    /* Return allocated filesystem */
    return filesystem;

}

void guac_common_ssh_destroy_sftp_filesystem(
        guac_common_ssh_sftp_filesystem* filesystem) {

    /* Shutdown SFTP session */
    libssh2_sftp_shutdown(filesystem->sftp_session);

    /* Free associated memory */
    guac_mem_free(filesystem->name);
    guac_mem_free(filesystem);

}

