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
#include "terminal/terminal.h"

#include <guacamole/mem.h>
#include <guacamole/user.h>
#include <guacamole/wol-constants.h>

#include <stdlib.h>
#include <string.h>
#include <time.h>

/* Client plugin arguments */
const char* GUAC_SSH_CLIENT_ARGS[] = {
    "hostname",
    "host-key",
    "port",
    "timeout",
    "username",
    "password",
    GUAC_SSH_ARGV_FONT_NAME,
    GUAC_SSH_ARGV_FONT_SIZE,
    "enable-sftp",
    "sftp-root-directory",
    "sftp-disable-download",
    "sftp-disable-upload",
    "private-key",
    "passphrase",
    "public-key",
#ifdef ENABLE_SSH_AGENT
    "enable-agent",
#endif
    GUAC_SSH_ARGV_COLOR_SCHEME,
    "command",
    "typescript-path",
    "typescript-name",
    "create-typescript-path",
    "typescript-write-existing",
    "recording-path",
    "recording-name",
    "recording-exclude-output",
    "recording-exclude-mouse",
    "recording-include-keys",
    "create-recording-path",
    "recording-write-existing",
    "read-only",
    "server-alive-interval",
    "backspace",
    "terminal-type",
    "scrollback",
    "locale",
    "timezone",
    "disable-copy",
    "disable-paste",
    "wol-send-packet",
    "wol-mac-addr",
    "wol-broadcast-addr",
    "wol-udp-port",
    "wol-wait-time",
    NULL
};

enum SSH_ARGS_IDX {

    /**
     * The hostname to connect to. Required.
     */
    IDX_HOSTNAME,

    /**
     * The Base64-encoded public SSH host key.  Optional.
     */
    IDX_HOST_KEY,

    /**
     * The port to connect to. Optional.
     */
    IDX_PORT,

    /**
     * The timeout of the connection attempt, in seconds. Optional.
     */
    IDX_TIMEOUT,

    /**
     * The name of the user to login as. Optional.
     */
    IDX_USERNAME,

    /**
     * The password to use when logging in. Optional.
     */
    IDX_PASSWORD,

    /**
     * The name of the font to use within the terminal.
     */
    IDX_FONT_NAME,

    /**
     * The size of the font to use within the terminal, in points.
     */
    IDX_FONT_SIZE,

    /**
     * Whether SFTP should be enabled.
     */
    IDX_ENABLE_SFTP,

    /**
     * The path of the directory within the SSH server to expose as a
     * filesystem guac_object. If omitted, "/" will be used by default.
     */
    IDX_SFTP_ROOT_DIRECTORY,
    
    /**
     * "true" if file downloads over SFTP should be blocked.  "false" or blank
     * if file downloads should be allowed.
     */
    IDX_SFTP_DISABLE_DOWNLOAD,
    
    /**
     * "true" if file uploads over SFTP should be blocked.  "false" or blank if
     * file uploads should be allowed.
     */
    IDX_SFTP_DISABLE_UPLOAD,

    /**
     * The private key to use for authentication, if any.
     */
    IDX_PRIVATE_KEY,

    /**
     * The passphrase required to decrypt the private key, if any.
     */
    IDX_PASSPHRASE,

    /**
     * The public key to use for authentication, if any.
     */
    IDX_PUBLIC_KEY,

#ifdef ENABLE_SSH_AGENT
    /**
     * Whether SSH agent forwarding support should be enabled.
     */
    IDX_ENABLE_AGENT,
#endif

    /**
     * The color scheme to use, as a series of semicolon-separated color-value
     * pairs: "background: <color>", "foreground: <color>", or
     * "color<n>: <color>", where <n> is a number from 0 to 255, and <color> is
     * "color<n>" or an X11 color code (e.g. "aqua" or "rgb:12/34/56").
     * The color scheme can also be one of the special values: "black-white",
     * "white-black", "gray-black", or "green-black".
     */
    IDX_COLOR_SCHEME,

    /**
     * The command to run instead if the default shell. If omitted, a normal
     * shell session will be created.
     */
    IDX_COMMAND,

    /**
     * The full absolute path to the directory in which typescripts should be
     * written.
     */
    IDX_TYPESCRIPT_PATH,

    /**
     * The name that should be given to typescripts which are written in the
     * given path. Each typescript will consist of two files: "NAME" and
     * "NAME.timing".
     */
    IDX_TYPESCRIPT_NAME,

    /**
     * Whether the specified typescript path should automatically be created
     * if it does not yet exist.
     */
    IDX_CREATE_TYPESCRIPT_PATH,

    /**
     * Whether existing files should be appended to when creating a new
     * typescript. Disabled by default.
     */
    IDX_TYPESCRIPT_WRITE_EXISTING,

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
     * "true" if this connection should be read-only (user input should be
     * dropped), "false" or blank otherwise.
     */
    IDX_READ_ONLY,

    /**
     * Number of seconds between sending alive packets.  A default of 0
     * tells SSH not to send these packets.  A value of 1 is automatically
     * changed by libssh2 to 2 to avoid busy-loop corner cases.
     */
    IDX_SERVER_ALIVE_INTERVAL,

    /**
     * The ASCII code, as an integer, to send for the backspace key, as configured
     * by the SSH connection from the client.  By default this will be
     * GUAC_TERMINAL_DEFAULT_BACKSPACE.
     */
    IDX_BACKSPACE,

    /**
     * The terminal emulator type that is passed to the remote system (e.g.
     * "xterm" or "xterm-256color"). "linux" is used if unspecified.
     */
    IDX_TERMINAL_TYPE,

    /**
     * The maximum size of the scrollback buffer in rows.
     */
    IDX_SCROLLBACK,

    /**
     * The locale that should be forwarded to the remote system via the LANG
     * environment variable. By default, no locale is forwarded. This setting
     * will only have an effect if the SSH server allows the LANG environment
     * variable to be set.
     */
    IDX_LOCALE,
     
    /**
     * The timezone that is to be passed to the remote system, via the
     * TZ environment variable.  By default, no timezone is forwarded
     * and the timezone of the remote system will be used.  This
     * setting will only work if the SSH server allows the TZ variable
     * to be set.  Timezones should be in standard IANA format, see:
     * https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
     */
    IDX_TIMEZONE,

    /**
     * Whether outbound clipboard access should be blocked. If set to "true",
     * it will not be possible to copy data from the terminal to the client
     * using the clipboard. By default, clipboard access is not blocked.
     */
    IDX_DISABLE_COPY,

    /**
     * Whether inbound clipboard access should be blocked. If set to "true", it
     * will not be possible to paste data from the client to the terminal using
     * the clipboard. By default, clipboard access is not blocked.
     */
    IDX_DISABLE_PASTE,
    
    /**
     * Whether the magic WoL packet should be sent prior to starting the
     * connection.  If set to "true", the system will attempt to send the WoL
     * packet and wait for the host to wake up.  By default the WoL packet
     * is not sent.
     */
    IDX_WOL_SEND_PACKET,
    
    /**
     * The MAC address to put in the magic WoL packet to wake the remote system.
     * By default no MAC address is specified.  If WoL is enabled by a MAC
     * address is not provided a warning will be logged and the WoL packet will
     * not be sent.
     */
    IDX_WOL_MAC_ADDR,
    
    /**
     * The broadcast address to which to send the magic WoL packet to wake the
     * remote system.
     */
    IDX_WOL_BROADCAST_ADDR,
    
    /**
     * The UDP port to use when sending the WoL packet. 
     */
    IDX_WOL_UDP_PORT,
    
    /**
     * The amount of time to wait after sending the magic WoL packet prior to
     * continuing the connection attempt.  The default is no wait time
     * (0 seconds).
     */
    IDX_WOL_WAIT_TIME,

    SSH_ARGS_COUNT
};

guac_ssh_settings* guac_ssh_parse_args(guac_user* user,
        int argc, const char** argv) {

    /* Validate arg count */
    if (argc != SSH_ARGS_COUNT) {
        guac_user_log(user, GUAC_LOG_WARNING, "Incorrect number of connection "
                "parameters provided: expected %i, got %i.",
                SSH_ARGS_COUNT, argc);
        return NULL;
    }

    guac_ssh_settings* settings = guac_mem_zalloc(sizeof(guac_ssh_settings));

    /* Read parameters */
    settings->hostname =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_HOSTNAME, "");

    settings->host_key =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_HOST_KEY, NULL);

    settings->username =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_USERNAME, NULL);

    settings->password =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_PASSWORD, NULL);

    /* Init public key auth information */
    settings->key_base64 =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_PRIVATE_KEY, NULL);

    settings->key_passphrase =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_PASSPHRASE, NULL);

    settings->public_key_base64 =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_PUBLIC_KEY, NULL);

    /* Read maximum scrollback size */
    settings->max_scrollback =
        guac_user_parse_args_int(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_SCROLLBACK, GUAC_TERMINAL_DEFAULT_MAX_SCROLLBACK);

    /* Read font name */
    settings->font_name =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_FONT_NAME, GUAC_TERMINAL_DEFAULT_FONT_NAME);

    /* Read font size */
    settings->font_size =
        guac_user_parse_args_int(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_FONT_SIZE, GUAC_TERMINAL_DEFAULT_FONT_SIZE);

    /* Copy requested color scheme */
    settings->color_scheme =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_COLOR_SCHEME, GUAC_TERMINAL_DEFAULT_COLOR_SCHEME);

    /* Pull width/height/resolution directly from user */
    settings->width      = user->info.optimal_width;
    settings->height     = user->info.optimal_height;
    settings->resolution = user->info.optimal_resolution;

    /* Parse SFTP enable */
    settings->enable_sftp =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_ENABLE_SFTP, false);

    /* SFTP root directory */
    settings->sftp_root_directory =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_SFTP_ROOT_DIRECTORY, "/");
    
    /* Disable file downloads. */
    settings->sftp_disable_download =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_SFTP_DISABLE_DOWNLOAD, false);
    
    /* Disable file uploads. */
    settings->sftp_disable_upload =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_SFTP_DISABLE_UPLOAD, false);

#ifdef ENABLE_SSH_AGENT
    settings->enable_agent =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_ENABLE_AGENT, false);
#endif

    /* Read port */
    settings->port =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_PORT, GUAC_SSH_DEFAULT_PORT);

    /* Parse the timeout value. */
    settings->timeout =
        guac_user_parse_args_int(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_TIMEOUT, GUAC_SSH_DEFAULT_TIMEOUT);

    /* Read-only mode */
    settings->read_only =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_READ_ONLY, false);

    /* Read command, if any */
    settings->command =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_COMMAND, NULL);

    /* Read typescript path */
    settings->typescript_path =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_TYPESCRIPT_PATH, NULL);

    /* Read typescript name */
    settings->typescript_name =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_TYPESCRIPT_NAME, GUAC_SSH_DEFAULT_TYPESCRIPT_NAME);

    /* Parse path creation flag */
    settings->create_typescript_path =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_CREATE_TYPESCRIPT_PATH, false);

    /* Parse allow write existing file flag */
    settings->typescript_write_existing =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_TYPESCRIPT_WRITE_EXISTING, false);

    /* Read recording path */
    settings->recording_path =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_RECORDING_PATH, NULL);

    /* Read recording name */
    settings->recording_name =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_RECORDING_NAME, GUAC_SSH_DEFAULT_RECORDING_NAME);

    /* Parse output exclusion flag */
    settings->recording_exclude_output =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_OUTPUT, false);

    /* Parse mouse exclusion flag */
    settings->recording_exclude_mouse =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_MOUSE, false);

    /* Parse key event inclusion flag */
    settings->recording_include_keys =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_RECORDING_INCLUDE_KEYS, false);

    /* Parse path creation flag */
    settings->create_recording_path =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_CREATE_RECORDING_PATH, false);

    /* Parse allow write existing file flag */
    settings->recording_write_existing =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_RECORDING_WRITE_EXISTING, false);

    /* Parse server alive interval */
    settings->server_alive_interval =
        guac_user_parse_args_int(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_SERVER_ALIVE_INTERVAL, 0);

    /* Parse backspace key setting */
    settings->backspace =
        guac_user_parse_args_int(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_BACKSPACE, GUAC_TERMINAL_DEFAULT_BACKSPACE);

    /* Read terminal emulator type. */
    settings->terminal_type =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_TERMINAL_TYPE, "linux");

    /* Read locale */
    settings->locale =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_LOCALE, NULL);

    /* Read the timezone parameter, or use client handshake. */
    settings->timezone =
        guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_TIMEZONE, user->info.timezone);

    /* Parse clipboard copy disable flag */
    settings->disable_copy =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_DISABLE_COPY, false);

    /* Parse clipboard paste disable flag */
    settings->disable_paste =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_DISABLE_PASTE, false);
    
    /* Parse Wake-on-LAN (WoL) parameters. */
    settings->wol_send_packet =
        guac_user_parse_args_boolean(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_WOL_SEND_PACKET, false);
    
    if (settings->wol_send_packet) {
        
        if (strcmp(argv[IDX_WOL_MAC_ADDR], "") == 0) {
            guac_user_log(user, GUAC_LOG_WARNING, "WoL was enabled, but no ",
                    "MAC address was provide.  WoL will not be sent.");
            settings->wol_send_packet = false;
        }
        
        settings->wol_mac_addr =
            guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_WOL_MAC_ADDR, NULL);
        
        settings->wol_broadcast_addr =
            guac_user_parse_args_string(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_WOL_BROADCAST_ADDR, GUAC_WOL_LOCAL_IPV4_BROADCAST);
        
        settings->wol_udp_port = (unsigned short)
            guac_user_parse_args_int(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_WOL_UDP_PORT, GUAC_WOL_PORT);
        
        settings->wol_wait_time =
            guac_user_parse_args_int(user, GUAC_SSH_CLIENT_ARGS, argv,
                IDX_WOL_WAIT_TIME, GUAC_WOL_DEFAULT_BOOT_WAIT_TIME);
        
    }

    /* Parsing was successful */
    return settings;

}

void guac_ssh_settings_free(guac_ssh_settings* settings) {

    /* Free network connection information */
    guac_mem_free(settings->hostname);
    guac_mem_free(settings->host_key);
    guac_mem_free(settings->port);

    /* Free credentials */
    guac_mem_free(settings->username);
    guac_mem_free(settings->password);
    guac_mem_free(settings->key_base64);
    guac_mem_free(settings->key_passphrase);
    guac_mem_free(settings->public_key_base64);

    /* Free display preferences */
    guac_mem_free(settings->font_name);
    guac_mem_free(settings->color_scheme);

    /* Free requested command */
    guac_mem_free(settings->command);

    /* Free SFTP settings */
    guac_mem_free(settings->sftp_root_directory);

    /* Free typescript settings */
    guac_mem_free(settings->typescript_name);
    guac_mem_free(settings->typescript_path);

    /* Free screen recording settings */
    guac_mem_free(settings->recording_name);
    guac_mem_free(settings->recording_path);

    /* Free terminal emulator type. */
    guac_mem_free(settings->terminal_type);

    /* Free locale */
    guac_mem_free(settings->locale);

    /* Free the client timezone. */
    guac_mem_free(settings->timezone);
    
    /* Free Wake-on-LAN settings. */
    guac_mem_free(settings->wol_mac_addr);
    guac_mem_free(settings->wol_broadcast_addr);

    /* Free overall structure */
    guac_mem_free(settings);

}
