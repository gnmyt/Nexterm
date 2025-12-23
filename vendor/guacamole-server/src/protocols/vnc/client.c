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

#include "client.h"
#include "user.h"
#include "vnc.h"

#ifdef ENABLE_COMMON_SSH
#include "common-ssh/sftp.h"
#include "common-ssh/ssh.h"
#include "common-ssh/user.h"
#endif

#ifdef ENABLE_PULSE
#include "pulse/pulse.h"
#endif

#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/mem.h>
#include <guacamole/recording.h>

#include <pthread.h>
#include <stdlib.h>
#include <string.h>

#ifdef ENABLE_PULSE
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
static void* guac_vnc_sync_pending_user_audio(guac_user* user, void* data) {

    /* Add the user to the stream */
    guac_pa_stream* audio = (guac_pa_stream*) data;
    guac_pa_stream_add_user(audio, user);

    return NULL;

}
#endif

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
static int guac_vnc_join_pending_handler(guac_client* client) {

    guac_vnc_client* vnc_client = (guac_vnc_client*) client->data;
    guac_socket* broadcast_socket = client->pending_socket;

#ifdef ENABLE_PULSE
    /* Synchronize any audio stream for each pending user */
    if (vnc_client->audio)
        guac_client_foreach_pending_user(
            client, guac_vnc_sync_pending_user_audio, vnc_client->audio);
#endif

    /* Synchronize with current display */
    if (vnc_client->display != NULL) {
        guac_display_dup(vnc_client->display, broadcast_socket);
        guac_socket_flush(broadcast_socket);
    }

    return 0;

}

int guac_client_init(guac_client* client) {

    /* Set client args */
    client->args = GUAC_VNC_CLIENT_ARGS;

    /* Alloc client data */
    guac_vnc_client* vnc_client = guac_mem_zalloc(sizeof(guac_vnc_client));
    client->data = vnc_client;

#ifdef ENABLE_VNC_TLS_LOCKING
    /* Initialize the TLS write lock */
    pthread_mutex_init(&vnc_client->tls_lock, NULL);
#endif

    /* Initialize the message lock. */
    pthread_mutex_init(&(vnc_client->message_lock), NULL);

    /* Init clipboard */
    vnc_client->clipboard = guac_common_clipboard_alloc();

    /* Set handlers */
    client->join_handler = guac_vnc_user_join_handler;
    client->join_pending_handler = guac_vnc_join_pending_handler;
    client->leave_handler = guac_vnc_user_leave_handler;
    client->free_handler = guac_vnc_client_free_handler;

    return 0;
}

int guac_vnc_client_free_handler(guac_client* client) {

    guac_vnc_client* vnc_client = (guac_vnc_client*) client->data;
    guac_vnc_settings* settings = vnc_client->settings;

    /* Ensure all background rendering processes are stopped before freeing
     * underlying memory */
    if (vnc_client->display != NULL)
        guac_display_stop(vnc_client->display);

    /* Clean up VNC client*/
    rfbClient* rfb_client = vnc_client->rfb_client;
    if (rfb_client != NULL) {

        /* Wait for client thread to finish */
        pthread_join(vnc_client->client_thread, NULL);

        /* Free memory that may not be free'd by libvncclient's
         * rfbClientCleanup() prior to libvncclient 0.9.12 */

        if (rfb_client->frameBuffer != NULL) {
            free(rfb_client->frameBuffer);
            rfb_client->frameBuffer = NULL;
        }

        if (rfb_client->raw_buffer != NULL) {
            free(rfb_client->raw_buffer);
            rfb_client->raw_buffer = NULL;
        }

        if (rfb_client->rcSource != NULL) {
            free(rfb_client->rcSource);
            rfb_client->rcSource = NULL;
        }

        /* Free VNC rfbClientData linked list (may not be free'd by
         * rfbClientCleanup(), depending on libvncclient version) */

        while (rfb_client->clientData != NULL) {
            rfbClientData* next = rfb_client->clientData->next;
            free(rfb_client->clientData);
            rfb_client->clientData = next;
        }

        rfbClientCleanup(rfb_client);

    }

#ifdef ENABLE_COMMON_SSH
    /* Free SFTP filesystem, if loaded */
    if (vnc_client->sftp_filesystem)
        guac_common_ssh_destroy_sftp_filesystem(vnc_client->sftp_filesystem);

    /* Free SFTP session */
    if (vnc_client->sftp_session)
        guac_common_ssh_destroy_session(vnc_client->sftp_session);

    /* Free SFTP user */
    if (vnc_client->sftp_user)
        guac_common_ssh_destroy_user(vnc_client->sftp_user);

    guac_common_ssh_uninit();
#endif

    /* Clean up recording, if in progress */
    if (vnc_client->recording != NULL)
        guac_recording_free(vnc_client->recording);

    /* Free clipboard */
    if (vnc_client->clipboard != NULL)
        guac_common_clipboard_free(vnc_client->clipboard);

    /* Free display */
    if (vnc_client->display != NULL)
        guac_display_free(vnc_client->display);

#ifdef ENABLE_PULSE
    /* If audio enabled, stop streaming */
    if (vnc_client->audio)
        guac_pa_stream_free(vnc_client->audio);
#endif

    /* Free parsed settings */
    if (settings != NULL)
        guac_vnc_settings_free(settings);

#ifdef ENABLE_VNC_TLS_LOCKING
    /* Clean up TLS lock mutex. */
    pthread_mutex_destroy(&(vnc_client->tls_lock));
#endif

    /* Clean up the message lock. */
    pthread_mutex_destroy(&(vnc_client->message_lock));

    /* Free generic data struct */
    guac_mem_free(client->data);

    return 0;
}

