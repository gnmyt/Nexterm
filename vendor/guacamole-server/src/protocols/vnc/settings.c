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

#include "argv.h"
#include "client.h"
#include "common/defaults.h"
#include "settings.h"

#include <guacamole/mem.h>
#include <guacamole/user.h>
#include <guacamole/wol-constants.h>

#include <stdbool.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* Client plugin arguments */
const char* GUAC_VNC_CLIENT_ARGS[] = {
    "hostname",
    "port",
    "read-only",
    "disable-display-resize",
    "encodings",
    GUAC_VNC_ARGV_USERNAME,
    GUAC_VNC_ARGV_PASSWORD,
    "swap-red-blue",
    "color-depth",
    "cursor",
    "autoretry",
    "clipboard-encoding",

#ifdef ENABLE_VNC_REPEATER
    "dest-host",
    "dest-port",
#endif

#ifdef ENABLE_PULSE
    "enable-audio",
    "audio-servername",
#endif

#ifdef ENABLE_VNC_LISTEN
    "reverse-connect",
    "listen-timeout",
#endif

#ifdef ENABLE_COMMON_SSH
    "enable-sftp",
    "sftp-hostname",
    "sftp-host-key",
    "sftp-port",
    "sftp-timeout",
    "sftp-username",
    "sftp-password",
    "sftp-private-key",
    "sftp-passphrase",
    "sftp-public-key",
    "sftp-directory",
    "sftp-root-directory",
    "sftp-server-alive-interval",
    "sftp-disable-download",
    "sftp-disable-upload",
#endif

    "recording-path",
    "recording-name",
    "recording-exclude-output",
    "recording-exclude-mouse",
    "recording-include-keys",
    "create-recording-path",
    "recording-write-existing",
    "disable-copy",
    "disable-paste",
    "disable-server-input",
    
    "wol-send-packet",
    "wol-mac-addr",
    "wol-broadcast-addr",
    "wol-udp-port",
    "wol-wait-time",

    "force-lossless",
    "compress-level",
    "quality-level",
    NULL
};

enum VNC_ARGS_IDX {
    
    /**
     * The hostname of the VNC server (or repeater) to connect to.
     */
    IDX_HOSTNAME,

    /**
     * The port of the VNC server (or repeater) to connect to.
     */
    IDX_PORT,

    /**
     * "true" if this connection should be read-only (user input should be
     * dropped), "false" or blank otherwise.
     */
    IDX_READ_ONLY,

    /**
     * "true" if the VNC client should disable attempts to resize the remote
     * display to the client's size, "false" or blank if those resize messages
     * should be sent.
     */
    IDX_DISABLE_DISPLAY_RESIZE,

    /**
     * Space-separated list of encodings to use within the VNC session. If not
     * specified, this will be:
     *
     *     "zrle ultra copyrect hextile zlib corre rre raw".
     */
    IDX_ENCODINGS,

    /**
     * The username to send to the VNC server if authentication is requested.
     */
    IDX_USERNAME,
    
    /**
     * The password to send to the VNC server if authentication is requested.
     */
    IDX_PASSWORD,

    /**
     * "true" if the red and blue components of each color should be swapped,
     * "false" or blank otherwise. This is mainly used for VNC servers that do
     * not properly handle colors.
     */
    IDX_SWAP_RED_BLUE,

    /**
     * The color depth to request, in bits.
     */
    IDX_COLOR_DEPTH,

    /**
     * "remote" if the cursor should be rendered on the server instead of the
     * client. All other values will default to local rendering.
     */
    IDX_CURSOR,

    /**
     * The number of connection attempts to make before giving up. By default,
     * this will be 0.
     */
    IDX_AUTORETRY,

    /**
     * The encoding to use for clipboard data sent to the VNC server if we are
     * going to be deviating from the standard (which mandates ISO 8829-1).
     * Valid values are "ISO8829-1" (the only legal value with respect to the
     * VNC standard), "UTF-8", "UTF-16", and "CP2252".
     */
    IDX_CLIPBOARD_ENCODING,

#ifdef ENABLE_VNC_REPEATER
    /**
     * The VNC host to connect to, if using a repeater.
     */
    IDX_DEST_HOST,

    /**
     * The VNC port to connect to, if using a repeater.
     */
    IDX_DEST_PORT,
#endif

#ifdef ENABLE_PULSE
    /**
     * "true" if audio should be enabled, "false" or blank otherwise.
     */
    IDX_ENABLE_AUDIO,

    /**
     * The name of the PulseAudio server to connect to. If left blank, the
     * default sink of the local machine will be used as the source for audio.
     */
    IDX_AUDIO_SERVERNAME,
#endif

#ifdef ENABLE_VNC_LISTEN
    /**
     * "true" if not actually connecting to a VNC server, but rather listening
     * for a connection from the VNC server (reverse connection), "false" or
     * blank otherwise.
     */
    IDX_REVERSE_CONNECT,

    /**
     * The maximum amount of time to wait when listening for connections, in
     * milliseconds. If unspecified, this will default to 5000.
     */
    IDX_LISTEN_TIMEOUT,
#endif

#ifdef ENABLE_COMMON_SSH
    /**
     * "true" if SFTP should be enabled for the VNC connection, "false" or
     * blank otherwise.
     */
    IDX_ENABLE_SFTP,

    /**
     * The hostname of the SSH server to connect to for SFTP. If blank, the
     * hostname of the VNC server will be used.
     */
    IDX_SFTP_HOSTNAME,

    /**
     * The public SSH host key to identify the SFTP server.
     */
    IDX_SFTP_HOST_KEY,

    /**
     * The port of the SSH server to connect to for SFTP. If blank, the default
     * SSH port of "22" will be used.
     */
    IDX_SFTP_PORT,

    /**
     * The number of seconds to attempt to connect to the SFTP server before
     * timing out.
     */
    IDX_SFTP_TIMEOUT,

    /**
     * The username to provide when authenticating with the SSH server for
     * SFTP.
     */
    IDX_SFTP_USERNAME,

    /**
     * The password to provide when authenticating with the SSH server for
     * SFTP (if not using a private key).
     */
    IDX_SFTP_PASSWORD,

    /**
     * The base64-encoded private key to use when authenticating with the SSH
     * server for SFTP (if not using a password).
     */
    IDX_SFTP_PRIVATE_KEY,

    /**
     * The passphrase to use to decrypt the provided base64-encoded private
     * key.
     */
    IDX_SFTP_PASSPHRASE,

    /**
     * The base64-encode public key to use when authentication with the SSH
     * server for SFTP using key-based authentication.
     */
    IDX_SFTP_PUBLIC_KEY,

    /**
     * The default location for file uploads within the SSH server. This will
     * apply only to uploads which do not use the filesystem guac_object (where
     * the destination directory is otherwise ambiguous).
     */
    IDX_SFTP_DIRECTORY,

    /**
     * The path of the directory within the SSH server to expose as a
     * filesystem guac_object. If omitted, "/" will be used by default.
     */
    IDX_SFTP_ROOT_DIRECTORY,

    /**
     * The interval at which SSH keepalive messages are sent to the server for
     * SFTP connections.  The default is 0 (disabling keepalives), and a value
     * of 1 is automatically incremented to 2 by libssh2 to avoid busy loop corner
     * cases.
     */
    IDX_SFTP_SERVER_ALIVE_INTERVAL,
    
    /**
     * If set to "true", file downloads over SFTP will be blocked.  If set to
     * "false" or not set, file downloads will be allowed.
     */
    IDX_SFTP_DISABLE_DOWNLOAD,
    
    /**
     * If set to "true", file uploads over SFTP will be blocked.  If set to
     * "false" or not set, file uploads will be allowed.
     */
    IDX_SFTP_DISABLE_UPLOAD,
#endif

    /**
     * The full absolute path to the directory in which screen recordings
     * should be written.
     */
    IDX_RECORDING_PATH,

    /**
     * The name that should be given to screen recordings which are written in
     * the given path.
     */
    IDX_RECORDING_NAME,

    /**
     * Whether output which is broadcast to each connected client (graphics,
     * streams, etc.) should NOT be included in the session recording. Output
     * is included by default, as it is necessary for any recording which must
     * later be viewable as video.
     */
    IDX_RECORDING_EXCLUDE_OUTPUT,

    /**
     * Whether changes to mouse state, such as position and buttons pressed or
     * released, should NOT be included in the session recording. Mouse state
     * is included by default, as it is necessary for the mouse cursor to be
     * rendered in any resulting video.
     */
    IDX_RECORDING_EXCLUDE_MOUSE,

    /**
     * Whether keys pressed and released should be included in the session
     * recording. Key events are NOT included by default within the recording,
     * as doing so has privacy and security implications.  Including key events
     * may be necessary in certain auditing contexts, but should only be done
     * with caution. Key events can easily contain sensitive information, such
     * as passwords, credit card numbers, etc.
     */
    IDX_RECORDING_INCLUDE_KEYS,

    /**
     * Whether the specified screen recording path should automatically be
     * created if it does not yet exist.
     */
    IDX_CREATE_RECORDING_PATH,

    /**
     * Whether existing files should be appended to when creating a new recording.
     * Disabled by default.
     */
    IDX_RECORDING_WRITE_EXISTING,

    /**
     * Whether outbound clipboard access should be blocked. If set to "true",
     * it will not be possible to copy data from the remote desktop to the
     * client using the clipboard. By default, clipboard access is not blocked.
     */
    IDX_DISABLE_COPY,

    /**
     * Whether inbound clipboard access should be blocked. If set to "true", it
     * will not be possible to paste data from the client to the remote desktop
     * using the clipboard. By default, clipboard access is not blocked.
     */
    IDX_DISABLE_PASTE,

    /**
     * Whether or not to disable the input on the server side when the VNC client
     * is connected. The default is not to disable the input.
     */
    IDX_DISABLE_SERVER_INPUT,
    
    /**
     * Whether to send the magic Wake-on-LAN (WoL) packet to wake the remote
     * host prior to attempting to connect.  If set to "true" the packet will
     * be sent.  By default the packet will not be sent.
     */
    IDX_WOL_SEND_PACKET,
    
    /**
     * The MAC address to place in the magic WoL packet to wake the remote host.
     * If WoL is requested but this is not provided a warning will be logged
     * and the WoL packet will not be sent.
     */
    IDX_WOL_MAC_ADDR,
    
    /**
     * The broadcast packet to which to send the magic WoL packet.
     */
    IDX_WOL_BROADCAST_ADDR,
    
    /**
     * The UDP port to use when sending the WoL packet.
     */
    IDX_WOL_UDP_PORT,
    
    /**
     * The number of seconds to wait after sending the magic WoL packet before
     * attempting to connect to the remote host.  The default is not to wait
     * at all (0 seconds).
     */
    IDX_WOL_WAIT_TIME,

    /**
     * "true" if all graphical updates for this connection should use lossless
     * compression only, "false" or blank otherwise.
     */
    IDX_FORCE_LOSSLESS,

    /**
     * The level of compression, on a scale of 0 (no compression) to 9 (maximum
     * compression), that the connection will be configured for.
     */
    IDX_COMPRESS_LEVEL,

    /**
     * The level of display quality, on a scale of 0 (worst quality) to 9 (best
     * quality), that the connection will be configured for.
     */
    IDX_QUALITY_LEVEL,

    VNC_ARGS_COUNT
};

guac_vnc_settings* guac_vnc_parse_args(guac_user* user,
        int argc, const char** argv) {

    /* Validate arg count */
    if (argc != VNC_ARGS_COUNT) {
        guac_user_log(user, GUAC_LOG_WARNING, "Incorrect number of connection "
                "parameters provided: expected %i, got %i.",
                VNC_ARGS_COUNT, argc);
        return NULL;
    }

    guac_vnc_settings* settings = guac_mem_zalloc(sizeof(guac_vnc_settings));

    settings->hostname =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_HOSTNAME, "");

    settings->port =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_PORT, 0);

    settings->username =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_USERNAME, NULL);
    
    settings->password =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_PASSWORD, NULL);
    
    /* Remote cursor */
    if (strcmp(argv[IDX_CURSOR], "remote") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Cursor rendering: remote");
        settings->remote_cursor = true;
    }

    /* Local cursor */
    else {
        guac_user_log(user, GUAC_LOG_INFO, "Cursor rendering: local");
        settings->remote_cursor = false;
    }

    /* Swap red/blue (for buggy VNC servers) */
    settings->swap_red_blue =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SWAP_RED_BLUE, false);

    /* Read-only mode */
    settings->read_only =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_READ_ONLY, false);

    /* Disable server input */
    settings->disable_server_input =
            guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                                         IDX_DISABLE_SERVER_INPUT, false);

    /* Disable display resize */
    settings->disable_display_resize =
            guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                                         IDX_DISABLE_DISPLAY_RESIZE, false);

    /* Parse color depth */
    settings->color_depth =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_COLOR_DEPTH, 0);

    /* Lossless compression */
    settings->lossless =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_FORCE_LOSSLESS, false);

    /* Compression level */
    settings->compress_level =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_COMPRESS_LEVEL, -1);

    /* Display quality */
    settings->quality_level =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_QUALITY_LEVEL, -1);

#ifdef ENABLE_VNC_REPEATER
    /* Set repeater parameters if specified */
    settings->dest_host =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_DEST_HOST, NULL);

    /* VNC repeater port */
    settings->dest_port =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_DEST_PORT, 0);
#endif

    /* Set encodings if specified */
    settings->encodings =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_ENCODINGS,
                "zrle ultra copyrect hextile zlib corre rre raw");

    /* Parse autoretry */
    settings->retries =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_AUTORETRY, 0);

#ifdef ENABLE_VNC_LISTEN
    /* Set reverse-connection flag */
    settings->reverse_connect =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_REVERSE_CONNECT, false);

    /* Parse listen timeout */
    settings->listen_timeout =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_LISTEN_TIMEOUT, 5000);
#endif

#ifdef ENABLE_PULSE
    /* Audio enable/disable */
    settings->audio_enabled =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_ENABLE_AUDIO, false);

    /* Load servername if specified and applicable */
    if (settings->audio_enabled)
        settings->pa_servername =
            guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                    IDX_AUDIO_SERVERNAME, NULL);
#endif

    /* Set clipboard encoding if specified */
    settings->clipboard_encoding =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_CLIPBOARD_ENCODING, NULL);

#ifdef ENABLE_COMMON_SSH
    /* SFTP enable/disable */
    settings->enable_sftp =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_ENABLE_SFTP, false);

    /* Hostname for SFTP connection */
    settings->sftp_hostname =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_HOSTNAME, settings->hostname);

    /* The public SSH host key. */
    settings->sftp_host_key =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_HOST_KEY, NULL);

    /* Port for SFTP connection */
    settings->sftp_port =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_PORT, "22");

    /* SFTP connection timeout */
    settings->sftp_timeout =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_TIMEOUT, GUAC_VNC_DEFAULT_SFTP_TIMEOUT);

    /* Username for SSH/SFTP authentication */
    settings->sftp_username =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_USERNAME, "");

    /* Password for SFTP (if not using private key) */
    settings->sftp_password =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_PASSWORD, "");

    /* Private key for SFTP (if not using password) */
    settings->sftp_private_key =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_PRIVATE_KEY, NULL);

    /* Passphrase for decrypting the SFTP private key (if applicable */
    settings->sftp_passphrase =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_PASSPHRASE, "");

    /* Public key for SFTP using key-based authentication. */
    settings->sftp_public_key =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_PUBLIC_KEY, NULL);

    /* Default upload directory */
    settings->sftp_directory =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_DIRECTORY, NULL);

    /* SFTP root directory */
    settings->sftp_root_directory =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_ROOT_DIRECTORY, "/");

    /* Default keepalive value */
    settings->sftp_server_alive_interval =
        guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_SERVER_ALIVE_INTERVAL, 0);
    
    settings->sftp_disable_download =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_DISABLE_DOWNLOAD, false);
    
    settings->sftp_disable_upload =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_SFTP_DISABLE_UPLOAD, false);
#endif

    /* Read recording path */
    settings->recording_path =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_RECORDING_PATH, NULL);

    /* Read recording name */
    settings->recording_name =
        guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_RECORDING_NAME, GUAC_VNC_DEFAULT_RECORDING_NAME);

    /* Parse output exclusion flag */
    settings->recording_exclude_output =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_OUTPUT, false);

    /* Parse mouse exclusion flag */
    settings->recording_exclude_mouse =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_MOUSE, false);

    /* Parse key event inclusion flag */
    settings->recording_include_keys =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_RECORDING_INCLUDE_KEYS, false);

    /* Parse path creation flag */
    settings->create_recording_path =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_CREATE_RECORDING_PATH, false);

    /* Parse allow write existing file flag */
    settings->recording_write_existing =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_RECORDING_WRITE_EXISTING, false);

    /* Parse clipboard copy disable flag */
    settings->disable_copy =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_DISABLE_COPY, false);

    /* Parse clipboard paste disable flag */
    settings->disable_paste =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_DISABLE_PASTE, false);
    
    /* Parse Wake-on-LAN (WoL) settings */
    settings->wol_send_packet =
        guac_user_parse_args_boolean(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_WOL_SEND_PACKET, false);
    
    if (settings->wol_send_packet) {
        
        /* If WoL has been enabled but no MAC provided, log warning and disable. */
        if(strcmp(argv[IDX_WOL_MAC_ADDR], "") == 0) {
            guac_user_log(user, GUAC_LOG_WARNING, "Wake on LAN was requested, ",
                    "but no MAC address was specified.  WoL will not be sent.");
            settings->wol_send_packet = false;
        }
        
        /* Parse the WoL MAC address. */
        settings->wol_mac_addr =
            guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_WOL_MAC_ADDR, NULL);
        
        /* Parse the WoL broadcast address. */
        settings->wol_broadcast_addr =
            guac_user_parse_args_string(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_WOL_BROADCAST_ADDR, GUAC_WOL_LOCAL_IPV4_BROADCAST);
        
        /* Parse the WoL broadcast port. */
        settings->wol_udp_port = (unsigned short)
            guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_WOL_UDP_PORT, GUAC_WOL_PORT);
        
        /* Parse the WoL wait time. */
        settings->wol_wait_time =
            guac_user_parse_args_int(user, GUAC_VNC_CLIENT_ARGS, argv,
                IDX_WOL_WAIT_TIME, GUAC_WOL_DEFAULT_BOOT_WAIT_TIME);
        
    }

    return settings;

}

void guac_vnc_settings_free(guac_vnc_settings* settings) {

    /* Free settings strings */
    guac_mem_free(settings->clipboard_encoding);
    guac_mem_free(settings->encodings);
    guac_mem_free(settings->hostname);
    guac_mem_free(settings->password);
    guac_mem_free(settings->recording_name);
    guac_mem_free(settings->recording_path);
    guac_mem_free(settings->username);

#ifdef ENABLE_VNC_REPEATER
    /* Free VNC repeater settings */
    guac_mem_free(settings->dest_host);
#endif

#ifdef ENABLE_COMMON_SSH
    /* Free SFTP settings */
    guac_mem_free(settings->sftp_directory);
    guac_mem_free(settings->sftp_root_directory);
    guac_mem_free(settings->sftp_host_key);
    guac_mem_free(settings->sftp_hostname);
    guac_mem_free(settings->sftp_passphrase);
    guac_mem_free(settings->sftp_password);
    guac_mem_free(settings->sftp_port);
    guac_mem_free(settings->sftp_private_key);
    guac_mem_free(settings->sftp_public_key);
    guac_mem_free(settings->sftp_username);
#endif

#ifdef ENABLE_PULSE
    /* Free PulseAudio settings */
    guac_mem_free(settings->pa_servername);
#endif
    
    /* Free Wake-on-LAN strings */
    guac_mem_free(settings->wol_mac_addr);
    guac_mem_free(settings->wol_broadcast_addr);

    /* Free settings structure */
    guac_mem_free(settings);

}

