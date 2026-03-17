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

#ifndef __GUAC_VNC_SETTINGS_H
#define __GUAC_VNC_SETTINGS_H

#include "config.h"

#include <stdbool.h>

/**
 * The filename to use for the screen recording, if not specified.
 */
#define GUAC_VNC_DEFAULT_RECORDING_NAME "recording"

/**
 * The default number of seconds to attempt to connect to the SFTP server.
 */
#define GUAC_VNC_DEFAULT_SFTP_TIMEOUT 10

/**
 * VNC-specific client data.
 */
typedef struct guac_vnc_settings {

    /**
     * The hostname of the VNC server (or repeater) to connect to.
     */
    char* hostname;

    /**
     * The port of the VNC server (or repeater) to connect to.
     */
    int port;

    /**
     * The username given in the arguments.
     */
    char* username;
    
    /**
     * The password given in the arguments.
     */
    char* password;

    /**
     * Disable the VNC client messages to request that the remote (server)
     * display resize to match the client resolution.
     */
    bool disable_display_resize;

    /**
     * Space-separated list of encodings to use within the VNC session.
     */
    char* encodings;

    /**
     * Whether the red and blue components of each color should be swapped.
     * This is mainly used for VNC servers that do not properly handle
     * colors.
     */
    bool swap_red_blue;

    /**
     * The color depth to request, in bits.
     */
    int color_depth;

    /**
     * Whether this connection is read-only, and user input should be dropped.
     */
    bool read_only;

    /**
     * Whether all graphical updates for this connection should use lossless
     * compression only.
     */
    bool lossless;

    /**
     * The level of compression to ask the VNC client library to perform.
     */
    int compress_level;

     /**
      * The quality level to ask the VNC client library to maintain.
      */
    int quality_level;

#ifdef ENABLE_VNC_REPEATER
    /**
     * The VNC host to connect to, if using a repeater.
     */
    char* dest_host;

    /**
     * The VNC port to connect to, if using a repeater.
     */
    int dest_port;
#endif

#ifdef ENABLE_VNC_LISTEN
    /**
     * Whether not actually connecting to a VNC server, but rather listening
     * for a connection from the VNC server (reverse connection).
     */
    bool reverse_connect;

    /**
     * The maximum amount of time to wait when listening for connections, in
     * milliseconds.
     */
    int listen_timeout;
#endif

    /**
     * Whether the cursor should be rendered on the server (remote) or on the
     * client (local).
     */
    bool remote_cursor;
   
#ifdef ENABLE_PULSE
    /**
     * Whether audio is enabled.
     */
    bool audio_enabled;
 
    /**
     * The name of the PulseAudio server to connect to.
     */
    char* pa_servername;
#endif

    /**
     * The number of connection attempts to make before giving up.
     */
    int retries;

    /**
     * The encoding to use for clipboard data sent to the VNC server, or NULL
     * to use the encoding required by the VNC standard.
     */
    char* clipboard_encoding;

    /**
     * Whether outbound clipboard access should be blocked. If set, it will not
     * be possible to copy data from the remote desktop to the client using the
     * clipboard.
     */
    bool disable_copy;

    /**
     * Whether inbound clipboard access should be blocked. If set, it will not
     * be possible to paste data from the client to the remote desktop using
     * the clipboard.
     */
    bool disable_paste;

#ifdef ENABLE_COMMON_SSH
    /**
     * Whether SFTP should be enabled for the VNC connection.
     */
    bool enable_sftp;

    /**
     * The hostname of the SSH server to connect to for SFTP.
     */
    char* sftp_hostname;

    /**
     * The public SSH host key.
     */
    char* sftp_host_key;

    /**
     * The port of the SSH server to connect to for SFTP.
     */
    char* sftp_port;

    /**
     * The number of seconds to attempt to connect to the SFTP server.
     */
    int sftp_timeout;

    /**
     * The username to provide when authenticating with the SSH server for
     * SFTP.
     */
    char* sftp_username;

    /**
     * The password to provide when authenticating with the SSH server for
     * SFTP (if not using a private key).
     */
    char* sftp_password;

    /**
     * The base64-encoded private key to use when authenticating with the SSH
     * server for SFTP (if not using a password).
     */
    char* sftp_private_key;

    /**
     * The passphrase to use to decrypt the provided base64-encoded private
     * key.
     */
    char* sftp_passphrase;

    /**
     * The base64-encoded public key to use when authenticating with the SSH
     * server for SFTP using key-based authentication.
     */
    char* sftp_public_key;

    /**
     * The default location for file uploads within the SSH server. This will
     * apply only to uploads which do not use the filesystem guac_object (where
     * the destination directory is otherwise ambiguous).
     */
    char* sftp_directory;

    /**
     * The path of the directory within the SSH server to expose as a
     * filesystem guac_object.
     */
    char* sftp_root_directory;

    /**
     * The interval at which SSH keepalive messages are sent to the server for
     * SFTP connections.  The default is 0 (disabling keepalives), and a value
     * of 1 is automatically increased to 2 by libssh2 to avoid busy loop corner
     * cases.
     */
    int sftp_server_alive_interval;
    
    /**
     * Whether file downloads over SFTP should be blocked.  If set to "true",
     * the local client will not be able to download files from the SFTP server.
     * If set to "false" or not set, file downloads will be allowed.
     */
    bool sftp_disable_download;
    
    /**
     * Whether file uploads over SFTP should be blocked.  If set to "true", the
     * local client will not be able to upload files to the SFTP server.  If set
     * to "false" or not set, file uploads will be allowed.
     */
    bool sftp_disable_upload;
#endif

    /**
     * The path in which the screen recording should be saved, if enabled. If
     * no screen recording should be saved, this will be NULL.
     */
    char* recording_path;

    /**
     * The filename to use for the screen recording, if enabled.
     */
    char* recording_name;

    /**
     * Whether the screen recording path should be automatically created if it
     * does not already exist.
     */
    bool create_recording_path;

    /**
     * Whether output which is broadcast to each connected client (graphics,
     * streams, etc.) should NOT be included in the session recording. Output
     * is included by default, as it is necessary for any recording which must
     * later be viewable as video.
     */
    bool recording_exclude_output;

    /**
     * Whether changes to mouse state, such as position and buttons pressed or
     * released, should NOT be included in the session recording. Mouse state
     * is included by default, as it is necessary for the mouse cursor to be
     * rendered in any resulting video.
     */
    bool recording_exclude_mouse;

    /**
     * Whether keys pressed and released should be included in the session
     * recording. Key events are NOT included by default within the recording,
     * as doing so has privacy and security implications.  Including key events
     * may be necessary in certain auditing contexts, but should only be done
     * with caution. Key events can easily contain sensitive information, such
     * as passwords, credit card numbers, etc.
     */
    bool recording_include_keys;

    /**
     * Whether existing files should be appended to when creating a new recording.
     * Disabled by default.
     */
    bool recording_write_existing;
    
    /**
     * Whether or not to send the magic Wake-on-LAN (WoL) packet prior to
     * trying to connect to the remote host.  By default this will not be sent.
     * If this option is enabled but a MAC address is not provided a warning will
     * be logged and the packet will not be sent.
     */
    bool wol_send_packet;
    
    /**
     * The MAC address to place in the magic WoL packet to wake the remote host.
     */
    char* wol_mac_addr;
    
    /**
     * The broadcast address to which to send the magic WoL packet to wake
     * the remote host.
     */
    char* wol_broadcast_addr;
    
    /**
     * The UDP port to use when sending the WoL packet.
     */
    unsigned short wol_udp_port;
    
    /**
     * The number of seconds after sending the magic WoL packet to wait before
     * attempting to connect to the remote host.
     */
    int wol_wait_time;

    /**
     * Whether or not to disable the input on the server side.
     */
    bool disable_server_input;

} guac_vnc_settings;

/**
 * Parses all given args, storing them in a newly-allocated settings object. If
 * the args fail to parse, NULL is returned.
 *
 * @param user
 *     The user who submitted the given arguments while joining the
 *     connection.
 *
 * @param argc
 *     The number of arguments within the argv array.
 *
 * @param argv
 *     The values of all arguments provided by the user.
 *
 * @return
 *     A newly-allocated settings object which must be freed with
 *     guac_vnc_settings_free() when no longer needed. If the arguments fail
 *     to parse, NULL is returned.
 */
guac_vnc_settings* guac_vnc_parse_args(guac_user* user,
        int argc, const char** argv);

/**
 * Frees the given guac_vnc_settings object, having been previously allocated
 * via guac_vnc_parse_args().
 *
 * @param settings
 *     The settings object to free.
 */
void guac_vnc_settings_free(guac_vnc_settings* settings);

/**
 * NULL-terminated array of accepted client args.
 */
extern const char* GUAC_VNC_CLIENT_ARGS[];

#endif

