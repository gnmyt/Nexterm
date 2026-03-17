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
#include "common/defaults.h"
#include "common/string.h"
#include "config.h"
#include "rdp.h"
#include "resolution.h"
#include "settings.h"

#include <freerdp/constants.h>
#include <freerdp/settings.h>
#include <freerdp/freerdp.h>
#include <guacamole/client.h>
#include <guacamole/mem.h>
#include <guacamole/fips.h>
#include <guacamole/string.h>
#include <guacamole/user.h>
#include <guacamole/wol-constants.h>
#include <winpr/crt.h>
#include <winpr/wtypes.h>

#include <errno.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>

/**
 * A warning to log when NLA mode is selected while FIPS mode is active on the
 * guacd server.
 */
const char fips_nla_mode_warning[] = (
        "NLA security mode was selected, but is known to be currently incompatible "
        "with FIPS mode (see FreeRDP/FreeRDP#3412). Security negotiation with the "
        "RDP server may fail unless TLS security mode is selected instead."
);

/* Client plugin arguments */
const char* GUAC_RDP_CLIENT_ARGS[] = {
    "hostname",
    "port",
    "timeout",
    GUAC_RDP_ARGV_DOMAIN,
    GUAC_RDP_ARGV_USERNAME,
    GUAC_RDP_ARGV_PASSWORD,
    "width",
    "height",
    "dpi",
    "initial-program",
    "color-depth",
    "disable-audio",
    "enable-printing",
    "printer-name",
    "enable-drive",
    "drive-name",
    "drive-path",
    "create-drive-path",
    "disable-download",
    "disable-upload",
    "console",
    "console-audio",
    "server-layout",
    "security",
    "ignore-cert",
    "cert-tofu",
    "cert-fingerprints",
    "disable-auth",
    "remote-app",
    "remote-app-dir",
    "remote-app-args",
    "static-channels",
    "client-name",
    "enable-wallpaper",
    "enable-theming",
    "enable-font-smoothing",
    "enable-full-window-drag",
    "enable-desktop-composition",
    "enable-menu-animations",
    "disable-bitmap-caching",
    "disable-offscreen-caching",
    "disable-glyph-caching",
    "disable-gfx",
    "preconnection-id",
    "preconnection-blob",
    "timezone",

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
    "recording-exclude-touch",
    "recording-include-keys",
    "create-recording-path",
    "recording-write-existing",
    "resize-method",
    "enable-audio-input",
    "enable-touch",
    "read-only",

    "gateway-hostname",
    "gateway-port",
    "gateway-domain",
    "gateway-username",
    "gateway-password",

    "load-balance-info",

    "disable-copy",
    "disable-paste",
    
    "wol-send-packet",
    "wol-mac-addr",
    "wol-broadcast-addr",
    "wol-udp-port",
    "wol-wait-time",

    "force-lossless",
    "normalize-clipboard",
    NULL
};

enum RDP_ARGS_IDX {
    
    /**
     * The hostname to connect to.
     */
    IDX_HOSTNAME,

    /**
     * The port to connect to. If omitted, the default RDP port of 3389 will be
     * used.
     */
    IDX_PORT,

    /**
     * The amount of time to wait for the server to respond, in seconds.
     */
    IDX_TIMEOUT,

    /**
     * The domain of the user logging in.
     */
    IDX_DOMAIN,

    /**
     * The username of the user logging in.
     */
    IDX_USERNAME,

    /**
     * The password of the user logging in.
     */
    IDX_PASSWORD,

    /**
     * The width of the display to request, in pixels. If omitted, a reasonable
     * value will be calculated based on the user's own display size and
     * resolution.
     */
    IDX_WIDTH,

    /**
     * The height of the display to request, in pixels. If omitted, a
     * reasonable value will be calculated based on the user's own display
     * size and resolution.
     */
    IDX_HEIGHT,

    /**
     * The resolution of the display to request, in DPI. If omitted, a
     * reasonable value will be calculated based on the user's own display
     * size and resolution.
     */
    IDX_DPI,

    /**
     * The initial program to run, if any.
     */
    IDX_INITIAL_PROGRAM,

    /**
     * The color depth of the display to request, in bits.
     */
    IDX_COLOR_DEPTH,

    /**
     * "true" if audio should be disabled, "false" or blank to leave audio
     * enabled.
     */
    IDX_DISABLE_AUDIO,

    /**
     * "true" if printing should be enabled, "false" or blank otherwise.
     */
    IDX_ENABLE_PRINTING,

    /**
     * The name of the printer that will be passed through to the RDP server.
     */
    IDX_PRINTER_NAME,

    /**
     * "true" if the virtual drive should be enabled, "false" or blank
     * otherwise.
     */
    IDX_ENABLE_DRIVE,
    
    /**
     * The name of the virtual driver that will be passed through to the
     * RDP connection.
     */
    IDX_DRIVE_NAME,

    /**
     * The local system path which will be used to persist the
     * virtual drive. This must be specified if the virtual drive is enabled.
     */
    IDX_DRIVE_PATH,

    /**
     * "true" to automatically create the local system path used by the virtual
     * drive if it does not yet exist, "false" or blank otherwise.
     */
    IDX_CREATE_DRIVE_PATH,
    
    /**
     * "true" to disable the ability to download files from a remote server to
     * the local client over RDP, "false" or blank otherwise.
     */
    IDX_DISABLE_DOWNLOAD,
    
    /**
     * "true" to disable the ability to upload files from the local client to
     * the remote server over RDP, "false" or blank otherwise.
     */
    IDX_DISABLE_UPLOAD,

    /**
     * "true" if this session is a console session, "false" or blank otherwise.
     */
    IDX_CONSOLE,

    /**
     * "true" if audio should be allowed in console sessions, "false" or blank
     * otherwise.
     */
    IDX_CONSOLE_AUDIO,

    /**
     * The name of the keymap chosen as the layout of the server. Legal names
     * are defined within the *.keymap files in the "keymaps" directory of the
     * source for Guacamole's RDP support.
     */
    IDX_SERVER_LAYOUT,

    /**
     * The type of security to use for the connection. Valid values are "rdp",
     * "tls", "nla", "nla-ext", "vmconnect", or "any". By default, the security
     * mode is negotiated ("any").
     */
    IDX_SECURITY,

    /**
     * "true" if validity of the RDP server's certificate should be ignored,
     * "false" or blank if invalid certificates should result in a failure to
     * connect.
     */
    IDX_IGNORE_CERT,

    /**
     * "true" if a server certificate should be trusted the first time that
     * a connection is established, and then subsequently checked for validity,
     * or "false" if that behavior should not be forced. Whether or not the
     * connection succeeds will be dependent upon other certificate settings,
     * like ignore and/or provided fingerprints.
     */
    IDX_CERTIFICATE_TOFU,

    /**
     * A comma-separate list of fingerprints of certificates that should be
     * trusted when establishing this RDP connection.
     */
    IDX_CERTIFICATE_FINGERPRINTS,

    /**
     * "true" if authentication should be disabled, "false" or blank otherwise.
     * This is different from the authentication that takes place when a user
     * provides their username and password. Authentication is required by
     * definition for NLA.
     */
    IDX_DISABLE_AUTH,

    /**
     * The application to launch, if RemoteApp is in use.
     */
    IDX_REMOTE_APP,

    /**
     * The working directory of the remote application, if RemoteApp is in use.
     */
    IDX_REMOTE_APP_DIR,

    /**
     * The arguments to pass to the remote application, if RemoteApp is in use.
     */
    IDX_REMOTE_APP_ARGS,

    /**
     * Comma-separated list of the names of all static virtual channels that
     * should be connected to and exposed as Guacamole pipe streams, or blank
     * if no static virtual channels should be used. 
     */
    IDX_STATIC_CHANNELS,

    /**
     * The name of the client to submit to the RDP server upon connection.
     */
    IDX_CLIENT_NAME,

    /**
     * "true" if the desktop wallpaper should be visible, "false" or blank if
     * the desktop wallpaper should be hidden.
     */
    IDX_ENABLE_WALLPAPER,

    /**
     * "true" if desktop and window theming should be allowed, "false" or blank
     * if theming should be temporarily disabled on the desktop of the RDP
     * server for the sake of performance.
     */
    IDX_ENABLE_THEMING,

    /**
     * "true" if glyphs should be smoothed with antialiasing (ClearType),
     * "false" or blank if glyphs should be rendered with sharp edges and using
     * single colors, effectively 1-bit images.
     */
    IDX_ENABLE_FONT_SMOOTHING,

    /**
     * "true" if windows' contents should be shown as they are moved, "false"
     * or blank if only a window border should be shown during window move
     * operations.
     */
    IDX_ENABLE_FULL_WINDOW_DRAG,

    /**
     * "true" if desktop composition (Aero) should be enabled during the
     * session, "false" or blank otherwise. As desktop composition provides
     * alpha blending and other special effects, this increases the amount of
     * bandwidth used.
     */
    IDX_ENABLE_DESKTOP_COMPOSITION,

    /**
     * "true" if menu animations should be shown, "false" or blank menus should
     * not be animated.
     */
    IDX_ENABLE_MENU_ANIMATIONS,

    /**
     * "true" if bitmap caching should be disabled, "false" if bitmap caching
     * should remain enabled.
     */
    IDX_DISABLE_BITMAP_CACHING,

    /**
     * "true" if the offscreen caching should be disabled, false if offscreen
     * caching should remain enabled.
     */
    IDX_DISABLE_OFFSCREEN_CACHING,

    /**
     * "true" if glyph caching should be disabled, false if glyph caching should
     * remain enabled.
     */
    IDX_DISABLE_GLYPH_CACHING,

    /**
     * "true" if the RDP Graphics Pipeline Extension should not be used, and
     * traditional RDP graphics should be used instead, "false" or blank if the
     * Graphics Pipeline Extension should be used if available.
     */
    IDX_DISABLE_GFX,

    /**
     * The preconnection ID to send within the preconnection PDU when
     * initiating an RDP connection, if any.
     */
    IDX_PRECONNECTION_ID,

    /**
     * The preconnection BLOB (PCB) to send to the RDP server prior to full RDP
     * connection negotiation. This value is used by Hyper-V to select the
     * destination VM.
     */
    IDX_PRECONNECTION_BLOB,

    /**
     * The timezone to pass through to the RDP connection, in IANA format, which
     * will be translated into Windows formats. See the following page for
     * information and list of valid values:
     * https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
     */
    IDX_TIMEZONE,

#ifdef ENABLE_COMMON_SSH
    /**
     * "true" if SFTP should be enabled for the RDP connection, "false" or
     * blank otherwise.
     */
    IDX_ENABLE_SFTP,

    /**
     * The hostname of the SSH server to connect to for SFTP. If blank, the
     * hostname of the RDP server will be used.
     */
    IDX_SFTP_HOSTNAME,

    /**
     * The public SSH host key of the SFTP server. Optional.
     */
    IDX_SFTP_HOST_KEY,

    /**
     * The port of the SSH server to connect to for SFTP. If blank, the default
     * SSH port of "22" will be used.
     */
    IDX_SFTP_PORT,

    /**
     * The number of seconds to attempt to connect to the SSH server before
     * timing out.
     */
    IDX_SFTP_TIMEOUT,

    /**
     * The username to provide when authenticating with the SSH server for
     * SFTP. If blank, the username provided for the RDP user will be used.
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
     * The base64-encoded public key to use when authenticating with the SSH
     * server for SFTP.
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
     * SFTP connections. The default is 0 (disabling keepalives), and a value
     * of 1 is automatically increased to 2 by libssh2 to avoid busy loop corner
     * cases.
     */
    IDX_SFTP_SERVER_ALIVE_INTERVAL,
    
    /**
     * "true" to disable file download from the SFTP server to the local client
     * over the SFTP connection, if SFTP is configured and enabled.  "false" or
     * blank otherwise.
     */
    IDX_SFTP_DISABLE_DOWNLOAD,
    
    /**
     * "true" to disable file upload from the SFTP server to the local client
     * over the SFTP connection, if SFTP is configured and enabled.  "false" or
     * blank otherwise.
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
     * Whether changes to touch contact state should NOT be included in the
     * session recording. Touch state is included by default, as it may be
     * necessary for touch interactions to be rendered in any resulting video.
     */
    IDX_RECORDING_EXCLUDE_TOUCH,

    /**
     * Whether keys pressed and released should be included in the session
     * recording. Key events are NOT included by default within the recording,
     * as doing so has privacy and security implications. Including key events
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
     * The method to use to apply screen size changes requested by the user.
     * Valid values are blank, "display-update", and "reconnect".
     */
    IDX_RESIZE_METHOD,

    /**
     * "true" if audio input (microphone) should be enabled for the RDP
     * connection, "false" or blank otherwise.
     */
    IDX_ENABLE_AUDIO_INPUT,

    /**
     * "true" if multi-touch support should be enabled for the RDP connection,
     * "false" or blank otherwise.
     */
    IDX_ENABLE_TOUCH,

    /**
     * "true" if this connection should be read-only (user input should be
     * dropped), "false" or blank otherwise.
     */
    IDX_READ_ONLY,

    /**
     * The hostname of the remote desktop gateway that should be used as an
     * intermediary for the remote desktop connection. If omitted, a gateway
     * will not be used.
     */
    IDX_GATEWAY_HOSTNAME,

    /**
     * The port of the remote desktop gateway that should be used as an
     * intermediary for the remote desktop connection. By default, this will be
     * 443.
     *
     * NOTE: If using a version of FreeRDP prior to 1.2, this setting has no
     * effect. FreeRDP instead uses a hard-coded value of 443.
     */
    IDX_GATEWAY_PORT,

    /**
     * The domain of the user authenticating with the remote desktop gateway,
     * if a gateway is being used. This is not necessarily the same as the
     * user actually using the remote desktop connection.
     */
    IDX_GATEWAY_DOMAIN,

    /**
     * The username of the user authenticating with the remote desktop gateway,
     * if a gateway is being used. This is not necessarily the same as the
     * user actually using the remote desktop connection.
     */
    IDX_GATEWAY_USERNAME,

    /**
     * The password to provide when authenticating with the remote desktop
     * gateway, if a gateway is being used.
     */
    IDX_GATEWAY_PASSWORD,

    /**
     * The load balancing information/cookie which should be provided to
     * the connection broker, if a connection broker is being used.
     */
    IDX_LOAD_BALANCE_INFO,

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
     * Whether or not to send the magic Wake-on-LAN (WoL) packet to the host
     * prior to attempting to connect.  Non-zero values will enable sending
     * the WoL packet, while zero will disable this functionality.  By default
     * the WoL packet is not sent.
     */
    IDX_WOL_SEND_PACKET,
    
    /**
     * The MAC address to put in the magic WoL packet for the host that should
     * be woken up.
     */
    IDX_WOL_MAC_ADDR,
    
    /**
     * The broadcast address to which to send the magic WoL packet to wake up
     * the remote host.
     */
    IDX_WOL_BROADCAST_ADDR,
    
    /**
     * The UDP port to use in the magic WoL packet.
     */
    IDX_WOL_UDP_PORT,
    
    /**
     * The amount of time, in seconds, to wait after sending the WoL packet
     * before attempting to connect to the host.  This should be a reasonable
     * amount of time to allow the remote host to fully boot and respond to
     * network connection requests.  The default is not to wait at all
     * (0 seconds).
     */
    IDX_WOL_WAIT_TIME,

    /**
     * "true" if all graphical updates for this connection should use lossless
     * compression only, "false" or blank otherwise.
     */
    IDX_FORCE_LOSSLESS,

    /**
     * Controls whether the text content of the clipboard should be
     * automatically normalized to use a particular line ending format. Valid
     * values are "preserve", to preserve line endings verbatim, "windows" to
     * transform all line endings to Windows-style CRLF sequences, or "unix" to
     * transform all line endings to Unix-style newline characters ('\n'). By
     * default, line endings within the clipboard are preserved.
     */
    IDX_NORMALIZE_CLIPBOARD,

    RDP_ARGS_COUNT
};

guac_rdp_settings* guac_rdp_parse_args(guac_user* user,
        int argc, const char** argv) {

    /* Validate arg count */
    if (argc != RDP_ARGS_COUNT) {
        guac_user_log(user, GUAC_LOG_WARNING, "Incorrect number of connection "
                "parameters provided: expected %i, got %i.",
                RDP_ARGS_COUNT, argc);
        return NULL;
    }

    guac_rdp_settings* settings = guac_mem_zalloc(sizeof(guac_rdp_settings));

    /* Use console */
    settings->console =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_CONSOLE, 0);

    /* Enable/disable console audio */
    settings->console_audio =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_CONSOLE_AUDIO, 0);

    /* Ignore SSL/TLS certificate */
    settings->ignore_certificate =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_IGNORE_CERT, 0);

    /* Add new certificates to trust list */
    settings->certificate_tofu =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_CERTIFICATE_TOFU, 0);

    /* Fingerprints of certificates that should be trusted */
    settings->certificate_fingerprints =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_CERTIFICATE_FINGERPRINTS, NULL);

    /* Disable authentication */
    settings->disable_authentication =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_AUTH, 0);

    /* NLA security */
    if (strcmp(argv[IDX_SECURITY], "nla") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Security mode: NLA");
        settings->security_mode = GUAC_SECURITY_NLA;

        /*
         * NLA is known not to work with FIPS; allow the mode selection but
         * warn that it will not work.
         */
        if (guac_fips_enabled())
            guac_user_log(user, GUAC_LOG_WARNING, fips_nla_mode_warning);

    }

    /* Extended NLA security */
    else if (strcmp(argv[IDX_SECURITY], "nla-ext") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Security mode: Extended NLA");
        settings->security_mode = GUAC_SECURITY_EXTENDED_NLA;

        /*
         * NLA is known not to work with FIPS; allow the mode selection but
         * warn that it will not work.
         */
        if (guac_fips_enabled())
            guac_user_log(user, GUAC_LOG_WARNING, fips_nla_mode_warning);
    }

    /* TLS security */
    else if (strcmp(argv[IDX_SECURITY], "tls") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Security mode: TLS");
        settings->security_mode = GUAC_SECURITY_TLS;
    }

    /* RDP security */
    else if (strcmp(argv[IDX_SECURITY], "rdp") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Security mode: RDP");
        settings->security_mode = GUAC_SECURITY_RDP;
    }

    /* Negotiate security supported by VMConnect */
    else if (strcmp(argv[IDX_SECURITY], "vmconnect") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Security mode: Hyper-V / VMConnect");
        settings->security_mode = GUAC_SECURITY_VMCONNECT;
    }

    /* Negotiate security (allow server to choose) */
    else if (strcmp(argv[IDX_SECURITY], "any") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Security mode: Negotiate (ANY)");
        settings->security_mode = GUAC_SECURITY_ANY;
    }

    /* If nothing given, default to RDP */
    else {
        guac_user_log(user, GUAC_LOG_INFO, "No security mode specified. Defaulting to security mode negotiation with server.");
        settings->security_mode = GUAC_SECURITY_ANY;
    }

    /* Set hostname */
    settings->hostname =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_HOSTNAME, "");

    /* If port specified, use it, otherwise use an appropriate default */
    settings->port =
        guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv, IDX_PORT,
                settings->security_mode == GUAC_SECURITY_VMCONNECT ? RDP_DEFAULT_VMCONNECT_PORT : RDP_DEFAULT_PORT);

    /* Look for timeout settings and parse or set defaults. */
    settings->timeout =
        guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_TIMEOUT, RDP_DEFAULT_TIMEOUT);

    guac_user_log(user, GUAC_LOG_DEBUG,
            "User resolution is %ix%i at %i DPI",
            user->info.optimal_width,
            user->info.optimal_height,
            user->info.optimal_resolution);

    /* Use suggested resolution unless overridden */
    settings->resolution =
        guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DPI, guac_rdp_suggest_resolution(user));

    /* Use optimal width unless overridden */
    settings->width = user->info.optimal_width
                    * settings->resolution
                    / user->info.optimal_resolution;

    if (argv[IDX_WIDTH][0] != '\0')
        settings->width = atoi(argv[IDX_WIDTH]);

    /* Use default width if given width is invalid. */
    if (settings->width <= 0) {
        settings->width = RDP_DEFAULT_WIDTH;
        guac_user_log(user, GUAC_LOG_ERROR,
                "Invalid width: \"%s\". Using default of %i.",
                argv[IDX_WIDTH], settings->width);
    }

    /* Round width down to nearest multiple of 4 */
    settings->width = settings->width & ~0x3;

    /* Use optimal height unless overridden */
    settings->height = user->info.optimal_height
                     * settings->resolution
                     / user->info.optimal_resolution;

    if (argv[IDX_HEIGHT][0] != '\0')
        settings->height = atoi(argv[IDX_HEIGHT]);

    /* Use default height if given height is invalid. */
    if (settings->height <= 0) {
        settings->height = RDP_DEFAULT_HEIGHT;
        guac_user_log(user, GUAC_LOG_ERROR,
                "Invalid height: \"%s\". Using default of %i.",
                argv[IDX_WIDTH], settings->height);
    }

    guac_user_log(user, GUAC_LOG_DEBUG,
            "Using resolution of %ix%i at %i DPI",
            settings->width,
            settings->height,
            settings->resolution);

    /* Lossless compression */
    settings->lossless =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_FORCE_LOSSLESS, 0);

    /* Domain */
    settings->domain =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DOMAIN, NULL);

    /* Username */
    settings->username =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_USERNAME, NULL);

    /* Password */
    settings->password =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_PASSWORD, NULL);

    /* Read-only mode */
    settings->read_only =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_READ_ONLY, 0);

    /* Client name */
    settings->client_name =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_CLIENT_NAME, "Guacamole RDP");

    /* Initial program */
    settings->initial_program =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_INITIAL_PROGRAM, NULL);

    /* RemoteApp program */
    settings->remote_app =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_REMOTE_APP, NULL);

    /* RemoteApp working directory */
    settings->remote_app_dir =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_REMOTE_APP_DIR, NULL);

    /* RemoteApp arguments */
    settings->remote_app_args =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_REMOTE_APP_ARGS, NULL);

    /* Static virtual channels */
    settings->svc_names = NULL;
    if (argv[IDX_STATIC_CHANNELS][0] != '\0')
        settings->svc_names = guac_split(argv[IDX_STATIC_CHANNELS], ',');

    /*
     * Performance flags
     */

    settings->wallpaper_enabled =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_WALLPAPER, 0);

    settings->theming_enabled =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_THEMING, 0);

    settings->font_smoothing_enabled =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_FONT_SMOOTHING, 0);

    settings->full_window_drag_enabled =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_FULL_WINDOW_DRAG, 0);

    settings->desktop_composition_enabled =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_DESKTOP_COMPOSITION, 0);

    settings->menu_animations_enabled =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_MENU_ANIMATIONS, 0);

    settings->disable_bitmap_caching =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_BITMAP_CACHING, 0);

    settings->disable_offscreen_caching =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_OFFSCREEN_CACHING, 0);

    /* FreeRDP does not consider the glyph cache implementation to be stable as
     * of 2.0.0, and it MUST NOT be used. Usage of the glyph cache results in
     * unexpected disconnects when using older versions of Windows and recent
     * versions of FreeRDP. See: https://issues.apache.org/jira/browse/GUACAMOLE-1191 */
    settings->disable_glyph_caching = 1;

    /* In case the user expects glyph caching to be enabled, either explicitly
     * or by default, warn that this will not be the case as the glyph cache
     * is not considered stable. */
    if (!guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
            IDX_DISABLE_GLYPH_CACHING, 0)) {
        guac_user_log(user, GUAC_LOG_DEBUG, "Glyph caching is currently "
                "universally disabled, regardless of the value of the \"%s\" "
                "parameter, as glyph caching support is not considered stable "
                "by FreeRDP as of the FreeRDP 2.0.0 release. See: "
                "https://issues.apache.org/jira/browse/GUACAMOLE-1191",
                GUAC_RDP_CLIENT_ARGS[IDX_DISABLE_GLYPH_CACHING]);
    }

    /* Preconnection ID */
    settings->preconnection_id = -1;
    if (argv[IDX_PRECONNECTION_ID][0] != '\0') {

        /* Parse preconnection ID, warn if invalid */
        int preconnection_id = atoi(argv[IDX_PRECONNECTION_ID]);
        if (preconnection_id < 0)
            guac_user_log(user, GUAC_LOG_WARNING,
                    "Ignoring invalid preconnection ID: %i",
                    preconnection_id);

        /* Otherwise, assign specified ID */
        else {
            settings->preconnection_id = preconnection_id;
            guac_user_log(user, GUAC_LOG_DEBUG,
                    "Preconnection ID: %i", settings->preconnection_id);
        }

    }

    /* Preconnection BLOB */
    settings->preconnection_blob = NULL;
    if (argv[IDX_PRECONNECTION_BLOB][0] != '\0') {
        settings->preconnection_blob = guac_strdup(argv[IDX_PRECONNECTION_BLOB]);
        guac_user_log(user, GUAC_LOG_DEBUG,
                "Preconnection BLOB: \"%s\"", settings->preconnection_blob);
    }

    /* Audio enable/disable */
    settings->audio_enabled =
        !guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_AUDIO, 0);

    /* Printing enable/disable */
    settings->printing_enabled =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_PRINTING, 0);

    /* Name of redirected printer */
    settings->printer_name =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_PRINTER_NAME, "Guacamole Printer");

    /* Drive enable/disable */
    settings->drive_enabled =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_DRIVE, 0);
    
    /* Name of the drive being passed through */
    settings->drive_name =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DRIVE_NAME, "Guacamole Filesystem");

    /* The path on the server to connect the drive. */
    settings->drive_path =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DRIVE_PATH, "");

    /* If the server path should be created if it doesn't already exist. */
    settings->create_drive_path =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_CREATE_DRIVE_PATH, 0);
    
    /* If file downloads over RDP should be disabled. */
    settings->disable_download =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_DOWNLOAD, 0);
    
    /* If file uploads over RDP should be disabled. */
    settings->disable_upload =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_UPLOAD, 0);

    /* Pick keymap based on argument */
    settings->server_layout = NULL;
    if (argv[IDX_SERVER_LAYOUT][0] != '\0')
        settings->server_layout =
            guac_rdp_keymap_find(argv[IDX_SERVER_LAYOUT]);

    /* If no keymap requested, use default */
    if (settings->server_layout == NULL)
        settings->server_layout = guac_rdp_keymap_find(GUAC_DEFAULT_KEYMAP);

    /* Timezone if provided by client, or use handshake version */
    settings->timezone =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_TIMEZONE, user->info.timezone);

#ifdef ENABLE_COMMON_SSH
    /* SFTP enable/disable */
    settings->enable_sftp =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_SFTP, 0);

    /* Hostname for SFTP connection */
    settings->sftp_hostname =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_HOSTNAME, settings->hostname);

    /* The public SSH host key. */
    settings->sftp_host_key =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_HOST_KEY, NULL);

    /* Port for SFTP connection */
    settings->sftp_port =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_PORT, "22");

    /* SFTP timeout */
    settings->sftp_timeout =
        guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_TIMEOUT, RDP_DEFAULT_SFTP_TIMEOUT);

    /* Username for SSH/SFTP authentication */
    settings->sftp_username =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_USERNAME,
                settings->username != NULL ? settings->username : "");

    /* Password for SFTP (if not using private key) */
    settings->sftp_password =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_PASSWORD, "");

    /* Private key for SFTP (if not using password) */
    settings->sftp_private_key =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_PRIVATE_KEY, NULL);

    /* Passphrase for decrypting the SFTP private key (if applicable) */
    settings->sftp_passphrase =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_PASSPHRASE, "");

    /* Public key for authenticating to SFTP server, if applicable. */
    settings->sftp_public_key =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_PUBLIC_KEY, NULL);

    /* Default upload directory */
    settings->sftp_directory =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_DIRECTORY, NULL);

    /* SFTP root directory */
    settings->sftp_root_directory =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_ROOT_DIRECTORY, "/");

    /* Default keepalive value */
    settings->sftp_server_alive_interval =
        guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_SERVER_ALIVE_INTERVAL, 0);
    
    /* Whether or not to disable file download over SFTP. */
    settings->sftp_disable_download =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_DISABLE_DOWNLOAD, 0);
    
    /* Whether or not to disable file upload over SFTP. */
    settings->sftp_disable_upload =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_SFTP_DISABLE_UPLOAD, 0);
#endif

    /* Read recording path */
    settings->recording_path =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_RECORDING_PATH, NULL);

    /* Read recording name */
    settings->recording_name =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_RECORDING_NAME, GUAC_RDP_DEFAULT_RECORDING_NAME);

    /* Parse output exclusion flag */
    settings->recording_exclude_output =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_OUTPUT, 0);

    /* Parse mouse exclusion flag */
    settings->recording_exclude_mouse =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_MOUSE, 0);

    /* Parse touch exclusion flag */
    settings->recording_exclude_touch =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_TOUCH, 0);

    /* Parse key event inclusion flag */
    settings->recording_include_keys =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_RECORDING_INCLUDE_KEYS, 0);

    /* Parse path creation flag */
    settings->create_recording_path =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_CREATE_RECORDING_PATH, 0);

    /* Parse allow write existing file flag */
    settings->recording_write_existing =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_RECORDING_WRITE_EXISTING, 0);

    /* No resize method */
    if (strcmp(argv[IDX_RESIZE_METHOD], "") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Resize method: none");
        settings->resize_method = GUAC_RESIZE_NONE;
    }

    /* Resize method: "reconnect" */
    else if (strcmp(argv[IDX_RESIZE_METHOD], "reconnect") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Resize method: reconnect");
        settings->resize_method = GUAC_RESIZE_RECONNECT;
    }

    /* Resize method: "display-update" */
    else if (strcmp(argv[IDX_RESIZE_METHOD], "display-update") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Resize method: display-update");
        settings->resize_method = GUAC_RESIZE_DISPLAY_UPDATE;
    }

    /* Default to no resize method if invalid */
    else {
        guac_user_log(user, GUAC_LOG_INFO, "Resize method \"%s\" invalid. ",
                "Defaulting to no resize method.", argv[IDX_RESIZE_METHOD]);
        settings->resize_method = GUAC_RESIZE_NONE;
    }

    /* RDP Graphics Pipeline enable/disable */
    settings->enable_gfx =
        !guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_GFX, 0);

    /* Session color depth */
    settings->color_depth =
        guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_COLOR_DEPTH, settings->enable_gfx ? RDP_GFX_REQUIRED_DEPTH : RDP_DEFAULT_DEPTH);

    /* Multi-touch input enable/disable */
    settings->enable_touch =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_TOUCH, 0);

    /* Audio input enable/disable */
    settings->enable_audio_input =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_ENABLE_AUDIO_INPUT, 0);

    /* Set gateway hostname */
    settings->gateway_hostname =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_GATEWAY_HOSTNAME, NULL);

    /* If gateway port specified, use it */
    settings->gateway_port =
        guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_GATEWAY_PORT, 443);

    /* Set gateway domain */
    settings->gateway_domain =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_GATEWAY_DOMAIN, NULL);

    /* Set gateway username */
    settings->gateway_username =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_GATEWAY_USERNAME, NULL);

    /* Set gateway password */
    settings->gateway_password =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_GATEWAY_PASSWORD, NULL);

    /* Set load balance info */
    settings->load_balance_info =
        guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_LOAD_BALANCE_INFO, NULL);

    /* Parse clipboard copy disable flag */
    settings->disable_copy =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_COPY, 0);

    /* Parse clipboard paste disable flag */
    settings->disable_paste =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_DISABLE_PASTE, 0);

    /* Normalize clipboard line endings to Unix format */
    if (strcmp(argv[IDX_NORMALIZE_CLIPBOARD], "unix") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Clipboard line ending normalization: Unix (LF)");
        settings->normalize_clipboard = 1;
        settings->clipboard_crlf = 0;
    }

    /* Normalize clipboard line endings to Windows format */
    else if (strcmp(argv[IDX_NORMALIZE_CLIPBOARD], "windows") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Clipboard line ending normalization: Windows (CRLF)");
        settings->normalize_clipboard = 1;
        settings->clipboard_crlf = 1;
    }

    /* Preserve clipboard line ending format */
    else if (strcmp(argv[IDX_NORMALIZE_CLIPBOARD], "preserve") == 0) {
        guac_user_log(user, GUAC_LOG_INFO, "Clipboard line ending normalization: Preserve (none)");
        settings->normalize_clipboard = 0;
        settings->clipboard_crlf = 0;
    }

    /* If nothing given, default to preserving line endings */
    else {
        guac_user_log(user, GUAC_LOG_INFO, "No clipboard line-ending normalization specified. Defaulting to preserving the format of all line endings.");
        settings->normalize_clipboard = 0;
        settings->clipboard_crlf = 0;
    }

    /* Parse Wake-on-LAN (WoL) settings */
    settings->wol_send_packet =
        guac_user_parse_args_boolean(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_WOL_SEND_PACKET, 0);
    
    if (settings->wol_send_packet) {
        
        /* If WoL has been requested but no MAC address given, log a warning. */
        if(strcmp(argv[IDX_WOL_MAC_ADDR], "") == 0) {
            guac_user_log(user, GUAC_LOG_WARNING, "WoL requested but no MAC ",
                    "address specified.  WoL will not be sent.");
            settings->wol_send_packet = 0;
        }
        
        /* Parse the WoL MAC address. */
        settings->wol_mac_addr = 
            guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_WOL_MAC_ADDR, NULL);
        
        /* Parse the WoL broadcast address. */
        settings->wol_broadcast_addr =
            guac_user_parse_args_string(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_WOL_BROADCAST_ADDR, GUAC_WOL_LOCAL_IPV4_BROADCAST);
        
        /* Parse the WoL broadcast port. */
        settings->wol_udp_port = (unsigned short)
            guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_WOL_UDP_PORT, GUAC_WOL_PORT);
        
        /* Parse the WoL wait time. */
        settings->wol_wait_time =
            guac_user_parse_args_int(user, GUAC_RDP_CLIENT_ARGS, argv,
                IDX_WOL_WAIT_TIME, GUAC_WOL_DEFAULT_BOOT_WAIT_TIME);
        
    }

    /* Success */
    return settings;

}

void guac_rdp_settings_free(guac_rdp_settings* settings) {

    /* Free settings strings */
    guac_mem_free(settings->client_name);
    guac_mem_free(settings->domain);
    guac_mem_free(settings->drive_name);
    guac_mem_free(settings->drive_path);
    guac_mem_free(settings->hostname);
    guac_mem_free(settings->certificate_fingerprints);
    guac_mem_free(settings->initial_program);
    guac_mem_free(settings->password);
    guac_mem_free(settings->preconnection_blob);
    guac_mem_free(settings->recording_name);
    guac_mem_free(settings->recording_path);
    guac_mem_free(settings->remote_app);
    guac_mem_free(settings->remote_app_args);
    guac_mem_free(settings->remote_app_dir);
    guac_mem_free(settings->timezone);
    guac_mem_free(settings->username);
    guac_mem_free(settings->printer_name);

    /* Free channel name array */
    if (settings->svc_names != NULL) {

        /* Free all elements of array */
        char** current = &(settings->svc_names[0]);
        while (*current != NULL) {
            guac_mem_free(*current);
            current++;
        }

        /* Free array itself */
        guac_mem_free(settings->svc_names);

    }

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

    /* Free RD gateway information */
    guac_mem_free(settings->gateway_hostname);
    guac_mem_free(settings->gateway_domain);
    guac_mem_free(settings->gateway_username);
    guac_mem_free(settings->gateway_password);

    /* Free load balancer information string */
    guac_mem_free(settings->load_balance_info);
    
    /* Free Wake-on-LAN strings */
    guac_mem_free(settings->wol_mac_addr);
    guac_mem_free(settings->wol_broadcast_addr);

    /* Free settings structure */
    guac_mem_free(settings);

}

/**
 * Given the settings structure of the Guacamole RDP client, calculates the
 * standard performance flag value to send to the RDP server. The value of
 * these flags is dictated by the RDP standard.
 *
 * @param guac_settings
 *     The settings structure to read performance settings from.
 *
 * @returns
 *     The standard RDP performance flag value representing the union of all
 *     performance settings within the given settings structure.
 */
static int guac_rdp_get_performance_flags(guac_rdp_settings* guac_settings) {

    /* No performance flags initially */
    int flags = PERF_FLAG_NONE;

    /* Desktop wallpaper */
    if (!guac_settings->wallpaper_enabled)
        flags |= PERF_DISABLE_WALLPAPER;

    /* Theming of desktop/windows */
    if (!guac_settings->theming_enabled)
        flags |= PERF_DISABLE_THEMING;

    /* Font smoothing (ClearType) */
    if (guac_settings->font_smoothing_enabled)
        flags |= PERF_ENABLE_FONT_SMOOTHING;

    /* Full-window drag */
    if (!guac_settings->full_window_drag_enabled)
        flags |= PERF_DISABLE_FULLWINDOWDRAG;

    /* Desktop composition (Aero) */
    if (guac_settings->desktop_composition_enabled)
        flags |= PERF_ENABLE_DESKTOP_COMPOSITION;

    /* Menu animations */
    if (!guac_settings->menu_animations_enabled)
        flags |= PERF_DISABLE_MENUANIMATIONS;

    return flags;

}

int guac_rdp_get_width(freerdp* rdp) {
#ifdef HAVE_SETTERS_GETTERS
    return freerdp_settings_get_uint32(rdp->context->settings, FreeRDP_DesktopWidth);
#else
    return rdp->settings->DesktopWidth;
#endif
}

int guac_rdp_get_height(freerdp* rdp) {
#ifdef HAVE_SETTERS_GETTERS
    return freerdp_settings_get_uint32(rdp->context->settings, FreeRDP_DesktopHeight);
#else
    return rdp->settings->DesktopHeight;
#endif
}

int guac_rdp_get_depth(freerdp* rdp) {
#ifdef HAVE_SETTERS_GETTERS
    return freerdp_settings_get_uint32(rdp->context->settings, FreeRDP_ColorDepth);
#else
    return rdp->settings->ColorDepth;
#endif
}

void guac_rdp_push_settings(guac_client* client,
        guac_rdp_settings* guac_settings, freerdp* rdp) {

    rdpSettings* rdp_settings = GUAC_RDP_CONTEXT(rdp)->settings;

#ifdef HAVE_SETTERS_GETTERS
    /* Authentication */
    freerdp_settings_set_string(rdp_settings, FreeRDP_Domain, guac_strdup(guac_settings->domain));
    freerdp_settings_set_string(rdp_settings, FreeRDP_Username, guac_strdup(guac_settings->username));
    freerdp_settings_set_string(rdp_settings, FreeRDP_Password, guac_strdup(guac_settings->password));

    /* Connection */
    freerdp_settings_set_string(rdp_settings, FreeRDP_ServerHostname, guac_strdup(guac_settings->hostname));
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_ServerPort, guac_settings->port);

    /* Session */

    freerdp_settings_set_uint32(rdp_settings, FreeRDP_DesktopWidth, guac_settings->width);
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_DesktopHeight, guac_settings->height);
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_ColorDepth, guac_settings->color_depth);
    freerdp_settings_set_string(rdp_settings, FreeRDP_AlternateShell, guac_strdup(guac_settings->initial_program));
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_KeyboardLayout, guac_settings->server_layout->freerdp_keyboard_layout);


    /* Performance flags */
    /* Explicitly set flag value */
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_PerformanceFlags, guac_rdp_get_performance_flags(guac_settings));

    /* Set explicit connection type to LAN to prevent auto-detection */
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_ConnectionType, CONNECTION_TYPE_LAN);

    /* Always request frame markers */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_FrameMarkerCommandEnabled, TRUE);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_SurfaceFrameMarkerEnabled, TRUE);

    freerdp_settings_set_bool(rdp_settings, FreeRDP_FastPathInput, TRUE);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_FastPathOutput, TRUE);

    /* Enable RemoteFX / Graphics Pipeline */
    if (guac_settings->enable_gfx) {

        freerdp_settings_set_bool(rdp_settings, FreeRDP_SupportGraphicsPipeline, TRUE);
        freerdp_settings_set_bool(rdp_settings, FreeRDP_RemoteFxCodec, TRUE);

        if (freerdp_settings_get_uint32(rdp_settings, FreeRDP_ColorDepth) != RDP_GFX_REQUIRED_DEPTH) {
            guac_client_log(client, GUAC_LOG_WARNING, "Ignoring requested "
                    "color depth of %i bpp, as the RDP Graphics Pipeline "
                    "requires %i bpp.", freerdp_settings_get_uint32(rdp_settings, FreeRDP_ColorDepth), RDP_GFX_REQUIRED_DEPTH);
        }

        /* Required for RemoteFX / Graphics Pipeline */
        freerdp_settings_set_uint32(rdp_settings, FreeRDP_ColorDepth, RDP_GFX_REQUIRED_DEPTH);
        freerdp_settings_set_bool(rdp_settings, FreeRDP_SoftwareGdi, TRUE);

    }

    /* Set individual flags - some FreeRDP versions overwrite flags set by guac_rdp_get_performance_flags() above */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_AllowFontSmoothing, guac_settings->font_smoothing_enabled);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_DisableWallpaper, !guac_settings->wallpaper_enabled);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_DisableFullWindowDrag, !guac_settings->full_window_drag_enabled);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_DisableMenuAnims, !guac_settings->menu_animations_enabled);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_DisableThemes, !guac_settings->theming_enabled);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_AllowDesktopComposition, guac_settings->desktop_composition_enabled);

    /* Client name */
    if (guac_settings->client_name != NULL) {
        freerdp_settings_set_string(rdp_settings, FreeRDP_ClientHostname, 
                guac_strndup(guac_settings->client_name, RDP_CLIENT_HOSTNAME_SIZE));
    }

    /* Console */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_ConsoleSession, guac_settings->console);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_RemoteConsoleAudio, guac_settings->console_audio);

    /* Audio */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_AudioPlayback, guac_settings->audio_enabled);

    /* Audio capture */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_AudioCapture, guac_settings->enable_audio_input);

    /* Display Update channel */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_SupportDisplayControl, 
            (guac_settings->resize_method == GUAC_RESIZE_DISPLAY_UPDATE));

    /* Timezone redirection */
    if (guac_settings->timezone) {
        if (setenv("TZ", guac_settings->timezone, 1)) {
            guac_client_log(client, GUAC_LOG_WARNING,
                "Unable to forward timezone: TZ environment variable "
                "could not be set: %s", strerror(errno));
        }
    }

    /* Device redirection */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_DeviceRedirection, 
            (guac_settings->audio_enabled || guac_settings->drive_enabled || guac_settings->printing_enabled));

    /* Security */
    switch (guac_settings->security_mode) {

        /* Legacy RDP encryption */
        case GUAC_SECURITY_RDP:
            freerdp_settings_set_bool(rdp_settings, FreeRDP_RdpSecurity, TRUE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_TlsSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_NlaSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_ExtSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_UseRdpSecurityLayer, TRUE);
            freerdp_settings_set_uint32(rdp_settings, FreeRDP_EncryptionLevel, 
                    ENCRYPTION_LEVEL_CLIENT_COMPATIBLE);
            freerdp_settings_set_uint32(rdp_settings, FreeRDP_EncryptionMethods, 
                    ENCRYPTION_METHOD_40BIT | ENCRYPTION_METHOD_128BIT | ENCRYPTION_METHOD_FIPS);
            break;

        /* TLS encryption */
        case GUAC_SECURITY_TLS:
            freerdp_settings_set_bool(rdp_settings, FreeRDP_RdpSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_TlsSecurity, TRUE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_NlaSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_ExtSecurity, FALSE);
            break;

        /* Network level authentication */
        case GUAC_SECURITY_NLA:
            freerdp_settings_set_bool(rdp_settings, FreeRDP_RdpSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_TlsSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_NlaSecurity, TRUE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_ExtSecurity, FALSE);
            break;

        /* Extended network level authentication */
        case GUAC_SECURITY_EXTENDED_NLA:
            freerdp_settings_set_bool(rdp_settings, FreeRDP_RdpSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_TlsSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_NlaSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_ExtSecurity, TRUE);
            break;

        /* Hyper-V "VMConnect" negotiation mode */
        case GUAC_SECURITY_VMCONNECT:
            freerdp_settings_set_bool(rdp_settings, FreeRDP_RdpSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_TlsSecurity, TRUE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_NlaSecurity, TRUE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_ExtSecurity, FALSE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_VmConnectMode, TRUE);
            break;

        /* All security types */
        case GUAC_SECURITY_ANY:
            freerdp_settings_set_bool(rdp_settings, FreeRDP_RdpSecurity, TRUE);
            freerdp_settings_set_bool(rdp_settings, FreeRDP_TlsSecurity, TRUE);

            /* Explicitly disable NLA if FIPS mode is enabled - it won't work */
            if (guac_fips_enabled()) {

                guac_client_log(client, GUAC_LOG_INFO,
                        "FIPS mode is enabled. Excluding NLA security mode from security negotiation "
                        "(see: https://github.com/FreeRDP/FreeRDP/issues/3412).");
                freerdp_settings_set_bool(rdp_settings, FreeRDP_NlaSecurity, FALSE);

            }

            /* NLA mode is allowed if FIPS is not enabled */
            else
                freerdp_settings_set_bool(rdp_settings, FreeRDP_NlaSecurity, TRUE);

            freerdp_settings_set_bool(rdp_settings, FreeRDP_ExtSecurity, FALSE);
            break;

    }

    /* Security */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_Authentication, !guac_settings->disable_authentication);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_IgnoreCertificate, guac_settings->ignore_certificate);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_AutoAcceptCertificate, guac_settings->certificate_tofu);
    if (guac_settings->certificate_fingerprints != NULL)
        freerdp_settings_set_string(rdp_settings, FreeRDP_CertificateAcceptedFingerprints, 
                guac_strdup(guac_settings->certificate_fingerprints));


    /* RemoteApp */
    if (guac_settings->remote_app != NULL) {
        freerdp_settings_set_bool(rdp_settings, FreeRDP_Workarea, TRUE);
        freerdp_settings_set_bool(rdp_settings, FreeRDP_RemoteApplicationMode, TRUE);
        freerdp_settings_set_bool(rdp_settings, FreeRDP_RemoteAppLanguageBarSupported, TRUE);
        freerdp_settings_set_string(rdp_settings, FreeRDP_RemoteApplicationProgram, guac_strdup(guac_settings->remote_app));
        freerdp_settings_set_string(rdp_settings, FreeRDP_ShellWorkingDirectory, guac_strdup(guac_settings->remote_app_dir));
        freerdp_settings_set_string(rdp_settings, FreeRDP_RemoteApplicationCmdLine, guac_strdup(guac_settings->remote_app_args));
    }

    /* Preconnection ID */
    if (guac_settings->preconnection_id != -1) {
        freerdp_settings_set_bool(rdp_settings, FreeRDP_NegotiateSecurityLayer, FALSE);
        freerdp_settings_set_bool(rdp_settings, FreeRDP_SendPreconnectionPdu, TRUE);
        freerdp_settings_set_uint32(rdp_settings, FreeRDP_PreconnectionId, guac_settings->preconnection_id);
    }

    /* Preconnection BLOB */
    if (guac_settings->preconnection_blob != NULL) {
        freerdp_settings_set_bool(rdp_settings, FreeRDP_NegotiateSecurityLayer, FALSE);
        freerdp_settings_set_bool(rdp_settings, FreeRDP_SendPreconnectionPdu, TRUE);
        freerdp_settings_set_string(rdp_settings, FreeRDP_PreconnectionBlob, guac_strdup(guac_settings->preconnection_blob));
    }

    /* Enable use of RD gateway if a gateway hostname is provided */
    if (guac_settings->gateway_hostname != NULL) {

        /* Enable RD gateway */
        freerdp_settings_set_bool(rdp_settings, FreeRDP_GatewayEnabled, TRUE);

        /* RD gateway connection details */
        freerdp_settings_set_string(rdp_settings, FreeRDP_GatewayHostname, guac_strdup(guac_settings->gateway_hostname));
        freerdp_settings_set_uint32(rdp_settings, FreeRDP_GatewayPort, guac_settings->gateway_port);

        /* RD gateway credentials */
        freerdp_settings_set_bool(rdp_settings, FreeRDP_GatewayUseSameCredentials, FALSE);
        freerdp_settings_set_string(rdp_settings, FreeRDP_GatewayDomain, guac_strdup(guac_settings->gateway_domain));
        freerdp_settings_set_string(rdp_settings, FreeRDP_GatewayUsername, guac_strdup(guac_settings->gateway_username));
        freerdp_settings_set_string(rdp_settings, FreeRDP_GatewayPassword, guac_strdup(guac_settings->gateway_password));

    }

    /* Store load balance info (and calculate length) if provided */
    if (guac_settings->load_balance_info != NULL) {
        freerdp_settings_set_pointer(rdp_settings, FreeRDP_LoadBalanceInfo, (BYTE*) guac_strdup(guac_settings->load_balance_info));
        freerdp_settings_set_uint32(rdp_settings, FreeRDP_LoadBalanceInfoLength, strlen(guac_settings->load_balance_info));
    }

    freerdp_settings_set_bool(rdp_settings, FreeRDP_BitmapCacheEnabled, !guac_settings->disable_bitmap_caching);
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_OffscreenSupportLevel, !guac_settings->disable_offscreen_caching);
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_GlyphSupportLevel, 
            (!guac_settings->disable_glyph_caching ? GLYPH_SUPPORT_FULL : GLYPH_SUPPORT_NONE));
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_OsMajorType, OSMAJORTYPE_UNSPECIFIED);
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_OsMinorType, OSMINORTYPE_UNSPECIFIED);
    freerdp_settings_set_bool(rdp_settings, FreeRDP_DesktopResize, TRUE);

#ifdef HAVE_RDPSETTINGS_ALLOWUNANOUNCEDORDERSFROMSERVER
    /* Do not consider server use of unannounced orders to be a fatal error */
    freerdp_settings_set_bool(rdp_settings, FreeRDP_AllowUnanouncedOrdersFromServer, TRUE);
#endif

#else
    /* Authentication */
    rdp_settings->Domain = guac_strdup(guac_settings->domain);
    rdp_settings->Username = guac_strdup(guac_settings->username);
    rdp_settings->Password = guac_strdup(guac_settings->password);

    /* Connection */
    rdp_settings->ServerHostname = guac_strdup(guac_settings->hostname);
    rdp_settings->ServerPort = guac_settings->port;
    rdp_settings->TcpAckTimeout = guac_settings->timeout * 1000;

    /* Session */
    rdp_settings->ColorDepth = guac_settings->color_depth;
    rdp_settings->DesktopWidth = guac_settings->width;
    rdp_settings->DesktopHeight = guac_settings->height;
    rdp_settings->AlternateShell = guac_strdup(guac_settings->initial_program);
    rdp_settings->KeyboardLayout = guac_settings->server_layout->freerdp_keyboard_layout;

    /* Performance flags */
    /* Explicitly set flag value */
    rdp_settings->PerformanceFlags = guac_rdp_get_performance_flags(guac_settings);

    /* Set explicit connection type to LAN to prevent auto-detection */
    freerdp_settings_set_uint32(rdp_settings, FreeRDP_ConnectionType, CONNECTION_TYPE_LAN);

    /* Always request frame markers */
    rdp_settings->FrameMarkerCommandEnabled = TRUE;
    rdp_settings->SurfaceFrameMarkerEnabled = TRUE;

    rdp_settings->FastPathInput = TRUE;
    rdp_settings->FastPathOutput = TRUE;

    /* Enable RemoteFX / Graphics Pipeline */
    if (guac_settings->enable_gfx) {

        rdp_settings->SupportGraphicsPipeline = TRUE;
        rdp_settings->RemoteFxCodec = TRUE;

        if (rdp_settings->ColorDepth != RDP_GFX_REQUIRED_DEPTH) {
            guac_client_log(client, GUAC_LOG_WARNING, "Ignoring requested "
                    "color depth of %i bpp, as the RDP Graphics Pipeline "
                    "requires %i bpp.", rdp_settings->ColorDepth, RDP_GFX_REQUIRED_DEPTH);
        }

        /* Required for RemoteFX / Graphics Pipeline */
        rdp_settings->ColorDepth = RDP_GFX_REQUIRED_DEPTH;
        rdp_settings->SoftwareGdi = TRUE;

    }

    /* Set individual flags - some FreeRDP versions overwrite flags set by guac_rdp_get_performance_flags() above */
    rdp_settings->AllowFontSmoothing = guac_settings->font_smoothing_enabled;
    rdp_settings->DisableWallpaper = !guac_settings->wallpaper_enabled;
    rdp_settings->DisableFullWindowDrag = !guac_settings->full_window_drag_enabled;
    rdp_settings->DisableMenuAnims = !guac_settings->menu_animations_enabled;
    rdp_settings->DisableThemes = !guac_settings->theming_enabled;
    rdp_settings->AllowDesktopComposition = guac_settings->desktop_composition_enabled;

    /* Client name */
    if (guac_settings->client_name != NULL) {
        free(rdp_settings->ClientHostname);
        rdp_settings->ClientHostname = guac_strndup(guac_settings->client_name,
                RDP_CLIENT_HOSTNAME_SIZE);
    }

    /* Console */
    rdp_settings->ConsoleSession = guac_settings->console;
    rdp_settings->RemoteConsoleAudio = guac_settings->console_audio;

    /* Audio */
    rdp_settings->AudioPlayback = guac_settings->audio_enabled;

    /* Audio capture */
    rdp_settings->AudioCapture = guac_settings->enable_audio_input;

    /* Display Update channel */
    rdp_settings->SupportDisplayControl =
        (guac_settings->resize_method == GUAC_RESIZE_DISPLAY_UPDATE);

    /* Timezone redirection */
    if (guac_settings->timezone) {
        if (setenv("TZ", guac_settings->timezone, 1)) {
            guac_client_log(client, GUAC_LOG_WARNING,
                "Unable to forward timezone: TZ environment variable "
                "could not be set: %s", strerror(errno));
        }
    }

    /* Device redirection */
    rdp_settings->DeviceRedirection =  guac_settings->audio_enabled
                                    || guac_settings->drive_enabled
                                    || guac_settings->printing_enabled;

    /* Security */
    switch (guac_settings->security_mode) {

        /* Legacy RDP encryption */
        case GUAC_SECURITY_RDP:
            rdp_settings->RdpSecurity = TRUE;
            rdp_settings->TlsSecurity = FALSE;
            rdp_settings->NlaSecurity = FALSE;
            rdp_settings->ExtSecurity = FALSE;
            rdp_settings->UseRdpSecurityLayer = TRUE;
            rdp_settings->EncryptionLevel = ENCRYPTION_LEVEL_CLIENT_COMPATIBLE;
            rdp_settings->EncryptionMethods =
                  ENCRYPTION_METHOD_40BIT
                | ENCRYPTION_METHOD_128BIT 
                | ENCRYPTION_METHOD_FIPS;
            break;

        /* TLS encryption */
        case GUAC_SECURITY_TLS:
            rdp_settings->RdpSecurity = FALSE;
            rdp_settings->TlsSecurity = TRUE;
            rdp_settings->NlaSecurity = FALSE;
            rdp_settings->ExtSecurity = FALSE;
            break;

        /* Network level authentication */
        case GUAC_SECURITY_NLA:
            rdp_settings->RdpSecurity = FALSE;
            rdp_settings->TlsSecurity = FALSE;
            rdp_settings->NlaSecurity = TRUE;
            rdp_settings->ExtSecurity = FALSE;
            break;

        /* Extended network level authentication */
        case GUAC_SECURITY_EXTENDED_NLA:
            rdp_settings->RdpSecurity = FALSE;
            rdp_settings->TlsSecurity = FALSE;
            rdp_settings->NlaSecurity = FALSE;
            rdp_settings->ExtSecurity = TRUE;
            break;

        /* Hyper-V "VMConnect" negotiation mode */
        case GUAC_SECURITY_VMCONNECT:
            rdp_settings->RdpSecurity = FALSE;
            rdp_settings->TlsSecurity = TRUE;
            rdp_settings->NlaSecurity = TRUE;
            rdp_settings->ExtSecurity = FALSE;
            rdp_settings->VmConnectMode = TRUE;
            break;

        /* All security types */
        case GUAC_SECURITY_ANY:
            rdp_settings->RdpSecurity = TRUE;
            rdp_settings->TlsSecurity = TRUE;

            /* Explicitly disable NLA if FIPS mode is enabled - it won't work */
            if (guac_fips_enabled()) {

                guac_client_log(client, GUAC_LOG_INFO,
                        "FIPS mode is enabled. Excluding NLA security mode from security negotiation "
                        "(see: https://github.com/FreeRDP/FreeRDP/issues/3412).");
                rdp_settings->NlaSecurity = FALSE;

            }

            /* NLA mode is allowed if FIPS is not enabled */
            else
                rdp_settings->NlaSecurity = TRUE;

            rdp_settings->ExtSecurity = FALSE;
            break;

    }

    /* Security */
    rdp_settings->Authentication = !guac_settings->disable_authentication;
    rdp_settings->IgnoreCertificate = guac_settings->ignore_certificate;
    rdp_settings->AutoAcceptCertificate = guac_settings->certificate_tofu;
    if (guac_settings->certificate_fingerprints != NULL)
        rdp_settings->CertificateAcceptedFingerprints = guac_strdup(guac_settings->certificate_fingerprints);

    /* RemoteApp */
    if (guac_settings->remote_app != NULL) {
        rdp_settings->Workarea = TRUE;
        rdp_settings->RemoteApplicationMode = TRUE;
        rdp_settings->RemoteAppLanguageBarSupported = TRUE;
        rdp_settings->RemoteApplicationProgram = guac_strdup(guac_settings->remote_app);
        rdp_settings->ShellWorkingDirectory = guac_strdup(guac_settings->remote_app_dir);
        rdp_settings->RemoteApplicationCmdLine = guac_strdup(guac_settings->remote_app_args);
    }

    /* Preconnection ID */
    if (guac_settings->preconnection_id != -1) {
        rdp_settings->NegotiateSecurityLayer = FALSE;
        rdp_settings->SendPreconnectionPdu = TRUE;
        rdp_settings->PreconnectionId = guac_settings->preconnection_id;
    }

    /* Preconnection BLOB */
    if (guac_settings->preconnection_blob != NULL) {
        rdp_settings->NegotiateSecurityLayer = FALSE;
        rdp_settings->SendPreconnectionPdu = TRUE;
        rdp_settings->PreconnectionBlob = guac_strdup(guac_settings->preconnection_blob);
    }

    /* Enable use of RD gateway if a gateway hostname is provided */
    if (guac_settings->gateway_hostname != NULL) {

        /* Enable RD gateway */
        rdp_settings->GatewayEnabled = TRUE;

        /* RD gateway connection details */
        rdp_settings->GatewayHostname = guac_strdup(guac_settings->gateway_hostname);
        rdp_settings->GatewayPort = guac_settings->gateway_port;

        /* RD gateway credentials */
        rdp_settings->GatewayUseSameCredentials = FALSE;
        rdp_settings->GatewayDomain = guac_strdup(guac_settings->gateway_domain);
        rdp_settings->GatewayUsername = guac_strdup(guac_settings->gateway_username);
        rdp_settings->GatewayPassword = guac_strdup(guac_settings->gateway_password);

    }

    /* Store load balance info (and calculate length) if provided */
    if (guac_settings->load_balance_info != NULL) {
        rdp_settings->LoadBalanceInfo = (BYTE*) guac_strdup(guac_settings->load_balance_info);
        rdp_settings->LoadBalanceInfoLength = strlen(guac_settings->load_balance_info);
    }

    rdp_settings->BitmapCacheEnabled = !guac_settings->disable_bitmap_caching;
    rdp_settings->OffscreenSupportLevel = !guac_settings->disable_offscreen_caching;
    rdp_settings->GlyphSupportLevel = !guac_settings->disable_glyph_caching ? GLYPH_SUPPORT_FULL : GLYPH_SUPPORT_NONE;
    rdp_settings->OsMajorType = OSMAJORTYPE_UNSPECIFIED;
    rdp_settings->OsMinorType = OSMINORTYPE_UNSPECIFIED;
    rdp_settings->DesktopResize = TRUE;

#ifdef HAVE_RDPSETTINGS_ALLOWUNANOUNCEDORDERSFROMSERVER
    /* Do not consider server use of unannounced orders to be a fatal error */
    rdp_settings->AllowUnanouncedOrdersFromServer = TRUE;
#endif

#endif
}
