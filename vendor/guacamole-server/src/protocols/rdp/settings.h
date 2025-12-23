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

#ifndef GUAC_RDP_SETTINGS_H
#define GUAC_RDP_SETTINGS_H

#include "config.h"
#include "keymap.h"

#include <freerdp/freerdp.h>
#include <guacamole/client.h>
#include <guacamole/user.h>

/**
 * The maximum number of bytes in the client hostname claimed during
 * connection.
 */
#define RDP_CLIENT_HOSTNAME_SIZE 32

/**
 * The default server response timeout, in seconds.
 */
#define RDP_DEFAULT_TIMEOUT 10

/**
 * The default RDP port.
 */
#define RDP_DEFAULT_PORT 3389

/**
 * The default SFTP connection timeout, in seconds.
 */
#define RDP_DEFAULT_SFTP_TIMEOUT 10

/**
 * The default RDP port used by Hyper-V "VMConnect".
 */
#define RDP_DEFAULT_VMCONNECT_PORT 2179

/**
 * Default screen width, in pixels.
 */
#define RDP_DEFAULT_WIDTH  1024

/**
 * Default screen height, in pixels.
 */
#define RDP_DEFAULT_HEIGHT 768 

/**
 * Default color depth, in bits.
 */
#define RDP_DEFAULT_DEPTH  16 

/**
 * The color depth required by the RDPGFX channel, in bits.
 */
#define RDP_GFX_REQUIRED_DEPTH 32

/**
 * The filename to use for the screen recording, if not specified.
 */
#define GUAC_RDP_DEFAULT_RECORDING_NAME "recording"

/**
 * The number of entries contained within the OrderSupport BYTE array
 * referenced by the rdpSettings structure. This value is defined by the RDP
 * negotiation process (there are 32 bytes available within the order
 * negotiation field sent during the connection handshake) and is hard-coded
 * within FreeRDP. There is no public constant for this value defined within
 * the FreeRDP headers.
 */
#define GUAC_RDP_ORDER_SUPPORT_LENGTH 32

/**
 * All supported combinations of security types.
 */
typedef enum guac_rdp_security {

    /**
     * Legacy RDP encryption.
     */
    GUAC_SECURITY_RDP,

    /**
     * TLS encryption.
     */
    GUAC_SECURITY_TLS,

    /**
     * Network level authentication.
     */
    GUAC_SECURITY_NLA,

    /**
     * Extended network level authentication.
     */
    GUAC_SECURITY_EXTENDED_NLA,

    /**
     * Negotiate security methods supported by Hyper-V's "VMConnect" feature.
     */
    GUAC_SECURITY_VMCONNECT,

    /**
     * Negotiate a security method supported by both server and client.
     */
    GUAC_SECURITY_ANY

} guac_rdp_security;

/**
 * All supported combinations screen resize methods.
 */
typedef enum guac_rdp_resize_method {

    /**
     * Dynamic resizing of the display will not be attempted.
     */
    GUAC_RESIZE_NONE,

    /**
     * Dynamic resizing will be attempted through sending requests along the
     * Display Update channel. This will only work with recent versions of
     * Windows and relatively-recent versions of FreeRDP.
     */
    GUAC_RESIZE_DISPLAY_UPDATE,

    /**
     * Guacamole will automatically disconnect and reconnect to the RDP server
     * whenever the screen size changes, requesting the new size during
     * reconnect.
     */
    GUAC_RESIZE_RECONNECT

} guac_rdp_resize_method;

/**
 * All settings supported by the Guacamole RDP client.
 */
typedef struct guac_rdp_settings {

    /**
     * The hostname to connect to.
     */
    char* hostname;

    /**
     * The port to connect to.
     */
    int port;

    /**
     * The timeout, in seconds, to wait for the remote host to respond.
     */
    int timeout;

    /**
     * The domain of the user logging in.
     */
    char* domain;

    /**
     * The username of the user logging in.
     */
    char* username;

    /**
     * The password of the user logging in.
     */
    char* password;

    /**
     * Whether this connection is read-only, and user input should be dropped.
     */
    int read_only;

    /**
     * The color depth of the display to request, in bits.
     */
    int color_depth;

    /**
     * The width of the display to request, in pixels.
     */
    int width;
    
    /**
     * The height of the display to request, in pixels.
     */
    int height;

    /**
     * The DPI of the remote display to assume when converting between
     * client pixels and remote pixels.
     */
    int resolution;

    /**
     * Whether all graphical updates for this connection should use lossless
     * compression only.
     */
    int lossless;

    /**
     * Whether audio is enabled.
     */
    int audio_enabled;

    /**
     * Whether printing is enabled.
     */
    int printing_enabled;

    /**
     * Name of the redirected printer.
     */
    char* printer_name;

    /**
     * Whether the virtual drive is enabled.
     */
    int drive_enabled;
    
    /**
     * The name of the virtual drive to pass through to the RDP connection.
     */
    char* drive_name;

    /**
     * The local system path which will be used to persist the
     * virtual drive.
     */
    char* drive_path;

    /**
     * Whether to automatically create the local system path if it does not
     * exist.
     */
    int create_drive_path;
    
    /**
     * Whether or not to disable file download over RDP.
     */
    int disable_download;
    
    /**
     * Wether or not to disable file upload over RDP.
     */
    int disable_upload;

    /**
     * Whether this session is a console session.
     */
    int console;

    /**
     * Whether to allow audio in the console session.
     */
    int console_audio;

    /**
     * The keymap chosen as the layout of the server.
     */
    const guac_rdp_keymap* server_layout;

    /**
     * The initial program to run, if any.
     */
    char* initial_program;

    /**
     * The name of the client to submit to the RDP server upon connection, or
     * NULL if the name is not specified.
     */
    char* client_name;

    /**
     * The type of security to use for the connection.
     */
    guac_rdp_security security_mode;

    /**
     * Whether bad server certificates should be ignored.
     */
    int ignore_certificate;

    /**
     * Whether or not a certificate should be added to the local trust
     * store on first use.
     */
    int certificate_tofu;

    /**
     * The fingerprints of host certificates that should be trusted for
     * this connection.
     */
    char* certificate_fingerprints;

    /**
     * Whether authentication should be disabled. This is different from the
     * authentication that takes place when a user provides their username
     * and password. Authentication is required by definition for NLA.
     */
    int disable_authentication;

    /**
     * The application to launch, if RemoteApp is in use.
     */
    char* remote_app;

    /**
     * The working directory of the remote application, if RemoteApp is in use.
     */
    char* remote_app_dir;

    /**
     * The arguments to pass to the remote application, if RemoteApp is in use.
     */
    char* remote_app_args;

    /**
     * NULL-terminated list of all static virtual channel names, or NULL if
     * no channels whatsoever.
     */
    char** svc_names;

    /**
     * Whether outbound clipboard access should be blocked. If set, it will not
     * be possible to copy data from the remote desktop to the client using the
     * clipboard.
     */
    int disable_copy;

    /**
     * Whether inbound clipboard access should be blocked. If set, it will not
     * be possible to paste data from the client to the remote desktop using
     * the clipboard.
     */
    int disable_paste;

    /**
     * Whether line endings within the clipboard should be automatically
     * normalized to Unix-style newline characters.
     */
    int normalize_clipboard;

    /**
     * Whether Unix-style newline characters within the clipboard should be
     * automatically translated to CRLF sequences before transmission to the
     * RDP server.
     */
    int clipboard_crlf;

    /**
     * Whether the desktop wallpaper should be visible. If unset, the desktop
     * wallpaper will be hidden, reducing the amount of bandwidth required.
     */
    int wallpaper_enabled;

    /**
     * Whether desktop and window theming should be allowed. If unset, theming
     * is temporarily disabled on the desktop of the RDP server for the sake of
     * performance, reducing the amount of bandwidth required.
     */
    int theming_enabled;

    /**
     * Whether glyphs should be smoothed with antialiasing (ClearType). If
     * unset, glyphs will be rendered with sharp edges and using single colors,
     * effectively 1-bit images, reducing the amount of bandwidth required.
     */
    int font_smoothing_enabled;

    /**
     * Whether windows contents should be shown as they are moved. If unset,
     * only a window border will be shown during window move operations,
     * reducing the amount of bandwidth required.
     */
    int full_window_drag_enabled;

    /**
     * Whether desktop composition (Aero) should be enabled during the session.
     * As desktop composition provides alpha blending and other special
     * effects, this increases the amount of bandwidth used. If unset, desktop
     * composition will be disabled.
     */
    int desktop_composition_enabled;

    /**
     * Whether menu animations should be shown. If unset, menus will not be
     * animated, reducing the amount of bandwidth required.
     */
    int menu_animations_enabled;

    /**
     * Whether bitmap caching should be disabled. By default it is
     * enabled - this allows users to explicitly disable it.
     */
    int disable_bitmap_caching;

    /**
     * Whether offscreen caching should be disabled. By default it is
     * enabled - this allows users to explicitly disable it.
     */
    int disable_offscreen_caching;

    /**
     * Whether glyph caching should be disabled. By default it is enabled
     * - this allows users to explicitly disable it.
     */
    int disable_glyph_caching;

    /**
     * The preconnection ID to send within the preconnection PDU when
     * initiating an RDP connection, if any. If no preconnection ID is
     * specified, this will be -1.
     */
    int preconnection_id;

    /**
     * The preconnection BLOB (PCB) to send to the RDP server prior to full RDP
     * connection negotiation. This value is used by Hyper-V to select the
     * destination VM.
     */
    char* preconnection_blob;

    /**
     * The timezone to pass through to the RDP connection.
     */
    char* timezone;

#ifdef ENABLE_COMMON_SSH
    /**
     * Whether SFTP should be enabled for the RDP connection.
     */
    int enable_sftp;

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
     * The number of seconds to attempt to connect to the SSH server before
     * timing out.
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
     * The public key to use when connecting to the SFTP server, if applicable.
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
     * SFTP connections. The default is 0 (disabling keepalives), and a value
     * of 1 is automatically increased to 2 by libssh2 to avoid busy loop corner
     * cases.
     */
    int sftp_server_alive_interval;
    
    /**
     * Whether or not to disable file download over SFTP.
     */
    int sftp_disable_download;
    
    /**
     * Whether or not to disable file upload over SFTP.
     */
    int sftp_disable_upload;
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
    int create_recording_path;

    /**
     * Non-zero if output which is broadcast to each connected client
     * (graphics, streams, etc.) should NOT be included in the session
     * recording, zero otherwise. Output is included by default, as it is
     * necessary for any recording which must later be viewable as video.
     */
    int recording_exclude_output;

    /**
     * Non-zero if changes to mouse state, such as position and buttons pressed
     * or released, should NOT be included in the session recording, zero
     * otherwise. Mouse state is included by default, as it is necessary for
     * the mouse cursor to be rendered in any resulting video.
     */
    int recording_exclude_mouse;

    /**
     * Non-zero if changes to touch state should NOT be included in the session
     * recording, zero otherwise. Touch state is included by default, as it may
     * be necessary for touch interactions to be rendered in any resulting
     * video.
     */
    int recording_exclude_touch;

    /**
     * Non-zero if keys pressed and released should be included in the session
     * recording, zero otherwise. Key events are NOT included by default within
     * the recording, as doing so has privacy and security implications.
     * Including key events may be necessary in certain auditing contexts, but
     * should only be done with caution. Key events can easily contain
     * sensitive information, such as passwords, credit card numbers, etc.
     */
    int recording_include_keys;

    /**
     * Non-zero if existing files should be appended to when creating a new 
     * recording. Disabled by default.
     */
    int recording_write_existing;

    /** 
     * The method to apply when the user's display changes size.
     */
    guac_rdp_resize_method resize_method;

    /**
     * Whether audio input (microphone) is enabled.
     */
    int enable_audio_input;

    /**
     * Whether the RDP Graphics Pipeline Extension is enabled.
     */
    int enable_gfx;

    /**
     * Whether multi-touch support is enabled.
     */
    int enable_touch;

    /**
     * The hostname of the remote desktop gateway that should be used as an
     * intermediary for the remote desktop connection. If no gateway should
     * be used, this will be NULL.
     */
    char* gateway_hostname;

    /**
     * The port of the remote desktop gateway that should be used as an
     * intermediary for the remote desktop connection. NOTE: versions of
     * FreeRDP prior to 1.2 which have gateway support ignore this value, and
     * instead use a hard-coded value of 443.
     */
    int gateway_port;

    /**
     * The domain of the user authenticating with the remote desktop gateway,
     * if a gateway is being used. This is not necessarily the same as the
     * user actually using the remote desktop connection.
     */
    char* gateway_domain;

    /**
     * The username of the user authenticating with the remote desktop gateway,
     * if a gateway is being used. This is not necessarily the same as the
     * user actually using the remote desktop connection.
     */
    char* gateway_username;

    /**
     * The password to provide when authenticating with the remote desktop
     * gateway, if a gateway is being used.
     */
    char* gateway_password;

    /**
     * The load balancing information/cookie which should be provided to
     * the connection broker, if a connection broker is being used.
     */
    char* load_balance_info;
    
    /**
     * Whether or not to send a magic WoL packet to wake up the host before
     * trying to connect.  Zero will disable sending the packet, non-zero
     * values will trigger sending the packet.
     */
    int wol_send_packet;
    
    /**
     * The mac address to put in the magic WoL packet.
     */
    char* wol_mac_addr;
    
    /**
     * The broadcast address to send the magic WoL packet to.
     */
    char* wol_broadcast_addr;
    
    /**
     * The UDP port to use when sending the magic WoL packet.
     */
    unsigned short wol_udp_port;
    
    /**
     * The amount of time to wait after sending the magic WoL packet before
     * continuing the connection.
     */
    int wol_wait_time;

} guac_rdp_settings;

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
 *     guac_rdp_settings_free() when no longer needed. If the arguments fail
 *     to parse, NULL is returned.
 */
guac_rdp_settings* guac_rdp_parse_args(guac_user* user,
        int argc, const char** argv);

/**
 * Frees the given guac_rdp_settings object, having been previously allocated
 * via guac_rdp_parse_args().
 *
 * @param settings
 *     The settings object to free.
 */
void guac_rdp_settings_free(guac_rdp_settings* settings);

/**
 * NULL-terminated array of accepted client args.
 */
extern const char* GUAC_RDP_CLIENT_ARGS[];

/**
 * Save all given settings to the given freerdp instance.
 *
 * @param client
 *     The guac_client object providing the settings.
 *
 * @param guac_settings
 *     The guac_rdp_settings object to save.
 *
 * @param rdp
 *     The RDP instance to save settings to.
 */
void guac_rdp_push_settings(guac_client* client,
        guac_rdp_settings* guac_settings, freerdp* rdp);

/**
 * Returns the width of the RDP session display.
 *
 * @param rdp
 *     The RDP instance to retrieve the width from.
 *
 * @return
 *     The current width of the RDP display, in pixels.
 */
int guac_rdp_get_width(freerdp* rdp);

/**
 * Returns the height of the RDP session display.
 *
 * @param rdp
 *     The RDP instance to retrieve the height from.
 *
 * @return
 *     The current height of the RDP display, in pixels.
 */
int guac_rdp_get_height(freerdp* rdp);

/**
 * Returns the depth of the RDP session display.
 *
 * @param rdp
 *     The RDP instance to retrieve the depth from.
 *
 * @return
 *     The current depth of the RDP display, in bits per pixel.
 */
int guac_rdp_get_depth(freerdp* rdp);

#endif

