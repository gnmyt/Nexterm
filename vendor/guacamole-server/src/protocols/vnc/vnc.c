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

#include "auth.h"
#include "client.h"
#include "clipboard.h"
#include "common/clipboard.h"
#include "cursor.h"
#include "display.h"
#include "log.h"
#include "settings.h"
#include "vnc.h"

#ifdef ENABLE_PULSE
#include "pulse/pulse.h"
#endif

#ifdef ENABLE_COMMON_SSH
#include "common-ssh/sftp.h"
#include "common-ssh/ssh.h"
#include "sftp.h"
#endif

#include <guacamole/client.h>
#include <guacamole/display.h>
#include <guacamole/mem.h>
#include <guacamole/protocol.h>
#include <guacamole/recording.h>
#include <guacamole/socket.h>
#include <guacamole/string.h>
#include <guacamole/timestamp.h>
#include <guacamole/wol-constants.h>
#include <guacamole/wol.h>
#include <rfb/rfbclient.h>
#include <rfb/rfbconfig.h>
#include <rfb/rfbproto.h>

#ifdef LIBVNCSERVER_WITH_CLIENT_GCRYPT
#include <errno.h>
#include <gcrypt.h>
#endif

#include <stdlib.h>
#include <string.h>
#include <time.h>

#ifdef LIBVNCSERVER_WITH_CLIENT_GCRYPT
GCRY_THREAD_OPTION_PTHREAD_IMPL;
#endif

char* GUAC_VNC_CLIENT_KEY = "GUAC_VNC";

#ifdef ENABLE_VNC_TLS_LOCKING
/**
 * A callback function that is called by the VNC library prior to writing
 * data to a TLS-encrypted socket.  This returns the rfbBool FALSE value
 * if there's an error locking the mutex, or rfbBool TRUE otherwise.
 * 
 * @param rfb_client
 *     The rfbClient for which to lock the TLS mutex.
 *
 * @returns
 *     rfbBool FALSE if an error occurs locking the mutex, otherwise
 *     TRUE.
 */
static rfbBool guac_vnc_lock_write_to_tls(rfbClient* rfb_client) {

    /* Retrieve the Guacamole data structures */
    guac_client* gc = rfbClientGetClientData(rfb_client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = (guac_vnc_client*) gc->data;

    /* Lock write access */
    int retval = pthread_mutex_lock(&(vnc_client->tls_lock));
    if (retval) {
        guac_client_log(gc, GUAC_LOG_ERROR, "Error locking TLS write mutex: %s",
                strerror(retval));
        return FALSE;
    }
    return TRUE;

}

/**
 * A callback function for use by the VNC library that is called once
 * the client is finished writing to a TLS-encrypted socket. A rfbBool
 * FALSE value is returned if an error occurs unlocking the mutex,
 * otherwise TRUE is returned.
 *
 * @param rfb_client
 *     The rfbClient for which to unlock the TLS mutex.
 *
 * @returns
 *     rfbBool FALSE if an error occurs unlocking the mutex, otherwise
 *     TRUE.
 */
static rfbBool guac_vnc_unlock_write_to_tls(rfbClient* rfb_client) {

    /* Retrieve the Guacamole data structures */
    guac_client* gc = rfbClientGetClientData(rfb_client, GUAC_VNC_CLIENT_KEY);
    guac_vnc_client* vnc_client = (guac_vnc_client*) gc->data;

    /* Unlock write access */
    int retval = pthread_mutex_unlock(&(vnc_client->tls_lock));
    if (retval) {
        guac_client_log(gc, GUAC_LOG_ERROR, "Error unlocking TLS write mutex: %s",
                strerror(retval));
        return FALSE;
    }
    return TRUE;
}
#endif

rfbClient* guac_vnc_get_client(guac_client* client) {

    rfbClient* rfb_client = rfbGetClient(8, 3, 4); /* 32-bpp client */
    guac_vnc_client* vnc_client = (guac_vnc_client*) client->data;
    guac_vnc_settings* vnc_settings = vnc_client->settings;

    /* Store Guac client in rfb client */
    rfbClientSetClientData(rfb_client, GUAC_VNC_CLIENT_KEY, client);

    /* Framebuffer update handler */
    rfb_client->GotFrameBufferUpdate = guac_vnc_update;
    vnc_client->rfb_GotCopyRect = rfb_client->GotCopyRect;
    rfb_client->GotCopyRect = guac_vnc_copyrect;

#ifdef ENABLE_VNC_TLS_LOCKING
    /* TLS Locking and Unlocking */
    rfb_client->LockWriteToTLS = guac_vnc_lock_write_to_tls;
    rfb_client->UnlockWriteToTLS = guac_vnc_unlock_write_to_tls;
#endif
    
#ifdef LIBVNCSERVER_WITH_CLIENT_GCRYPT
    
    /* Check if GCrypt is initialized, do it if not. */
    if (!gcry_control(GCRYCTL_INITIALIZATION_FINISHED_P)) {
    
        guac_client_log(client, GUAC_LOG_DEBUG, "GCrypt initialization started.");

        /* Initialize thread control. */
        gcry_control(GCRYCTL_SET_THREAD_CBS, &gcry_threads_pthread);

        /* Basic GCrypt library initialization. */
        gcry_check_version(NULL);

        /* Mark initialization as completed. */
        gcry_control(GCRYCTL_INITIALIZATION_FINISHED, 0);
        guac_client_log(client, GUAC_LOG_DEBUG, "GCrypt initialization completed.");
    
    }
    
#endif

    /* Do not handle clipboard and local cursor if read-only */
    if (vnc_settings->read_only == 0) {

        /* Clipboard */
        rfb_client->GotXCutText = guac_vnc_cut_text;

        /* Set remote cursor */
        if (vnc_settings->remote_cursor) {
            rfb_client->appData.useRemoteCursor = FALSE;
        }

        else {
            /* Enable client-side cursor */
            rfb_client->appData.useRemoteCursor = TRUE;
            rfb_client->GotCursorShape = guac_vnc_cursor;
        }

    }

#ifdef ENABLE_VNC_GENERIC_CREDENTIALS
    /* Authentication */
    rfb_client->GetCredential = guac_vnc_get_credentials;
#endif
    
    /* Password */
    rfb_client->GetPassword = guac_vnc_get_password;

    /* Depth */
    guac_vnc_set_pixel_format(rfb_client, vnc_settings->color_depth);

    /* Hook into allocation so we can handle resize. */
    vnc_client->rfb_MallocFrameBuffer = rfb_client->MallocFrameBuffer;
    rfb_client->MallocFrameBuffer = guac_vnc_malloc_framebuffer;
    rfb_client->canHandleNewFBSize = 1;

    /* Set hostname and port */
    rfb_client->serverHost = strdup(vnc_settings->hostname);
    rfb_client->serverPort = vnc_settings->port;

#ifdef ENABLE_VNC_REPEATER
    /* Set repeater parameters if specified */
    if (vnc_settings->dest_host) {
        rfb_client->destHost = strdup(vnc_settings->dest_host);
        rfb_client->destPort = vnc_settings->dest_port;
    }
#endif

#ifdef ENABLE_VNC_LISTEN
    /* If reverse connection enabled, start listening */
    if (vnc_settings->reverse_connect) {

        guac_client_log(client, GUAC_LOG_INFO, "Listening for connections on port %i", vnc_settings->port);

        /* Listen for connection from server */
        rfb_client->listenPort = vnc_settings->port;
        if (listenForIncomingConnectionsNoFork(rfb_client, vnc_settings->listen_timeout*1000) <= 0)
            return NULL;

    }
#endif

    /* Set encodings if provided */
    if (vnc_settings->encodings)
        rfb_client->appData.encodingsString = strdup(vnc_settings->encodings);

    /* Connect */
    if (rfbInitClient(rfb_client, NULL, NULL))
        return rfb_client;

    /* If connection fails, return NULL */
    return NULL;

}

/**
 * Waits until data is available to be read from the given rfbClient, and thus
 * a call to HandleRFBServerMessages() should not block. If the timeout elapses
 * before data is available, zero is returned.
 *
 * @param rfb_client
 *     The rfbClient to wait for.
 *
 * @param timeout
 *     The maximum amount of time to wait, in milliseconds.
 *
 * @returns
 *     A positive value if data is available, zero if the timeout elapses
 *     before data becomes available, or a negative value on error.
 */
static int guac_vnc_wait_for_messages(rfbClient* rfb_client, int msec_timeout) {

    /* Do not explicitly wait while data is on the buffer */
    if (rfb_client->buffered)
        return 1;

    /* If no data on buffer, wait for data on socket */
    return WaitForMessage(rfb_client, msec_timeout * 1000);

}

/**
 * Handles any inbound VNC messages that have been received, updating the
 * Guacamole display accordingly.
 *
 * @param vnc_client
 *     The guac_vnc_client of the VNC connection whose current messages should
 *     be handled.
 *
 * @return
 *     True (non-zero) if messages were handled successfully, false (zero)
 *     otherwise.
 */
static rfbBool guac_vnc_handle_messages(guac_client* client) {

    guac_vnc_client* vnc_client = (guac_vnc_client*) client->data;
    rfbClient* rfb_client = vnc_client->rfb_client;
    guac_display_layer* default_layer = guac_display_default_layer(vnc_client->display);

    /* All potential drawing operations must occur while holding an open context */
    guac_display_layer_raw_context* context = guac_display_layer_open_raw(default_layer);
    vnc_client->current_context = context;

    /* Actually handle messages (this may result in drawing to the
     * guac_display, resizing the display buffer, etc.) */
    rfbBool retval = HandleRFBServerMessage(rfb_client);

    /* Use the buffer of libvncclient directly if it matches the guac_display
     * format */
    unsigned int vnc_bpp = rfb_client->format.bitsPerPixel / 8;
    if (vnc_bpp == GUAC_DISPLAY_LAYER_RAW_BPP && !vnc_client->settings->swap_red_blue) {

        context->buffer = rfb_client->frameBuffer;
        context->stride = guac_mem_ckd_mul_or_die(vnc_bpp, rfb_client->width);

        /* Update bounds of pending frame to match those of RFB framebuffer */
        guac_rect_init(&context->bounds, 0, 0, rfb_client->width, rfb_client->height);

    }

    /* There will be no further drawing operations */
    guac_display_layer_close_raw(default_layer, context);
    vnc_client->current_context = NULL;

#ifdef LIBVNC_HAS_RESIZE_SUPPORT
    // If screen was not previously initialized, check for it and set it.
    if (!vnc_client->rfb_screen_initialized 
            && rfb_client->screen.width > 0
            && rfb_client->screen.height > 0) {
        vnc_client->rfb_screen_initialized = true;
        guac_client_log(client, GUAC_LOG_DEBUG, "Screen is now initialized.");
    }

    /*
     * If the screen is now or has been initialized, check to see if the initial
     * dimensions have already been sent. If not, and resize is not disabled,
     * send the initial size.
     */
    if (vnc_client->rfb_screen_initialized) {
        guac_vnc_settings* settings = vnc_client->settings;
        if (!vnc_client->rfb_initial_resize && !settings->disable_display_resize) {
            guac_client_log(client, GUAC_LOG_DEBUG,
                    "Sending initial screen size to VNC server.");
            guac_client_for_owner(client, guac_vnc_display_set_owner_size, rfb_client);
            vnc_client->rfb_initial_resize = true;
        }
    }
#endif // LIBVNC_HAS_RESIZE_SUPPORT

    /* Resize the surface if VNC screen size has changed (this call
     * automatically deals with invalid dimensions and is a no-op
     * if the size has not changed) */
    guac_display_layer_resize(default_layer, rfb_client->width, rfb_client->height);

    return retval;

}

void* guac_vnc_client_thread(void* data) {

    guac_client* client = (guac_client*) data;
    guac_vnc_client* vnc_client = (guac_vnc_client*) client->data;
    guac_vnc_settings* settings = vnc_client->settings;

    /* If Wake-on-LAN is enabled, attempt to wake. */
    if (settings->wol_send_packet) {

        /**
         * If wait time is set, send the wake packet and try to connect to the
         * server, failing if the server does not respond.
         */
        if (settings->wol_wait_time > 0) {
            guac_client_log(client, GUAC_LOG_DEBUG, "Sending Wake-on-LAN packet, "
                    "and pausing for %d seconds.", settings->wol_wait_time);

            /* char representation of a port should be, at most, 5 characters plus terminator. */
            char* str_port = guac_mem_alloc(6);
            if (guac_itoa(str_port, settings->port) < 1) {
                guac_client_log(client, GUAC_LOG_ERROR, "Failed to convert port to integer for WOL function.");
                guac_mem_free(str_port);
                return NULL;
            }

            /* Send the Wake-on-LAN request and wait until the server is responsive. */
            if (guac_wol_wake_and_wait(settings->wol_mac_addr,
                    settings->wol_broadcast_addr,
                    settings->wol_udp_port,
                    settings->wol_wait_time,
                    GUAC_WOL_DEFAULT_CONNECT_RETRIES,
                    settings->hostname,
                    (const char *) str_port,
                    GUAC_WOL_DEFAULT_CONNECTION_TIMEOUT)) {
                guac_client_log(client, GUAC_LOG_ERROR, "Failed to send WOL packet or connect to remote system.");
                guac_mem_free(str_port);
                return NULL;
            }

            guac_mem_free(str_port);

        }

        /* Just send the packet and continue the connection, or return if failed. */
        else if(guac_wol_wake(settings->wol_mac_addr,
                    settings->wol_broadcast_addr,
                    settings->wol_udp_port)) {
            guac_client_log(client, GUAC_LOG_ERROR, "Failed to send WOL packet.");
            return NULL;
        }
    }
    
    /* Configure clipboard encoding */
    if (guac_vnc_set_clipboard_encoding(client, settings->clipboard_encoding)) {
        guac_client_log(client, GUAC_LOG_INFO, "Using non-standard VNC "
                "clipboard encoding: '%s'.", settings->clipboard_encoding);
    }

    /* Set up libvncclient logging */
    rfbClientLog = guac_vnc_client_log_info;
    rfbClientErr = guac_vnc_client_log_error;

    /* Attempt connection */
    rfbClient* rfb_client = guac_vnc_get_client(client);
    int retries_remaining = settings->retries;

    /* If unsuccessful, retry as many times as specified */
    while (!rfb_client && retries_remaining > 0) {

        guac_client_log(client, GUAC_LOG_INFO,
                "Connect failed. Waiting %ims before retrying...",
                GUAC_VNC_CONNECT_INTERVAL);

        /* Wait for given interval then retry */
        guac_timestamp_msleep(GUAC_VNC_CONNECT_INTERVAL);
        rfb_client = guac_vnc_get_client(client);
        retries_remaining--;

    }

    /* If the final connect attempt fails, return error */
    if (!rfb_client) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_UPSTREAM_NOT_FOUND,
                "Unable to connect to VNC server.");
        return NULL;
    }

#ifdef ENABLE_PULSE
    /* If audio is enabled, start streaming via PulseAudio */
    if (settings->audio_enabled)
        vnc_client->audio = guac_pa_stream_alloc(client, 
                settings->pa_servername);
#endif

#ifdef ENABLE_COMMON_SSH
    guac_common_ssh_init(client);

    /* Connect via SSH if SFTP is enabled */
    if (settings->enable_sftp) {

        /* Abort if username is missing */
        if (settings->sftp_username == NULL) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "SFTP username is required if SFTP is enabled.");
            return NULL;
        }

        guac_client_log(client, GUAC_LOG_DEBUG,
                "Connecting via SSH for SFTP filesystem access.");

        vnc_client->sftp_user =
            guac_common_ssh_create_user(settings->sftp_username);

        /* Import private key, if given */
        if (settings->sftp_private_key != NULL) {

            guac_client_log(client, GUAC_LOG_DEBUG,
                    "Authenticating with private key.");

            /* Abort if private key cannot be read */
            if (guac_common_ssh_user_import_key(vnc_client->sftp_user,
                        settings->sftp_private_key,
                        settings->sftp_passphrase)) {
                guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                        "Private key unreadable.");
                return NULL;
            }

            /* Import the public key, if that is specified. */
            if (settings->sftp_public_key != NULL) {

                guac_client_log(client, GUAC_LOG_DEBUG,
                        "Attempting public key import");

                /* Attempt to read public key */
                if (guac_common_ssh_user_import_public_key(vnc_client->sftp_user,
                            settings->sftp_public_key)) {

                    /* Public key import fails. */
                    guac_client_abort(client,
                           GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                           "Failed to import public key: %s",
                            guac_common_ssh_key_error());

                    guac_common_ssh_destroy_user(vnc_client->sftp_user);
                    return NULL;

                }

                /* Success */
                guac_client_log(client, GUAC_LOG_INFO,
                        "Public key successfully imported.");

            }

        }

        /* Otherwise, use specified password */
        else {
            guac_client_log(client, GUAC_LOG_DEBUG,
                    "Authenticating with password.");
            guac_common_ssh_user_set_password(vnc_client->sftp_user,
                    settings->sftp_password);
        }

        /* Attempt SSH connection */
        vnc_client->sftp_session =
            guac_common_ssh_create_session(client, settings->sftp_hostname,
                    settings->sftp_port, vnc_client->sftp_user, settings->sftp_timeout,
                    settings->sftp_server_alive_interval, settings->sftp_host_key, NULL);

        /* Fail if SSH connection does not succeed */
        if (vnc_client->sftp_session == NULL) {
            /* Already aborted within guac_common_ssh_create_session() */
            return NULL;
        }

        /* Load filesystem */
        vnc_client->sftp_filesystem =
            guac_common_ssh_create_sftp_filesystem(vnc_client->sftp_session,
                    settings->sftp_root_directory, NULL,
                    settings->sftp_disable_download,
                    settings->sftp_disable_upload);

        /* Expose filesystem to connection owner */
        guac_client_for_owner(client,
                guac_common_ssh_expose_sftp_filesystem,
                vnc_client->sftp_filesystem);

        /* Abort if SFTP connection fails */
        if (vnc_client->sftp_filesystem == NULL) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR,
                    "SFTP connection failed.");
            return NULL;
        }

        /* Configure destination for basic uploads, if specified */
        if (settings->sftp_directory != NULL)
            guac_common_ssh_sftp_set_upload_path(
                    vnc_client->sftp_filesystem,
                    settings->sftp_directory);

        guac_client_log(client, GUAC_LOG_DEBUG,
                "SFTP connection succeeded.");

    }
#endif

    /* Disable remote console (Server input) */
    if (settings->disable_server_input) {
        rfbSetServerInputMsg msg;
        msg.type = rfbSetServerInput;
        msg.status = 1;
        msg.pad = 0;

        /* Acquire lock for writing to server. */
        pthread_mutex_lock(&(vnc_client->message_lock));

        if (WriteToRFBServer(rfb_client, (char*)&msg, sz_rfbSetServerInputMsg))
            guac_client_log(client, GUAC_LOG_DEBUG, "Successfully sent request to disable server input.");

        else
            guac_client_log(client, GUAC_LOG_WARNING, "Failed to send request to disable server input.");

        /* Release lock. */
        pthread_mutex_unlock(&(vnc_client->message_lock));
    }

    /* Set remaining client data */
    vnc_client->rfb_client = rfb_client;

    /* Set up screen recording, if requested */
    if (settings->recording_path != NULL) {
        vnc_client->recording = guac_recording_create(client,
                settings->recording_path,
                settings->recording_name,
                settings->create_recording_path,
                !settings->recording_exclude_output,
                !settings->recording_exclude_mouse,
                0, /* Touch events not supported */
                settings->recording_include_keys,
                settings->recording_write_existing);
    }

    /* Create display */
    vnc_client->display = guac_display_alloc(client);
    guac_display_layer_resize(guac_display_default_layer(vnc_client->display), rfb_client->width, rfb_client->height);

    /* Use lossless compression only if requested (otherwise, use default
     * heuristics) */
    guac_display_layer_set_lossless(guac_display_default_layer(vnc_client->display),
            settings->lossless);

    /* If compression and display quality have been configured, set those. */
    if (settings->compress_level >= 0 && settings->compress_level <= 9)
        rfb_client->appData.compressLevel = settings->compress_level;

    if (settings->quality_level >= 0 && settings->quality_level <= 9)
        rfb_client->appData.qualityLevel = settings->quality_level;

    /* If not read-only, set an appropriate cursor */
    if (settings->read_only == 0) {
        if (settings->remote_cursor)
            guac_display_set_cursor(vnc_client->display, GUAC_DISPLAY_CURSOR_DOT);
        else
            guac_display_set_cursor(vnc_client->display, GUAC_DISPLAY_CURSOR_POINTER);
    }

#ifdef LIBVNC_HAS_RESIZE_SUPPORT
    /* Set initial state of the screen and resize flags. */
    vnc_client->rfb_screen_initialized = false;
    vnc_client->rfb_initial_resize = false;
#endif // LIBVNC_HAS_RESIZE_SUPPORT

    guac_display_end_frame(vnc_client->display);

    vnc_client->render_thread = guac_display_render_thread_create(vnc_client->display);

    /* Handle messages from VNC server while client is running */
    while (client->state == GUAC_CLIENT_RUNNING) {

        /* Wait for data and construct a reasonable frame */
        int wait_result = guac_vnc_wait_for_messages(rfb_client, GUAC_VNC_MESSAGE_CHECK_INTERVAL);
        while (wait_result > 0) {

            /* Handle any message received */
            if (!guac_vnc_handle_messages(client)) {
                guac_client_abort(client,
                        GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR,
                        "Error handling message from VNC server.");
                break;
            }

            wait_result = guac_vnc_wait_for_messages(rfb_client, 0);

        }

        /* If an error occurs, log it and fail */
        if (wait_result < 0)
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_UPSTREAM_ERROR, "Connection closed.");

    }

    /* Stop render loop */
    guac_display_render_thread_destroy(vnc_client->render_thread);
    vnc_client->render_thread = NULL;

    /* Kill client and finish connection */
    guac_client_stop(client);
    guac_client_log(client, GUAC_LOG_INFO, "Internal VNC client disconnected");
    return NULL;

}
