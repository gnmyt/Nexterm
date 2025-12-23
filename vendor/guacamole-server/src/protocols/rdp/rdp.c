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

#include "argv.h"
#include "beep.h"
#include "channels/audio-input/audio-buffer.h"
#include "channels/audio-input/audio-input.h"
#include "channels/cliprdr.h"
#include "channels/disp.h"
#include "channels/pipe-svc.h"
#include "channels/rail.h"
#include "channels/rdpdr/rdpdr.h"
#include "channels/rdpei.h"
#include "channels/rdpgfx.h"
#include "channels/rdpsnd/rdpsnd.h"
#include "client.h"
#include "color.h"
#include "config.h"
#include "error.h"
#include "fs.h"
#include "gdi.h"
#include "input.h"
#include "keyboard.h"
#include "plugins/channels.h"
#include "pointer.h"
#include "print-job.h"
#include "rdp.h"
#include "settings.h"

#ifdef ENABLE_COMMON_SSH
#include "common-ssh/sftp.h"
#include "common-ssh/ssh.h"
#include "common-ssh/user.h"
#endif

#include <freerdp/addin.h>
#include <freerdp/channels/channels.h>
#include <freerdp/client/channels.h>
#include <freerdp/freerdp.h>
#include <freerdp/gdi/gdi.h>
#include <freerdp/graphics.h>
#include <freerdp/primary.h>
#include <freerdp/settings.h>
#include <freerdp/update.h>
#include <guacamole/argv.h>
#include <guacamole/audio.h>
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
#include <winpr/error.h>
#include <winpr/synch.h>
#include <winpr/wtypes.h>

#include <stdlib.h>
#include <time.h>

/**
 * Initializes and loads the necessary FreeRDP plugins based on the current
 * RDP session settings. This function is designed to work in environments
 * where the FreeRDP instance expects a LoadChannels callback to be set
 * otherwise it can becalled directly from our pre_connect callback. It
 * configures various features such as display resizing, multi-touch support,
 * audio input, clipboard synchronization, device redirection, and graphics
 * pipeline, by loading their corresponding plugins if they are enabled in the
 * session settings.
 *
 * @param instance
 *     The FreeRDP instance to be prepared, containing all context and
 *     settings for the session.
 *
 * @return
 *     Always TRUE.
 */
static BOOL rdp_freerdp_load_channels(freerdp* instance) {
    rdpContext* context = GUAC_RDP_CONTEXT(instance);
    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_settings* settings = rdp_client->settings;

    /* Load "disp" plugin for display update */
    if (settings->resize_method == GUAC_RESIZE_DISPLAY_UPDATE)
        guac_rdp_disp_load_plugin(context);

    /* Load "rdpei" plugin for multi-touch support */
    if (settings->enable_touch)
        guac_rdp_rdpei_load_plugin(context);

    /* Load "AUDIO_INPUT" plugin for audio input*/
    if (settings->enable_audio_input) {
        /* Upgrade the lock to write temporarily for setting the newly allocated audio buffer */
        guac_rwlock_acquire_write_lock(&(rdp_client->lock));
        rdp_client->audio_input = guac_rdp_audio_buffer_alloc(client);
        guac_rdp_audio_load_plugin(GUAC_RDP_CONTEXT(instance));

        /* Downgrade the lock to allow for concurrent read access */
        guac_rwlock_release_lock(&(rdp_client->lock));
    }

    /* Load "cliprdr" service if not disabled */
    if (!(settings->disable_copy && settings->disable_paste))
        guac_rdp_clipboard_load_plugin(rdp_client->clipboard, context);

    /* If RDPSND/RDPDR required, load them */
    if (settings->printing_enabled
        || settings->drive_enabled
        || settings->audio_enabled) {
        guac_rdpdr_load_plugin(context);
        guac_rdpsnd_load_plugin(context);
    }

    /* Load "rdpgfx" plugin for Graphics Pipeline Extension */
    if (settings->enable_gfx)
        guac_rdp_rdpgfx_load_plugin(context);

    /* Load plugin providing Dynamic Virtual Channel support, if required */
    if (freerdp_settings_get_bool(GUAC_RDP_CONTEXT(instance)->settings, FreeRDP_SupportDynamicChannels) &&
            guac_freerdp_channels_load_plugin(context, "drdynvc",
                GUAC_RDP_CONTEXT(instance)->settings)) {
        guac_client_log(client, GUAC_LOG_WARNING,
                "Failed to load drdynvc plugin. Display update and audio "
                "input support will be disabled.");
    }

    return TRUE;
}

/**
 * Prepares the FreeRDP instance for connection by setting up session-specific
 * configurations like graphics, plugins, and RDP settings. This involves
 * integrating Guacamole's custom rendering handlers (for bitmaps, glyphs,
 * and pointers). If using a freerdp instance that does not expect a
 * LoadChannels callback then this function manually loads RDP channels.
 * 
 * @param instance
 *     The FreeRDP instance to be prepared, containing all context and
 *     settings for the session.
 *
 * @return
 *     Returns TRUE if the pre-connection process completes successfully.
 *     Returns FALSE if an error occurs during the initialization of the
 *     FreeRDP GDI system.
 */
static BOOL rdp_freerdp_pre_connect(freerdp* instance) {

    rdpContext* context = GUAC_RDP_CONTEXT(instance);
    rdpGraphics* graphics = context->graphics;

    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_settings* settings = rdp_client->settings;

    /* Push desired settings to FreeRDP */
    guac_rdp_push_settings(client, settings, instance);

    /* Init FreeRDP add-in provider */
    freerdp_register_addin_provider(freerdp_channels_load_static_addin_entry, 0);

    /* Load RAIL plugin if RemoteApp in use */
    if (settings->remote_app != NULL)
        guac_rdp_rail_load_plugin(context);

    /* Load SVC plugin instances for all static channels */
    if (settings->svc_names != NULL) {

        char** current = settings->svc_names;
        do {
            guac_rdp_pipe_svc_load_plugin(context, *current);
        } while (*(++current) != NULL);

    }

    /* Init FreeRDP internal GDI implementation */
    if (!gdi_init(instance, guac_rdp_get_native_pixel_format(FALSE)))
        return FALSE;

    /* Set up pointer handling */
    rdpPointer pointer = *graphics->Pointer_Prototype;
    pointer.size = sizeof(guac_rdp_pointer);
    pointer.New = guac_rdp_pointer_new;
    pointer.Free = guac_rdp_pointer_free;
    pointer.Set = guac_rdp_pointer_set;
    pointer.SetNull = guac_rdp_pointer_set_null;
    pointer.SetDefault = guac_rdp_pointer_set_default;
    graphics_register_pointer(graphics, &pointer);

    /* Beep on receipt of Play Sound PDU */
    GUAC_RDP_CONTEXT(instance)->update->PlaySound = guac_rdp_beep_play_sound;

    /* Automatically synchronize keyboard locks when changed server-side */
    GUAC_RDP_CONTEXT(instance)->update->SetKeyboardIndicators = guac_rdp_keyboard_set_indicators;

    /* Set up GDI */
    GUAC_RDP_CONTEXT(instance)->update->DesktopResize = guac_rdp_gdi_desktop_resize;
    GUAC_RDP_CONTEXT(instance)->update->BeginPaint = guac_rdp_gdi_begin_paint;
    GUAC_RDP_CONTEXT(instance)->update->EndPaint = guac_rdp_gdi_end_paint;

    GUAC_RDP_CONTEXT(instance)->update->SurfaceFrameMarker = guac_rdp_gdi_surface_frame_marker;
    GUAC_RDP_CONTEXT(instance)->update->altsec->FrameMarker = guac_rdp_gdi_frame_marker;

    /*
     * If the freerdp instance does not have a LoadChannels callback for
     * loading plugins we use the PreConnect callback to load plugins instead.
     */
    #ifndef RDP_INST_HAS_LOAD_CHANNELS
        rdp_freerdp_load_channels(instance);
    #endif

    return TRUE;
}

/**
 * Callback invoked by FreeRDP when authentication is required but the required
 * parameters have not been provided. In the case of Guacamole clients that
 * support the "required" instruction, this function will send any of the three
 * unpopulated RDP authentication parameters back to the client so that the
 * connection owner can provide the required information.  If the values have
 * been provided in the original connection parameters the user will not be
 * prompted for updated parameters. If the version of Guacamole Client in use
 * by the connection owner does not support the "required" instruction then the
 * connection will fail. This function always returns true.
 *
 * @param instance
 *     The FreeRDP instance associated with the RDP session requesting
 *     credentials.
 *
 * @param username
 *     Pointer to a string which will receive the user's username.
 *
 * @param password
 *     Pointer to a string which will receive the user's password.
 *
 * @param domain
 *     Pointer to a string which will receive the domain associated with the
 *     user's account.
 *
 * @return
 *     Always TRUE.
 */
static BOOL rdp_freerdp_authenticate(freerdp* instance, char** username,
        char** password, char** domain) {

    rdpContext* context = GUAC_RDP_CONTEXT(instance);
    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_settings* settings = rdp_client->settings;
    char* params[4] = {NULL};
    int i = 0;
    
    /* If the client does not support the "required" instruction, warn and
     * quit.
     */
    if (!guac_client_owner_supports_required(client)) {
        guac_client_log(client, GUAC_LOG_WARNING, "Client does not support the "
                "\"required\" instruction. No authentication parameters will "
                "be requested.");
        return TRUE;
    }

    /* If the username is undefined, add it to the requested parameters. */
    if (settings->username == NULL) {
        guac_argv_register(GUAC_RDP_ARGV_USERNAME, guac_rdp_argv_callback, NULL, 0);
        params[i] = GUAC_RDP_ARGV_USERNAME;
        i++;
        
        /* If username is undefined and domain is also undefined, request domain. */
        if (settings->domain == NULL) {
            guac_argv_register(GUAC_RDP_ARGV_DOMAIN, guac_rdp_argv_callback, NULL, 0);
            params[i] = GUAC_RDP_ARGV_DOMAIN;
            i++;
        }
        
    }
    
    /* If the password is undefined, add it to the requested parameters. */
    if (settings->password == NULL) {
        guac_argv_register(GUAC_RDP_ARGV_PASSWORD, guac_rdp_argv_callback, NULL, 0);
        params[i] = GUAC_RDP_ARGV_PASSWORD;
        i++;
    }
    
    /* NULL-terminate the array. */
    params[i] = NULL;
    
    if (i > 0) {
        
        /* Send required parameters to the owner and wait for the response. */
        guac_client_owner_send_required(client, (const char**) params);
        guac_argv_await((const char**) params);
        
        /* Free old values and get new values from settings. */
        guac_mem_free(*username);
        guac_mem_free(*password);
        guac_mem_free(*domain);
        *username = guac_strdup(settings->username);
        *password = guac_strdup(settings->password);
        *domain = guac_strdup(settings->domain);
        
    }
    
    /* Always return TRUE allowing connection to retry. */
    return TRUE;

}

#ifdef HAVE_FREERDP_VERIFYCERTIFICATEEX
/**
 * Callback invoked by FreeRDP when the SSL/TLS certificate of the RDP server
 * needs to be verified. If this ever happens, this function implementation
 * will always fail unless the connection has been configured to ignore
 * certificate validity.
 *
 * @param instance
 *     The FreeRDP instance associated with the RDP session whose SSL/TLS
 *     certificate needs to be verified.
 *
 * @param hostname
 *     The hostname or address of the RDP server being connected to.
 *
 * @param port
 *     The TCP port number of the RDP server being connected to.
 *
 * @param common_name
 *     The name of the server protected by the certificate. This should match
 *     the hostname/address of the RDP server.
 *
 * @param subject
 *     The subject to whom the certificate was issued.
 *
 * @param issuer
 *     The authority that issued the certificate,
 *
 * @param fingerprint
 *     The cryptographic fingerprint of the certificate.
 *
 * @param flags
 *     Bitwise OR of any applicable certificate verification flags. Valid flags are
 *     VERIFY_CERT_FLAG_NONE, VERIFY_CERT_FLAG_LEGACY, VERIFY_CERT_FLAG_REDIRECT,
 *     VERIFY_CERT_FLAG_GATEWAY, VERIFY_CERT_FLAG_CHANGED, and
 *     VERIFY_CERT_FLAG_MISMATCH.
 *
 * @return
 *     1 to accept the certificate and store within FreeRDP's configuration
 *     directory, 2 to accept the certificate only within this session, or 0 to
 *     reject the certificate.
 */
static DWORD rdp_freerdp_verify_certificate(freerdp* instance,
        const char* hostname, UINT16 port, const char* common_name,
        const char* subject, const char* issuer, const char* fingerprint,
        DWORD flags) {
#else
/**
 * Callback invoked by FreeRDP when the SSL/TLS certificate of the RDP server
 * needs to be verified. If this ever happens, this function implementation
 * will always fail unless the connection has been configured to ignore
 * certificate validity.
 *
 * @param instance
 *     The FreeRDP instance associated with the RDP session whose SSL/TLS
 *     certificate needs to be verified.
 *
 * @param subject
 *     The subject to whom the certificate was issued.
 *
 * @param issuer
 *     The authority that issued the certificate,
 *
 * @param fingerprint
 *     The cryptographic fingerprint of the certificate.
 *
 * @param host_mismatch
 *     TRUE if the certificate does not match the destination hostname, FALSE
 *     otherwise.
 *
 * @return
 *     1 to accept the certificate and store within FreeRDP's configuration
 *     directory, 2 to accept the certificate only within this session, or 0 to
 *     reject the certificate.
 */
static DWORD rdp_freerdp_verify_certificate(freerdp* instance,
        const char* common_name, const char* subject, const char* issuer,
        const char* fingerprint, BOOL host_mismatch) {
#endif

    rdpContext* context = GUAC_RDP_CONTEXT(instance);
    guac_client* client = ((rdp_freerdp_context*) context)->client;
    guac_rdp_client* rdp_client =
        (guac_rdp_client*) client->data;

    /* Bypass validation if ignore_certificate given */
    if (rdp_client->settings->ignore_certificate) {
        guac_client_log(client, GUAC_LOG_INFO, "Certificate validation bypassed");
        return 2; /* Accept only for this session */
    }

    guac_client_log(client, GUAC_LOG_INFO, "Certificate validation failed");
    return 0; /* Reject certificate */

}

/**
 * Waits for messages from the RDP server for the given number of milliseconds.
 *
 * @param client
 *     The client associated with the current RDP session.
 *
 * @param timeout_msecs
 *     The maximum amount of time to wait, in milliseconds.
 *
 * @return
 *     A positive value if messages are ready, zero if the specified timeout
 *     period elapsed, or a negative value if an error occurs.
 */
static int rdp_guac_client_wait_for_events(guac_client* client,
        int timeout_msecs) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    freerdp* rdp_inst = rdp_client->rdp_inst;

    HANDLE handles[GUAC_RDP_MAX_FILE_DESCRIPTORS];
    int num_handles = 0;

    handles[num_handles++] = rdp_client->input_event_queued;

    num_handles += freerdp_get_event_handles(GUAC_RDP_CONTEXT(rdp_inst),
            handles + num_handles, GUAC_RDP_MAX_FILE_DESCRIPTORS - num_handles);

    /* Wait for data and construct a reasonable frame */
    DWORD result = WaitForMultipleObjects(num_handles, handles, FALSE,
            timeout_msecs);

    ResetEvent(rdp_client->input_event_queued);

    /* Translate WaitForMultipleObjects() return values */
    switch (result) {

        /* Timeout elapsed before wait could complete */
        case WAIT_TIMEOUT:
            return 0;

        /* Attempt to wait failed due to an error */
        case WAIT_FAILED:
            return -1;

    }

    /* Wait was successful */
    return 1;

}

/**
 * Handles any queued RDP-related events, including inbound RDP messages that
 * have been received, updating the Guacamole display accordingly.
 *
 * @param rdp_client
 *     The guac_rdp_client of the RDP connection whose current messages should
 *     be handled.
 *
 * @return
 *     True (non-zero) if messages were handled successfully, false (zero)
 *     otherwise.
 */
static int guac_rdp_handle_events(guac_rdp_client* rdp_client) {

    /* Actually handle messages (this may result in drawing to the
     * guac_display, resizing the display buffer, etc.) */
    pthread_mutex_lock(&(rdp_client->message_lock));
    int retval = freerdp_check_event_handles(GUAC_RDP_CONTEXT(rdp_client->rdp_inst));
    pthread_mutex_unlock(&(rdp_client->message_lock));

    return retval;

}

/**
 * Connects to an RDP server as described by the guac_rdp_settings structure
 * associated with the given client, allocating and freeing all objects
 * directly related to the RDP connection. It is expected that all objects
 * which are independent of FreeRDP's state (the clipboard, display update
 * management, etc.) will already be allocated and associated with the
 * guac_rdp_client associated with the given guac_client. This function blocks
 * for the duration of the RDP session, returning only after the session has
 * completely disconnected.
 *
 * @param client
 *     The guac_client associated with the RDP settings describing the
 *     connection that should be established.
 *
 * @return
 *     Zero if the connection successfully terminated and a reconnect is
 *     desired, non-zero if an error occurs or the connection was disconnected
 *     and a reconnect is NOT desired.
 */
static int guac_rdp_handle_connection(guac_client* client) {

    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_settings* settings = rdp_client->settings;

    /* Init random number generator */
    srandom(time(NULL));

    guac_rwlock_acquire_write_lock(&(rdp_client->lock));

    /* Create display */
    rdp_client->display = guac_display_alloc(client);

    guac_display_layer* default_layer = guac_display_default_layer(rdp_client->display);
    guac_display_layer_resize(default_layer, rdp_client->settings->width, rdp_client->settings->height);

    /* Use lossless compression only if requested (otherwise, use default
     * heuristics) */
    guac_display_layer_set_lossless(default_layer, settings->lossless);

    rdp_client->current_surface = default_layer;

    rdp_client->available_svc = guac_common_list_alloc();

    /* Init client */
    freerdp* rdp_inst = freerdp_new();

    /*
     * If the freerdp instance has a LoadChannels callback for loading plugins
     * we use that instead of the PreConnect callback to load plugins.
     */
    #ifdef RDP_INST_HAS_LOAD_CHANNELS
        rdp_inst->LoadChannels = rdp_freerdp_load_channels;
    #endif
    rdp_inst->PreConnect = rdp_freerdp_pre_connect;
    rdp_inst->Authenticate = rdp_freerdp_authenticate;

#ifdef HAVE_FREERDP_VERIFYCERTIFICATEEX
    rdp_inst->VerifyCertificateEx = rdp_freerdp_verify_certificate;
#else
    rdp_inst->VerifyCertificate = rdp_freerdp_verify_certificate;
#endif

    /* Allocate FreeRDP context */
    rdp_inst->ContextSize = sizeof(rdp_freerdp_context);

    if (!freerdp_context_new(rdp_inst)) {
        guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                "FreeRDP initialization failed before connecting. Please "
                "check for errors earlier in the logs and/or enable "
                "debug-level logging for guacd.");
        goto fail;
    }

    ((rdp_freerdp_context*) GUAC_RDP_CONTEXT(rdp_inst))->client = client;

    /* Load keymap into client */
    rdp_client->keyboard = guac_rdp_keyboard_alloc(client,
            settings->server_layout);

    /* Set default pointer */
    guac_display_set_cursor(rdp_client->display, GUAC_DISPLAY_CURSOR_POINTER);

    /* 
     * Downgrade the lock to allow for concurrent read access.
     * Access to read locks needs to be made available for other processes such
     * as the join_pending_handler to use while we await credentials from the user.
     */
    guac_rwlock_release_lock(&(rdp_client->lock));
    guac_rwlock_acquire_read_lock(&(rdp_client->lock));

    /* Connect to RDP server */
    if (!freerdp_connect(rdp_inst)) {
        guac_rdp_client_abort(client, rdp_inst);
        goto fail;
    }

    /* Upgrade to write lock again for further exclusive operations */
    guac_rwlock_release_lock(&(rdp_client->lock));
    guac_rwlock_acquire_write_lock(&(rdp_client->lock));

    /* Connection complete */
    rdp_client->rdp_inst = rdp_inst;

    /* Signal that reconnect has been completed */
    guac_rdp_disp_reconnect_complete(rdp_client->disp);

    guac_rwlock_release_lock(&(rdp_client->lock));

    rdp_client->render_thread = guac_display_render_thread_create(rdp_client->display);

    /* Handle messages from RDP server while client is running */
    while (client->state == GUAC_CLIENT_RUNNING
            && !guac_rdp_disp_reconnect_needed(rdp_client->disp)) {

        /* Update remote display size */
        guac_rdp_disp_update_size(rdp_client->disp, settings, rdp_inst);

        /* Wait for data and construct a reasonable frame */

        int wait_result = rdp_guac_client_wait_for_events(client, GUAC_RDP_MESSAGE_CHECK_INTERVAL);
        if (wait_result < 0)
            break;

        int connection_closing;
        do {

            /* Handle any queued FreeRDP events (this may result in RDP messages
             * being sent), aborting later if FreeRDP event handling fails */
            if (!guac_rdp_handle_events(rdp_client))
                wait_result = -1;

            /* Test whether the RDP server is closing the connection */
#ifdef HAVE_DISCONNECT_CONTEXT
            connection_closing = freerdp_shall_disconnect_context(rdp_inst->context);
#else
            connection_closing = freerdp_shall_disconnect(rdp_inst);
#endif

        } while (!connection_closing &&
                (wait_result = rdp_guac_client_wait_for_events(client, 0)) > 0);

        /* Notify display of any changes to the GDI that may have occurred
         * while handling events/messages */
        if (rdp_client->gdi_modified) {
            guac_display_render_thread_notify_modified(rdp_client->render_thread);
            rdp_client->gdi_modified = 0;
        }

        /* Handle any input events that have been received */
        guac_rdp_handle_input_events(rdp_client);

        /* Close connection cleanly if server is disconnecting */
        if (connection_closing)
            guac_rdp_client_abort(client, rdp_inst);

        /* If a low-level connection error occurred, fail */
        else if (wait_result < 0)
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_UPSTREAM_UNAVAILABLE,
                    "Connection closed.");

    }

    guac_rwlock_acquire_write_lock(&(rdp_client->lock));

    /* Clean up print job, if active */
    if (rdp_client->active_job != NULL) {
        guac_rdp_print_job_kill(rdp_client->active_job);
        guac_rdp_print_job_free(rdp_client->active_job);
    }

    /* Disconnect client and channels */
    pthread_mutex_lock(&(rdp_client->message_lock));
    freerdp_disconnect(rdp_inst);
    pthread_mutex_unlock(&(rdp_client->message_lock));

    /* Stop render loop */
    guac_display_render_thread_destroy(rdp_client->render_thread);
    rdp_client->render_thread = NULL;

    /* Remove reference to FreeRDP's GDI buffer so that it can be safely freed
     * prior to freeing the guac_display */
    guac_display_layer_raw_context* context = guac_display_layer_open_raw(default_layer);
    context->buffer = NULL;
    guac_display_layer_close_raw(default_layer, context);

    /* Ensure all background rendering processes are stopped before freeing
     * underlying memory */
    guac_display_stop(rdp_client->display);

    /* Clean up FreeRDP internal GDI implementation (this must be done BEFORE
     * freeing the guac_display, as freeing the GDI will free objects like
     * rdpPointer that will attempt to free associated guac_display_layer
     * instances during cleanup) */
    gdi_free(rdp_inst);

    /* Free display */
    guac_display_free(rdp_client->display);
    rdp_client->display = NULL;

    /* Clean up RDP client context */
    freerdp_context_free(rdp_inst);

    /* Clean up RDP client */
    freerdp_free(rdp_inst);
    rdp_client->rdp_inst = NULL;

    /* Free SVC list */
    guac_common_list_free(rdp_client->available_svc, NULL);
    rdp_client->available_svc = NULL;

    /* Free RDP keyboard state */
    guac_rdp_keyboard_free(rdp_client->keyboard);
    rdp_client->keyboard = NULL;

    guac_rwlock_release_lock(&(rdp_client->lock));

    /* Client is now disconnected */
    guac_client_log(client, GUAC_LOG_INFO, "Internal RDP client disconnected");

    return 0;

fail:
    guac_rwlock_release_lock(&(rdp_client->lock));
    return 1;

}

void* guac_rdp_client_thread(void* data) {

    guac_client* client = (guac_client*) data;
    guac_rdp_client* rdp_client = (guac_rdp_client*) client->data;
    guac_rdp_settings* settings = rdp_client->settings;

    /* If Wake-on-LAN is enabled, attempt to wake. */
    if (settings->wol_send_packet) {

        /**
         * If wait time is set, send the wake packet and try to connect to the
         * server, failing if the server does not respond.
         */
        if (settings->wol_wait_time > 0) {
            guac_client_log(client, GUAC_LOG_DEBUG, "Sending Wake-on-LAN packet, "
                    "and pausing for %d seconds.", settings->wol_wait_time);

            /* char representation of a port should be, at most, 5 digits plus terminator. */
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
                guac_client_log(client, GUAC_LOG_ERROR, "Failed to send WOL packet, or server failed to wake up.");
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
    
    /* If audio enabled, choose an encoder */
    if (settings->audio_enabled) {

        rdp_client->audio = guac_audio_stream_alloc(client, NULL,
                GUAC_RDP_AUDIO_RATE,
                GUAC_RDP_AUDIO_CHANNELS,
                GUAC_RDP_AUDIO_BPS);

        /* Warn if no audio encoding is available */
        if (rdp_client->audio == NULL)
            guac_client_log(client, GUAC_LOG_INFO,
                    "No available audio encoding. Sound disabled.");

    } /* end if audio enabled */

    /* Load filesystem if drive enabled */
    if (settings->drive_enabled) {

        /* Allocate actual emulated filesystem */
        rdp_client->filesystem =
            guac_rdp_fs_alloc(client, settings->drive_path,
                    settings->create_drive_path, settings->disable_download,
                    settings->disable_upload);

        /* Expose filesystem to owner */
        guac_client_for_owner(client, guac_rdp_fs_expose,
                rdp_client->filesystem);

    }

#ifdef ENABLE_COMMON_SSH
    /* Connect via SSH if SFTP is enabled */
    if (settings->enable_sftp) {

        /* Abort if username is missing */
        if (settings->sftp_username == NULL) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_SERVER_ERROR,
                    "A username or SFTP-specific username is required if "
                    "SFTP is enabled.");
            return NULL;
        }

        guac_client_log(client, GUAC_LOG_DEBUG,
                "Connecting via SSH for SFTP filesystem access.");

        rdp_client->sftp_user =
            guac_common_ssh_create_user(settings->sftp_username);

        /* Import private key, if given */
        if (settings->sftp_private_key != NULL) {

            guac_client_log(client, GUAC_LOG_DEBUG,
                    "Authenticating with private key.");

            /* Abort if private key cannot be read */
            if (guac_common_ssh_user_import_key(rdp_client->sftp_user,
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
                if (guac_common_ssh_user_import_public_key(rdp_client->sftp_user,
                            settings->sftp_public_key)) {

                    /* Public key import fails. */
                    guac_client_abort(client,
                           GUAC_PROTOCOL_STATUS_CLIENT_UNAUTHORIZED,
                           "Failed to import public key: %s",
                            guac_common_ssh_key_error());

                    guac_common_ssh_destroy_user(rdp_client->sftp_user);
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

            guac_common_ssh_user_set_password(rdp_client->sftp_user,
                    settings->sftp_password);

        }

        /* Attempt SSH connection */
        rdp_client->sftp_session =
            guac_common_ssh_create_session(client, settings->sftp_hostname,
                    settings->sftp_port, rdp_client->sftp_user, settings->sftp_timeout,
                    settings->sftp_server_alive_interval, settings->sftp_host_key, NULL);

        /* Fail if SSH connection does not succeed */
        if (rdp_client->sftp_session == NULL) {
            /* Already aborted within guac_common_ssh_create_session() */
            return NULL;
        }

        /* Load and expose filesystem */
        rdp_client->sftp_filesystem =
            guac_common_ssh_create_sftp_filesystem(rdp_client->sftp_session,
                    settings->sftp_root_directory, NULL,
                    settings->sftp_disable_download,
                    settings->sftp_disable_upload);

        /* Expose filesystem to connection owner */
        guac_client_for_owner(client,
                guac_common_ssh_expose_sftp_filesystem,
                rdp_client->sftp_filesystem);

        /* Abort if SFTP connection fails */
        if (rdp_client->sftp_filesystem == NULL) {
            guac_client_abort(client, GUAC_PROTOCOL_STATUS_UPSTREAM_UNAVAILABLE,
                    "SFTP connection failed.");
            return NULL;
        }

        /* Configure destination for basic uploads, if specified */
        if (settings->sftp_directory != NULL)
            guac_common_ssh_sftp_set_upload_path(
                    rdp_client->sftp_filesystem,
                    settings->sftp_directory);

        guac_client_log(client, GUAC_LOG_DEBUG,
                "SFTP connection succeeded.");

    }
#endif

    /* Set up screen recording, if requested */
    if (settings->recording_path != NULL) {
        rdp_client->recording = guac_recording_create(client,
                settings->recording_path,
                settings->recording_name,
                settings->create_recording_path,
                !settings->recording_exclude_output,
                !settings->recording_exclude_mouse,
                !settings->recording_exclude_touch,
                settings->recording_include_keys,
                settings->recording_write_existing);
    }

    /* Continue handling connections until error or client disconnect */
    while (client->state == GUAC_CLIENT_RUNNING) {
        if (guac_rdp_handle_connection(client))
            break;
    }

    return NULL;

}
