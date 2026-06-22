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

#include "client.h"
#include "channels/audio-input/audio-buffer.h"
#include "channels/cliprdr.h"
#include "channels/disp.h"
#include "channels/pipe-svc.h"
#include "channels/rail.h"
#include "config.h"
#include "fs.h"
#include "log.h"
#include "rdp.h"
#include "settings.h"
#include "user.h"

#ifdef ENABLE_COMMON_SSH
#include "common-ssh/sftp.h"
#include "common-ssh/ssh.h"
#include "common-ssh/user.h"
#endif

#include <guacamole/argv.h>
#include <guacamole/audio.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/recording.h>
#include <guacamole/rwlock.h>

#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <pwd.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <unistd.h>

/**
 * Tests whether the given path refers to a directory which the current user
 * can write to. If the given path is not a directory, is not writable, or is
 * not a link pointing to a writable directory, this test will fail, and
 * errno will be set appropriately.
 *
 * @param path
 *     The path to test.
 *
 * @return
 *     Non-zero if the given path is (or points to) a writable directory, zero
 *     otherwise.
 */
static int is_writable_directory(const char* path) {

    /* Verify path is writable */
    if (faccessat(AT_FDCWD, path, W_OK, 0))
        return 0;

    /* If writable, verify path is actually a directory */
    DIR* dir = opendir(path);
    if (!dir)
        return 0;

    /* Path is both writable and a directory */
    closedir(dir);
    return 1;

}

/**
 * Add the provided user to the provided audio stream.
 *
 * @param user
 *    The pending user who should be added to the audio stream.
 *
 * @param data
 *    The audio stream that the user should be added to.
 *
 * @return
 *     Always NULL.
 */
static void* guac_rdp_sync_pending_user_audio(guac_user* user, void* data) {

    /* Add the user to the stream */
    guac_audio_stream* audio = (guac_audio_stream*) data;
    guac_audio_stream_add_user(audio, user);

    return NULL;

}

/**
 * A pending join handler implementation that will synchronize the connection
 * state for all pending users prior to them being promoted to full user.
 *
 * @param client
 *     The client whose pending users are about to be promoted.
 *
 * @return
 *     Always zero.
 */
static int guac_rdp_join_pending_handler(guac_client* client) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_socket* broadcast_socket = client->pending_socket;

    guac_rwlock_acquire_read_lock(&(rdp_client->lock));

    /* Synchronize any audio stream for each pending user */
    if (rdp_client->audio)
        guac_client_foreach_pending_user(
            client, guac_rdp_sync_pending_user_audio, rdp_client->audio);

    /* Bring user up to date with any registered static channels */
    guac_rdp_pipe_svc_send_pipes(client, broadcast_socket);

    /* Synchronize with current display */
    if (rdp_client->display != NULL) {
        guac_display_dup(rdp_client->display, broadcast_socket);
        guac_socket_flush(broadcast_socket);
    }

    guac_rwlock_release_lock(&(rdp_client->lock));

    return 0;

}

int guac_client_init(guac_client* client, int argc, char** argv) {

    /* Automatically set HOME environment variable if unset (FreeRDP's
     * initialization process will fail within freerdp_settings_new() if this
     * is unset) */
    const char* current_home = getenv("HOME");
    if (current_home == NULL) {

        /* Warn if the correct home directory cannot be determined */
        struct passwd* passwd = getpwuid(getuid());
        if (passwd == NULL)
            guac_client_log(client, GUAC_LOG_WARNING, "FreeRDP initialization "
                    "may fail: The \"HOME\" environment variable is unset and "
                    "its correct value could not be automatically determined: "
                    "%s", strerror(errno));

        /* Warn if the correct home directory could be determined but can't be
         * assigned */
        else if (setenv("HOME", passwd->pw_dir, 1))
            guac_client_log(client, GUAC_LOG_WARNING, "FreeRDP initialization "
                    "may fail: The \"HOME\" environment variable is unset "
                    "and its correct value (detected as \"%s\") could not be "
                    "assigned: %s", passwd->pw_dir, strerror(errno));

        /* HOME has been successfully set */
        else {
            guac_client_log(client, GUAC_LOG_DEBUG, "\"HOME\" "
                    "environment variable was unset and has been "
                    "automatically set to \"%s\"", passwd->pw_dir);
            current_home = passwd->pw_dir;
        }

    }

    /* Verify that detected home directory is actually writable and actually a
     * directory, as FreeRDP initialization will mysteriously fail otherwise */
    if (current_home != NULL && !is_writable_directory(current_home)) {
        if (errno == EACCES)
            guac_client_log(client, GUAC_LOG_WARNING, "FreeRDP initialization "
                    "may fail: The current user's home directory (\"%s\") is "
                    "not writable, but FreeRDP generally requires a writable "
                    "home directory for storage of configuration files and "
                    "certificates.", current_home);
        else if (errno == ENOTDIR)
            guac_client_log(client, GUAC_LOG_WARNING, "FreeRDP initialization "
                    "may fail: The current user's home directory (\"%s\") is "
                    "not actually a directory, but FreeRDP generally requires "
                    "a writable home directory for storage of configuration "
                    "files and certificates.", current_home);
        else
            guac_client_log(client, GUAC_LOG_WARNING, "FreeRDP initialization "
                    "may fail: Writability of the current user's home "
                    "directory (\"%s\") could not be determined: %s",
                    current_home, strerror(errno));
    }

    /* Set client args */
    client->args = GUAC_RDP_CLIENT_ARGS;

    /* Alloc client data */
    guac_rdp_client* rdp_client = guac_mem_zalloc(sizeof(guac_rdp_client));
    client->data = rdp_client;

    /* Create queue for input events (to avoid RDP I/O blocking processing of
     * further Guacamole instructions) and associated signalling handle */
    guac_fifo_init(&rdp_client->input_events, &rdp_client->input_events_items,
            GUAC_RDP_INPUT_EVENT_QUEUE_SIZE, sizeof(guac_rdp_input_event));

    rdp_client->input_event_queued = CreateEvent(NULL, TRUE, FALSE, NULL);

    /* Init clipboard */
    rdp_client->clipboard = guac_rdp_clipboard_alloc(client);

    /* Init display update module */
    rdp_client->disp = guac_rdp_disp_alloc(client);

    /* Init multi-touch support module (RDPEI) */
    rdp_client->rdpei = guac_rdp_rdpei_alloc(client);

    /* Redirect FreeRDP log messages to guac_client_log() */
    guac_rdp_redirect_wlog(client);

    /* Recursive attribute for locks */
    pthread_mutexattr_init(&(rdp_client->attributes));
    pthread_mutexattr_settype(&(rdp_client->attributes),
            PTHREAD_MUTEX_RECURSIVE);

    /* Init required locks */
    guac_rwlock_init(&(rdp_client->lock));
    pthread_mutex_init(&(rdp_client->message_lock), &(rdp_client->attributes));

    /* Set handlers */
    client->join_handler = guac_rdp_user_join_handler;
    client->join_pending_handler = guac_rdp_join_pending_handler;
    client->free_handler = guac_rdp_client_free_handler;
    client->leave_handler = guac_rdp_user_leave_handler;

#ifdef ENABLE_COMMON_SSH
    guac_common_ssh_init(client);
#endif

    return 0;

}

int guac_rdp_client_free_handler(guac_client* client) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;

    /*
     * Signals any threads that are blocked awaiting user input for authentication
     * (e.g., username or password) to terminate their wait. By broadcasting a
     * condition signal, the authentication process is interrupted, allowing for
     * premature termination and cleanup during client disconnection.
     */
    guac_argv_stop();

    /* Wait for client thread */
    pthread_join(rdp_client->client_thread, NULL);

    /* Clean up event queue and associated signalling handle */
    guac_fifo_destroy(&rdp_client->input_events);
    CloseHandle(rdp_client->input_event_queued);

    /* Free parsed settings */
    if (rdp_client->settings != NULL)
        guac_rdp_settings_free(rdp_client->settings);

    /* Clean up clipboard */
    guac_rdp_clipboard_free(rdp_client->clipboard);

    /* Free display update module */
    guac_rdp_disp_free(rdp_client->disp);

    /* Free multi-touch support module (RDPEI) */
    guac_rdp_rdpei_free(rdp_client->rdpei);

    /* Clean up filesystem, if allocated */
    if (rdp_client->filesystem != NULL)
        guac_rdp_fs_free(rdp_client->filesystem);

    /* End active print job, if any */
    guac_rdp_print_job* job = (guac_rdp_print_job*) rdp_client->active_job;
    if (job != NULL) {
        guac_rdp_print_job_kill(job);
        guac_rdp_print_job_free(job);
        rdp_client->active_job = NULL;
    }

#ifdef ENABLE_COMMON_SSH
    /* Free SFTP filesystem, if loaded */
    if (rdp_client->sftp_filesystem)
        guac_common_ssh_destroy_sftp_filesystem(rdp_client->sftp_filesystem);

    /* Free SFTP session */
    if (rdp_client->sftp_session)
        guac_common_ssh_destroy_session(rdp_client->sftp_session);

    /* Free SFTP user */
    if (rdp_client->sftp_user)
        guac_common_ssh_destroy_user(rdp_client->sftp_user);

    guac_common_ssh_uninit();
#endif

    /* Clean up recording, if in progress */
    if (rdp_client->recording != NULL)
        guac_recording_free(rdp_client->recording);

    /* Clean up audio stream, if allocated */
    if (rdp_client->audio != NULL)
        guac_audio_stream_free(rdp_client->audio);

    /* Clean up audio input buffer, if allocated */
    if (rdp_client->audio_input != NULL)
        guac_rdp_audio_buffer_free(rdp_client->audio_input);

    guac_rwlock_destroy(&(rdp_client->lock));
    pthread_mutex_destroy(&(rdp_client->message_lock));

    /* Free client data */
    guac_mem_free(rdp_client);

    return 0;

}
