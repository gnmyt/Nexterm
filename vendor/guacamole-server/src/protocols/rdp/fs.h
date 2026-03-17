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

#ifndef GUAC_RDP_FS_H
#define GUAC_RDP_FS_H

/**
 * Functions and macros specific to filesystem handling and initialization
 * independent of RDP. The functions here may deal with the filesystem device
 * directly, but their semantics must not deal with RDP protocol messaging.
 * Functions here represent a virtual Windows-style filesystem on top of UNIX
 * system calls and structures, using the guac_rdp_fs structure as a home
 * for common data.
 *
 * @file fs.h 
 */

#include <guacamole/client.h>
#include <guacamole/object.h>
#include <guacamole/pool.h>
#include <guacamole/user.h>

#include <dirent.h>
#include <stdint.h>

/**
 * The maximum number of file IDs to provide.
 */
#define GUAC_RDP_FS_MAX_FILES 128

/**
 * The maximum number of bytes in a path string.
 */
#define GUAC_RDP_FS_MAX_PATH 4096

/**
 * The maximum number of directories a path may contain.
 */
#define GUAC_RDP_MAX_PATH_DEPTH 64

/**
 * Error code returned when no more file IDs can be allocated.
 */
#define GUAC_RDP_FS_ENFILE -1

/**
 * Error code returned when no such file exists.
 */
#define GUAC_RDP_FS_ENOENT -2

/**
 * Error code returned when the operation required a directory
 * but the file was not a directory.
 */
#define GUAC_RDP_FS_ENOTDIR -3

/**
 * Error code returned when insufficient space exists to complete
 * the operation.
 */
#define GUAC_RDP_FS_ENOSPC -4

/**
 * Error code returned when the operation requires a normal file but
 * a directory was given.
 */
#define GUAC_RDP_FS_EISDIR -5

/**
 * Error code returned when permission is denied.
 */
#define GUAC_RDP_FS_EACCES -6

/**
 * Error code returned when the operation cannot be completed because the
 * file already exists.
 */
#define GUAC_RDP_FS_EEXIST -7

/**
 * Error code returned when invalid parameters were given.
 */
#define GUAC_RDP_FS_EINVAL -8

/**
 * Error code returned when the operation is not implemented.
 */
#define GUAC_RDP_FS_ENOSYS -9

/**
 * Error code returned when the operation is not supported.
 */
#define GUAC_RDP_FS_ENOTSUP -10

/**
 * Converts a UNIX timestamp (seconds since Jan 1, 1970 UTC) to Windows
 * timestamp (100 nanosecond intervals since Jan 1, 1601 UTC).
 */
#define WINDOWS_TIME(t) ((t + ((uint64_t) 11644473600)) * 10000000)

/**
 * An arbitrary file on the virtual filesystem of the Guacamole drive.
 */
typedef struct guac_rdp_fs_file {

    /**
     * The ID of this file.
     */
    int id;

    /**
     * The absolute path, including filename, of this file.
     */
    char* absolute_path;

    /**
     * The real path of this file on the local filesystem.
     */
    char* real_path;

    /**
     * Associated local file descriptor.
     */
    int fd;

    /**
     * Associated directory stream, if any. This field only applies
     * if the file is being used as a directory.
     */
    DIR* dir;

    /**
     * The pattern the check directory contents against, if any.
     */
    char dir_pattern[GUAC_RDP_FS_MAX_PATH];

    /**
     * Bitwise OR of all associated Windows file attributes.
     */
    int attributes;

    /**
     * The size of this file, in bytes.
     */
    uint64_t size;

    /**
     * The time this file was created, as a Windows timestamp.
     */
    uint64_t ctime;

    /**
     * The time this file was last modified, as a Windows timestamp.
     */
    uint64_t mtime;

    /**
     * The time this file was last accessed, as a Windows timestamp.
     */
    uint64_t atime;

    /**
     * The number of bytes written to the file.
     */
    uint64_t bytes_written;

} guac_rdp_fs_file;

/**
 * A virtual filesystem implementing RDP-style operations.
 */
typedef struct guac_rdp_fs {

    /**
     * The Guacamole client associated with the RDP session.
     */
    guac_client* client;

    /**
     * The root of the filesystem.
     */
    char* drive_path;

    /**
     * The number of currently open files.
     */
    int open_files;

    /**
     * Pool of file IDs.
     */
    guac_pool* file_id_pool;

    /**
     * All available file structures.
     */
    guac_rdp_fs_file files[GUAC_RDP_FS_MAX_FILES];
    
    /**
     * If downloads from the remote server to the browser should be disabled.
     */
    int disable_download;
    
    /**
     * If uploads from the browser to the remote server should be disabled.
     */
    int disable_upload;

} guac_rdp_fs;

/**
 * Filesystem information structure.
 */
typedef struct guac_rdp_fs_info {

    /**
     * The number of free blocks available.
     */
    int blocks_available;

    /**
     * The number of blocks in the filesystem.
     */
    int blocks_total;

    /**
     * The number of bytes per block.
     */
    int block_size;

} guac_rdp_fs_info;

/**
 * Allocates a new filesystem given a root path. This filesystem will behave
 * as if it were a network drive.
 *
 * @param client
 *     The guac_client associated with the current RDP session.
 *
 * @param drive_path
 *     The local directory to use as the root directory of the emulated
 *     network drive.
 *
 * @param create_drive_path
 *     Non-zero if the drive path specified should be automatically created if
 *     it does not yet exist, zero otherwise.
 * 
 * @param disable_download
 *     Non-zero if downloads from the remote server to the local browser should
 *     be disabled.
 * 
 * @param disable_upload
 *     Non-zero if uploads from the browser to the remote server should be
 *     disabled.
 *
 * @return
 *     The newly-allocated filesystem.
 */
guac_rdp_fs* guac_rdp_fs_alloc(guac_client* client, const char* drive_path,
        int create_drive_path, int disable_download, int disable_upload);

/**
 * Frees the given filesystem.
 *
 * @param fs
 *     The filesystem to free.
 */
void guac_rdp_fs_free(guac_rdp_fs* fs);

/**
 * Creates and exposes a new filesystem guac_object to the given user,
 * providing access to the files within the given RDP filesystem. The
 * allocated guac_object must eventually be freed via guac_user_free_object().
 *
 * @param fs
 *     The RDP filesystem object to expose.
 *
 * @param user
 *     The user that the RDP filesystem should be exposed to.
 *
 * @return
 *     A new Guacamole filesystem object, configured to use RDP for uploading
 *     and downloading files.
 */
guac_object* guac_rdp_fs_alloc_object(guac_rdp_fs* fs, guac_user* user);

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
 *     A pointer to the guac_rdp_fs instance to expose to the given user, or
 *     NULL if nothing should be exposed.
 *
 * @return
 *     The guac_object allocated for the newly-exposed filesystem, or NULL if
 *     no filesystem object could be allocated.
 */
void* guac_rdp_fs_expose(guac_user* user, void* data);

/**
 * Converts the given relative path to an absolute path based on the given
 * parent path. If the path cannot be converted, non-zero is returned.
 *
 * @param parent
 *     The parent directory of the relative path.
 *
 * @param rel_path
 *     The relative path to convert.
 *
 * @return
 *     Zero if the path was converted successfully, non-zero otherwise.
 */
int guac_rdp_fs_convert_path(const char* parent, const char* rel_path,
        char* abs_path);

/**
 * Translates the given errno error code to a GUAC_RDP_FS error code.
 *
 * @param err
 *     The error code, as returned within errno by a system call.
 *
 * @return
 *     A GUAC_RDP_FS error code, such as GUAC_RDP_FS_ENFILE,
 *     GUAC_RDP_FS_ENOENT, etc.
 */
int guac_rdp_fs_get_errorcode(int err);

/**
 * Translates the given GUAC_RDP_FS error code to an RDPDR status code.
 *
 * @param err
 *     A GUAC_RDP_FS error code, such as GUAC_RDP_FS_ENFILE,
 *     GUAC_RDP_FS_ENOENT, etc.
 *
 * @return
 *     A status code corresponding to the given error code that an
 *     implementation of the RDPDR channel can understand.
 */
unsigned int guac_rdp_fs_get_status(int err);

/**
 * Opens the given file, returning the a new file ID, or an error code less
 * than zero if an error occurs. The given path MUST be absolute, and will be
 * translated to be relative to the drive path of the simulated filesystem.
 *
 * @param fs
 *     The filesystem to use when opening the file.
 *
 * @param path
 *     The absolute path to the file within the simulated filesystem.
 *
 * @param access
 *     A bitwise-OR of various RDPDR access flags, such as GENERIC_ALL or
 *     GENERIC_WRITE. This value will ultimately be translated to a standard
 *     O_RDWR, O_WRONLY, etc. value when opening the real file on the local
 *     filesystem.
 *
 * @param file_attributes
 *     The attributes to apply to the file, if created. This parameter is
 *     currently ignored, and has no effect.
 *
 * @param create_disposition
 *     Any one of several RDPDR file creation dispositions, such as
 *     FILE_CREATE, FILE_OPEN_IF, etc. The creation disposition dictates
 *     whether a new file should be created, whether the file can already
 *     exist, whether existing contents should be truncated, etc.
 *
 * @param create_options
 *     A bitwise-OR of various RDPDR options dictating how a file is to be
 *     created. Currently only one option is implemented, FILE_DIRECTORY_FILE,
 *     which specifies that the new file must be a directory.
 *
 * @return
 *     A new file ID, which will always be a positive value, or an error code
 *     if an error occurs. All error codes are negative values and correspond
 *     to GUAC_RDP_FS constants, such as GUAC_RDP_FS_ENOENT.
 */
int guac_rdp_fs_open(guac_rdp_fs* fs, const char* path,
        int access, int file_attributes, int create_disposition,
        int create_options);

/**
 * Reads up to the given length of bytes from the given offset within the
 * file having the given ID. Returns the number of bytes read, zero on EOF,
 * and an error code if an error occurs.
 *
 * @param fs
 *     The filesystem containing the file from which data is to be read.
 *
 * @param file_id
 *     The ID of the file to read data from, as returned by guac_rdp_fs_open().
 *
 * @param offset
 *     The byte offset within the file to start reading from.
 *
 * @param buffer
 *     The buffer to fill with data from the file.
 *
 * @param length
 *     The maximum number of bytes to read from the file.
 *
 * @return
 *     The number of bytes actually read, zero on EOF, or an error code if an
 *     error occurs. All error codes are negative values and correspond to
 *     GUAC_RDP_FS constants, such as GUAC_RDP_FS_ENOENT.
 */
int guac_rdp_fs_read(guac_rdp_fs* fs, int file_id, uint64_t offset,
        void* buffer, int length);

/**
 * Writes up to the given length of bytes from the given offset within the
 * file having the given ID. Returns the number of bytes written, and an
 * error code if an error occurs.
 *
 * @param fs
 *     The filesystem containing the file to which data is to be written.
 *
 * @param file_id
 *     The ID of the file to write data to, as returned by guac_rdp_fs_open().
 *
 * @param offset
 *     The byte offset within the file to start writing at.
 *
 * @param buffer
 *     The buffer containing the data to write.
 *
 * @param length
 *     The maximum number of bytes to write to the file.
 *
 * @return
 *     The number of bytes actually written, or an error code if an error
 *     occurs. All error codes are negative values and correspond to
 *     GUAC_RDP_FS constants, such as GUAC_RDP_FS_ENOENT.
 */
int guac_rdp_fs_write(guac_rdp_fs* fs, int file_id, uint64_t offset,
        void* buffer, int length);

/**
 * Renames (moves) the file with the given ID to the new path specified.
 * Returns zero on success, or an error code if an error occurs.
 *
 * @param fs
 *     The filesystem containing the file to rename.
 *
 * @param file_id
 *     The ID of the file to rename, as returned by guac_rdp_fs_open().
 *
 * @param new_path
 *     The absolute path to move the file to.
 *
 * @return
 *     Zero if the rename succeeded, or an error code if an error occurs. All
 *     error codes are negative values and correspond to GUAC_RDP_FS constants,
 *     such as GUAC_RDP_FS_ENOENT.
 */
int guac_rdp_fs_rename(guac_rdp_fs* fs, int file_id,
        const char* new_path);

/**
 * Deletes the file with the given ID.
 *
 * @param fs
 *     The filesystem containing the file to delete.
 *
 * @param file_id
 *     The ID of the file to delete, as returned by guac_rdp_fs_open().
 *
 * @return
 *     Zero if deletion succeeded, or an error code if an error occurs. All
 *     error codes are negative values and correspond to GUAC_RDP_FS constants,
 *     such as GUAC_RDP_FS_ENOENT.
 */
int guac_rdp_fs_delete(guac_rdp_fs* fs, int file_id);

/**
 * Truncates the file with the given ID to the given length (in bytes), which
 * may be larger.
 *
 * @param fs
 *     The filesystem containing the file to truncate.
 *
 * @param file_id
 *     The ID of the file to truncate, as returned by guac_rdp_fs_open().
 *
 * @param length
 *     The new length of the file, in bytes. Despite being named "truncate",
 *     this new length may be larger.
 *
 * @return
 *     Zero if truncation succeeded, or an error code if an error occurs. All
 *     error codes are negative values and correspond to GUAC_RDP_FS constants,
 *     such as GUAC_RDP_FS_ENOENT.
 */
int guac_rdp_fs_truncate(guac_rdp_fs* fs, int file_id, int length);

/**
 * Frees the given file ID, allowing future open operations to reuse it.
 *
 * @param fs
 *     The filesystem containing the file to close.
 *
 * @param file_id
 *     The ID of the file to close, as returned by guac_rdp_fs_open().
 */
void guac_rdp_fs_close(guac_rdp_fs* fs, int file_id);

/**
 * Given an arbitrary path, returns a pointer to the first character following
 * the last path separator in the path (the basename of the path). For example,
 * given "/foo/bar/baz" or "\foo\bar\baz", this function would return a pointer
 * to "baz".
 *
 * @param path
 *     The path to determine the basename of.
 *
 * @return
 *     A pointer to the first character of the basename within the path.
 */
const char* guac_rdp_fs_basename(const char* path);

/**
 * Given an arbitrary path, which may contain ".." and ".", creates an
 * absolute path which does NOT contain ".." or ".". The given path MUST
 * be absolute.
 *
 * @param path
 *     The absolute path to normalize.
 *
 * @param abs_path
 *     The buffer to populate with the normalized path. The normalized path
 *     will not contain relative path components like ".." or ".".
 *
 * @return
 *     Zero if normalization succeeded, non-zero otherwise.
 */
int guac_rdp_fs_normalize_path(const char* path, char* abs_path);

/**
 * Given a parent path and a relative path, produces a normalized absolute
 * path.
 *
 * @param parent 
 *     The absolute path of the parent directory of the relative path.
 *
 * @param rel_path
 *     The relative path to convert.
 *
 * @param abs_path
 *     The buffer to populate with the absolute, normalized path. The
 *     normalized path will not contain relative path components like ".." or
 *     ".".
 *
 * @return
 *     Zero if conversion succeeded, non-zero otherwise.
 */
int guac_rdp_fs_convert_path(const char* parent, const char* rel_path,
        char* abs_path);

/**
 * Returns the next filename within the directory having the given file ID,
 * or NULL if no more files.
 *
 * @param fs
 *     The filesystem containing the file to read directory entries from.
 *
 * @param file_id
 *     The ID of the file to read directory entries from, as returned by
 *     guac_rdp_fs_open().
 *
 * @return
 *     The name of the next filename within the directory, or NULL if the last
 *     file in the directory has already been returned by a previous call.
 */
const char* guac_rdp_fs_read_dir(guac_rdp_fs* fs, int file_id);

/**
 * Returns the file having the given ID, or NULL if no such file exists.
 *
 * @param fs
 *     The filesystem containing the desired file.
 *
 * @param file_id
 *     The ID of the desired, as returned by guac_rdp_fs_open().
 *
 * @return
 *     The file having the given ID, or NULL is no such file exists.
 */
guac_rdp_fs_file* guac_rdp_fs_get_file(guac_rdp_fs* fs, int file_id);

/**
 * Returns whether the given filename matches the given pattern. The pattern
 * given is a shell wildcard pattern as accepted by the POSIX fnmatch()
 * function. Backslashes will be interpreted as literal backslashes, not
 * escape characters.
 *
 * @param filename
 *     The filename to check
 *
 * @param pattern
 *     The pattern to check the filename against.
 *
 * @return
 *     Non-zero if the pattern matches, zero otherwise.
 */
int guac_rdp_fs_matches(const char* filename, const char* pattern);

/**
 * Populates the given structure with information about the filesystem,
 * particularly the amount of space available.
 *
 * @param fs
 *     The filesystem to obtain information from.
 *
 * @param info
 *     The guac_rdp_fs_info structure to populate.
 *
 * @return 
 *     Zero if information retrieval succeeded, or an error code if an error
 *     occurs. All error codes are negative values and correspond to
 *     GUAC_RDP_FS constants, such as GUAC_RDP_FS_ENOENT.
 */
int guac_rdp_fs_get_info(guac_rdp_fs* fs, guac_rdp_fs_info* info);

/**
 * Concatenates the given filename with the given path, separating the two
 * with a single forward slash. The full result must be no more than
 * GUAC_RDP_FS_MAX_PATH bytes long, counting null terminator.
 *
 * @param fullpath
 *     The buffer to store the result within. This buffer must be at least
 *     GUAC_RDP_FS_MAX_PATH bytes long.
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
int guac_rdp_fs_append_filename(char* fullpath, const char* path,
        const char* filename);

#endif

