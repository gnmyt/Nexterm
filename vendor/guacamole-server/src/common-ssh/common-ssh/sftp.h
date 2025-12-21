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

#ifndef GUAC_COMMON_SSH_SFTP_H
#define GUAC_COMMON_SSH_SFTP_H

#include "common/json.h"
#include "ssh.h"

#include <guacamole/object.h>
#include <guacamole/user.h>
#include <libssh2.h>
#include <libssh2_sftp.h>

/**
 * Maximum number of bytes per path.
 */
#define GUAC_COMMON_SSH_SFTP_MAX_PATH 2048

/**
 * Maximum number of path components per path.
 */
#define GUAC_COMMON_SSH_SFTP_MAX_DEPTH 1024

/**
 * Representation of an SFTP-driven filesystem object. Unlike guac_object, this
 * structure is not tied to any particular user.
 */
typedef struct guac_common_ssh_sftp_filesystem {

    /**
     * The human-readable display name of this filesystem.
     */
    char* name;

    /**
     * The distinct SSH session used for SFTP.
     */
    guac_common_ssh_session* ssh_session;

    /**
     * SFTP session, used for file transfers.
     */
    LIBSSH2_SFTP* sftp_session;

    /**
     * The path to the directory to expose to the user as a filesystem object.
     */
    char root_path[GUAC_COMMON_SSH_SFTP_MAX_PATH];

    /**
     * The path files will be sent to, if uploaded directly via a "file"
     * instruction.
     */
    char upload_path[GUAC_COMMON_SSH_SFTP_MAX_PATH];
    
    /**
     * If downloads from SFTP to the local browser should be disabled.
     */
    int disable_download;
    
    /**
     * If uploads from the local browser to SFTP should be disabled.
     */
    int disable_upload;

} guac_common_ssh_sftp_filesystem;

/**
 * The current state of a directory listing operation.
 */
typedef struct guac_common_ssh_sftp_ls_state {

    /**
     * The SFTP filesystem being listed.
     */
    guac_common_ssh_sftp_filesystem* filesystem;

    /**
     * Reference to the directory currently being listed over SFTP. This
     * directory must already be open from a call to libssh2_sftp_opendir().
     */
    LIBSSH2_SFTP_HANDLE* directory;

    /**
     * The absolute path of the directory being listed.
     */
    char directory_name[GUAC_COMMON_SSH_SFTP_MAX_PATH];

    /**
     * The current state of the JSON directory object being written.
     */
    guac_common_json_state json_state;

} guac_common_ssh_sftp_ls_state;

/**
 * Creates a new Guacamole filesystem object which provides access to files
 * and directories via SFTP using the given SSH session. When the filesystem
 * will no longer be used, it must be explicitly destroyed with
 * guac_common_ssh_destroy_sftp_filesystem(). The resulting object is not
 * automatically exposed to users of the connection - filesystem operations
 * must be mediated either through various handlers or through exposing a
 * filesystem guac_object via guac_common_ssh_alloc_sftp_filesystem_object().
 *
 * @param session
 *     The session to use to provide SFTP. This session will automatically be
 *     destroyed when this filesystem is destroyed.
 *
 * @param root_path
 *     The path accessible via SFTP to consider the root path of the filesystem
 *     exposed to the user. Only the contents of this path will be available
 *     via the filesystem object.
 *
 * @param name
 *     The name to send as the name of the filesystem whenever it is exposed
 *     to a user, or NULL to automatically generate a name from the provided
 *     root_path.
 * 
 * @param disable_download
 *     Whether downloads from the SFTP share to the local browser should be
 *     disabled.
 * 
 * @param disable_upload
 *     Whether uploads from the local browser to SFTP should be disabled.
 *
 * @return
 *     A new SFTP filesystem object, not yet exposed to users.
 */
guac_common_ssh_sftp_filesystem* guac_common_ssh_create_sftp_filesystem(
        guac_common_ssh_session* session, const char* root_path,
        const char* name, int disable_download, int disable_upload);

/**
 * Destroys the given filesystem object, disconnecting from SFTP and freeing
 * and associated resources. Any associated session or user objects must be
 * explicitly destroyed.
 *
 * @param filesystem
 *     The filesystem object to destroy.
 */
void guac_common_ssh_destroy_sftp_filesystem(
        guac_common_ssh_sftp_filesystem* filesystem);

/**
 * Creates and exposes a new filesystem guac_object to the given user,
 * providing access to the files within the given SFTP filesystem. The
 * allocated guac_object must eventually be freed via guac_user_free_object().
 *
 * @param filesystem
 *     The filesystem object to expose.
 *
 * @param user
 *     The user that the SFTP filesystem should be exposed to.
 *
 * @return
 *     A new Guacamole filesystem object, configured to use SFTP for uploading
 *     and downloading files.
 */
guac_object* guac_common_ssh_alloc_sftp_filesystem_object(
        guac_common_ssh_sftp_filesystem* filesystem, guac_user* user);

/**
 * Allocates a new filesystem guac_object for the given user, returning the
 * resulting guac_object. This function is provided for convenience, as it is
 * can be used as the callback for guac_client_foreach_user() or
 * guac_client_for_owner(). Note that this guac_object will be tracked
 * internally by libguac, will be provided to us in the parameters of handlers
 * related to that guac_object, and will automatically be freed when the
 * associated guac_user is freed, so the return value of this function can
 * safely be ignored.
 *
 * If either the given user or the given filesystem are NULL, then this
 * function has no effect.
 *
 * @param user
 *     The use to expose the filesystem to, or NULL if nothing should be
 *     exposed.
 *
 * @param data
 *     A pointer to the guac_common_ssh_sftp_filesystem instance to expose
 *     to the given user, or NULL if nothing should be exposed.
 *
 * @return
 *     The guac_object allocated for the newly-exposed filesystem, or NULL if
 *     no filesystem object could be allocated.
 */
void* guac_common_ssh_expose_sftp_filesystem(guac_user* user, void* data);

/**
 * Initiates an SFTP file download to the user via the Guacamole "file"
 * instruction. The download will be automatically monitored and continued
 * after this function terminates in response to "ack" instructions received by
 * the user.
 *
 * @param filesystem
 *     The filesystem containing the file to be downloaded.
 *
 * @param user
 *     The user that should receive the file (via a "file" instruction).
 *
 * @param filename
 *     The filename of the file to download, relative to the given filesystem.
 *
 * @return
 *     The file stream created for the file download, already configured to
 *     properly handle "ack" responses, etc. from the user.
 */
guac_stream* guac_common_ssh_sftp_download_file(
        guac_common_ssh_sftp_filesystem* filesystem, guac_user* user,
        char* filename);

/**
 * Handles an incoming stream from a Guacamole "file" instruction, saving the
 * contents of that stream to the file having the given name within the
 * upload directory set by guac_common_ssh_sftp_set_upload_path().
 *
 * @param filesystem
 *     The filesystem that should receive the uploaded file.
 *
 * @param user
 *     The user who is attempting to open the file stream (the user that sent
 *     the "file" instruction).
 *
 * @param stream
 *     The stream through which the uploaded file data will be received.
 *
 * @param mimetype
 *     The mimetype of the data being received.
 *
 * @param filename
 *     The filename of the file to write to. This filename will always be taken
 *     relative to the upload path set by
 *     guac_common_ssh_sftp_set_upload_path().
 *
 * @return
 *     Zero if the incoming stream has been handled successfully, non-zero on
 *     failure.
 */
int guac_common_ssh_sftp_handle_file_stream(
        guac_common_ssh_sftp_filesystem* filesystem, guac_user* user,
        guac_stream* stream, char* mimetype, char* filename);

/**
 * Set the destination directory for future uploads submitted via
 * guac_common_ssh_sftp_handle_file_stream(). This function has no bearing
 * on the destination directories of files uploaded with "put" instructions.
 *
 * @param filesystem
 *     The filesystem to set the upload path of.
 *
 * @param path
 *     The path to use for future uploads submitted via the
 *     guac_common_ssh_sftp_handle_file_stream() function.
 */
void guac_common_ssh_sftp_set_upload_path(
        guac_common_ssh_sftp_filesystem* filesystem, const char* path);

/**
 * Given an arbitrary absolute path, which may contain "..", ".", and
 * backslashes, creates an equivalent absolute path which does NOT contain
 * relative path components (".." or "."), backslashes, or empty path
 * components. With the exception of paths referring to the root directory, the
 * resulting path is guaranteed to not contain trailing slashes.
 *
 * Normalization will fail if the given path is not absolute, is too long, or
 * contains more than GUAC_COMMON_SSH_SFTP_MAX_DEPTH path components.
 *
 * @param fullpath
 *     The buffer to populate with the normalized path. The normalized path
 *     will not contain relative path components like ".." or ".", nor will it
 *     contain backslashes. This buffer MUST be at least
 *     GUAC_COMMON_SSH_SFTP_MAX_PATH bytes in size.
 *
 * @param path
 *     The absolute path to normalize.
 *
 * @return
 *     Non-zero if normalization succeeded, zero otherwise.
 */
int guac_common_ssh_sftp_normalize_path(char* fullpath,
        const char* path);

#endif

