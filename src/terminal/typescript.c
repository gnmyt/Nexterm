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

#include "common/io.h"
#include "terminal/typescript.h"

#include <guacamole/mem.h>
#include <guacamole/timestamp.h>

#include <errno.h>
#include <stdlib.h>
#include <stdio.h>
#include <unistd.h>

#include <sys/types.h>
#include <sys/stat.h>
#include <fcntl.h>

/**
 * Attempts to open a typescript data file within the given path and having
 * the given name. If such a file already exists and allow_write_existing is
 * zero, sequential numeric suffixes (.1, .2, .3, etc.) are appended until a
 * filename is found which does not exist (or until the maximum number of
 * numeric suffixes has been tried). If the file absolutely cannot be opened
 * due to an error, -1 is returned and errno is set appropriately.
 *
 * @param path
 *     The full path to the directory in which the data file should be created.
 *
 * @param name
 *     The name of the data file which should be crated within the given path.
 *
 * @param basename
 *     A buffer in which the path, a path separator, the filename, any
 *     necessary suffix, and a NULL terminator will be stored. If insufficient
 *     space is available, -1 will be returned, and errno will be set to
 *     ENAMETOOLONG.
 *
 * @param basename_size
 *     The number of bytes available within the provided basename buffer.
 *
 * @param allow_write_existing
 *     Non-zero if writing to an existing file should be allowed, or zero
 *     otherwise.
 *
 * @return
 *     The file descriptor of the open data file if open succeeded, or -1 on
 *     failure.
 */
static int guac_terminal_typescript_open_data_file(const char* path,
        const char* name, char* basename, int basename_size,
        int allow_write_existing) {

    int i;

    /* Concatenate path and name (separated by a single slash) */
    int basename_length = snprintf(basename,
            basename_size - GUAC_TERMINAL_TYPESCRIPT_MAX_SUFFIX_LENGTH,
            "%s/%s", path, name);

    /* Abort if maximum length reached */
    if (basename_length ==
            basename_size - GUAC_TERMINAL_TYPESCRIPT_MAX_SUFFIX_LENGTH) {
        errno = ENAMETOOLONG;
        return -1;
    }

    /* Require the file not exist already if allow_write_existing not set */
    int file_flags = O_CREAT | O_WRONLY | (allow_write_existing ? 0 : O_EXCL);

    /* Attempt to open typescript data file */
    int data_fd = open(basename, file_flags, S_IRUSR | S_IWUSR | S_IRGRP);

    /* Continuously retry with alternate names on failure */
    if (data_fd == -1) {

        /* Prepare basename for additional suffix */
        basename[basename_length] = '.';
        char* suffix = &(basename[basename_length + 1]);

        /* Continue retrying alternative suffixes if file already exists */
        for (i = 1; data_fd == -1 && errno == EEXIST
                && i <= GUAC_TERMINAL_TYPESCRIPT_MAX_SUFFIX; i++) {

            /* Append new suffix */
            sprintf(suffix, "%i", i);

            /* Retry with newly-suffixed filename */
            data_fd = open(basename, file_flags, S_IRUSR | S_IWUSR | S_IRGRP);

        }

    }

    return data_fd;

}

guac_terminal_typescript* guac_terminal_typescript_alloc(const char* path,
        const char* name, int create_path, int allow_write_existing) {

    /* Create path if it does not exist, fail if impossible */
    if (create_path && mkdir(path, S_IRWXU | S_IRGRP | S_IXGRP)
            && errno != EEXIST)
        return NULL;

    /* Allocate space for new typescript */
    guac_terminal_typescript* typescript =
        guac_mem_alloc(sizeof(guac_terminal_typescript));

    /* Attempt to open typescript data file */
    typescript->data_fd = guac_terminal_typescript_open_data_file(
            path, name, typescript->data_filename,
            sizeof(typescript->data_filename)
                - sizeof(GUAC_TERMINAL_TYPESCRIPT_TIMING_SUFFIX),
            allow_write_existing);
    if (typescript->data_fd == -1) {
        guac_mem_free(typescript);
        return NULL;
    }

    /* Append suffix to basename */
    if (snprintf(typescript->timing_filename, sizeof(typescript->timing_filename),
                "%s.%s", typescript->data_filename, GUAC_TERMINAL_TYPESCRIPT_TIMING_SUFFIX)
            >= sizeof(typescript->timing_filename)) {
        close(typescript->data_fd);
        guac_mem_free(typescript);
        return NULL;
    }

    /* Require the file not exist already if allow_write_existing not set */
    int file_flags = O_CREAT | O_WRONLY | (allow_write_existing ? 0 : O_EXCL);

    /* Attempt to open typescript timing file */
    typescript->timing_fd = open(typescript->timing_filename,
            file_flags, S_IRUSR | S_IWUSR | S_IRGRP);
    if (typescript->timing_fd == -1) {
        close(typescript->data_fd);
        guac_mem_free(typescript);
        return NULL;
    }

    /* Typescript starts out flushed */
    typescript->length = 0;
    typescript->last_flush = guac_timestamp_current();

    /* Write header */
    guac_common_write(typescript->data_fd, GUAC_TERMINAL_TYPESCRIPT_HEADER,
            sizeof(GUAC_TERMINAL_TYPESCRIPT_HEADER) - 1);

    return typescript;

}

void guac_terminal_typescript_write(guac_terminal_typescript* typescript,
        char c) {

    /* Flush buffer if no space is available */
    if (typescript->length == sizeof(typescript->buffer))
        guac_terminal_typescript_flush(typescript);

    /* Append single byte to buffer */
    typescript->buffer[typescript->length++] = c;

}

void guac_terminal_typescript_flush(guac_terminal_typescript* typescript) {

    /* Do nothing if nothing to flush */
    if (typescript->length == 0)
        return;

    /* Get timestamps of previous and current flush */
    guac_timestamp this_flush = guac_timestamp_current();
    guac_timestamp last_flush = typescript->last_flush;

    /* Calculate time since last flush */
    int elapsed_time = this_flush - last_flush;
    if (elapsed_time > GUAC_TERMINAL_TYPESCRIPT_MAX_DELAY)
        elapsed_time = GUAC_TERMINAL_TYPESCRIPT_MAX_DELAY;

    /* Produce single line of timestamp output */
    char timestamp_buffer[32];
    int timestamp_length = snprintf(timestamp_buffer, sizeof(timestamp_buffer),
            "%0.6f %i\n", elapsed_time / 1000.0, typescript->length);

    /* Calculate actual length of timestamp line */
    if (timestamp_length > sizeof(timestamp_buffer))
        timestamp_length = sizeof(timestamp_buffer);

    /* Write timestamp to timing file */
    guac_common_write(typescript->timing_fd,
            timestamp_buffer, timestamp_length);

    /* Empty buffer into data file */
    guac_common_write(typescript->data_fd,
            typescript->buffer, typescript->length);

    /* Buffer is now flushed */
    typescript->length = 0;
    typescript->last_flush = this_flush;

}

void guac_terminal_typescript_free(guac_terminal_typescript* typescript) {

    /* Do nothing if no typescript provided */
    if (typescript == NULL)
        return;

    /* Flush any pending data */
    guac_terminal_typescript_flush(typescript);

    /* Write footer */
    guac_common_write(typescript->data_fd, GUAC_TERMINAL_TYPESCRIPT_FOOTER,
            sizeof(GUAC_TERMINAL_TYPESCRIPT_FOOTER) - 1);

    /* Close file descriptors */
    close(typescript->data_fd);
    close(typescript->timing_fd);

    /* Free allocated typescript data */
    guac_mem_free(typescript);

}

