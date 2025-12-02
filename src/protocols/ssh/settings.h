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

#ifndef GUAC_SSH_SETTINGS_H
#define GUAC_SSH_SETTINGS_H

#include "config.h"

#include <guacamole/user.h>

#include <stdbool.h>

/**
 * The port to connect to when initiating any SSH connection, if no other port
 * is specified.
 */
#define GUAC_SSH_DEFAULT_PORT "22"

/**
 * The default number of seconds to attempt a connection to the SSH/SFTP
 * server before giving up.
 */
#define GUAC_SSH_DEFAULT_TIMEOUT 10

/**
 * The filename to use for the typescript, if not specified.
 */
#define GUAC_SSH_DEFAULT_TYPESCRIPT_NAME "typescript" 

/**
 * The filename to use for the screen recording, if not specified.
 */
#define GUAC_SSH_DEFAULT_RECORDING_NAME "recording"

/**
 * The default polling timeout for SSH activity in milliseconds.
 */
#define GUAC_SSH_DEFAULT_POLL_TIMEOUT 1000

/**
 * Settings for the SSH connection. The values for this structure are parsed
 * from the arguments given during the Guacamole protocol handshake using the
 * guac_ssh_parse_args() function.
 */
typedef struct guac_ssh_settings {

    /**
     * The hostname of the SSH server to connect to.
     */
    char* hostname;

    /**
     * The public SSH host key.
     */
    char* host_key;

    /**
     * The port of the SSH server to connect to.
     */
    char* port;

    /**
     * The number of seconds to attempt to connect to the SSH server before
     * timing out.
     */
    int timeout;

    /**
     * The name of the user to login as, if any. If no username is specified,
     * this will be NULL.
     */
    char* username;

    /**
     * The password to give when authenticating, if any. If no password is
     * specified, this will be NULL.
     */
    char* password;

    /**
     * The private key, encoded as base64, if any. If no private key is
     * specified, this will be NULL.
     */
    char* key_base64;

    /**
     * The passphrase to use to decrypt the given private key, if any. If no
     * passphrase is specified, this will be NULL.
     */
    char* key_passphrase;

    /**
     * The public key, encoded as base64, if any. If no public key is specified,
     * this will be NULL.
     */
    char* public_key_base64;

    /**
     * Whether this connection is read-only, and user input should be dropped.
     */
    bool read_only;

    /**
     * The command to run instead of the default shell. If a normal shell
     * session is desired, this will be NULL.
     */
    char* command;

    /**
     * The maximum size of the scrollback buffer in rows.
     */
    int max_scrollback;

    /**
     * The name of the font to use for display rendering.
     */
    char* font_name;

    /**
     * The size of the font to use, in points.
     */
    int font_size;

    /**
     * The name of the color scheme to use.
     */
    char* color_scheme; 

    /**
     * The desired width of the terminal display, in pixels.
     */
    int width;

    /**
     * The desired height of the terminal display, in pixels.
     */
    int height;

    /**
     * The desired screen resolution, in DPI.
     */
    int resolution;

    /**
     * Whether outbound clipboard access should be blocked. If set, it will not
     * be possible to copy data from the terminal to the client using the
     * clipboard.
     */
    bool disable_copy;

    /**
     * Whether inbound clipboard access should be blocked. If set, it will not
     * be possible to paste data from the client to the terminal using the
     * clipboard.
     */
    bool disable_paste;

    /**
     * Whether SFTP is enabled.
     */
    bool enable_sftp;

    /**
     * The path of the directory within the SSH server to expose as a
     * filesystem guac_object.
     */
    char* sftp_root_directory;
    
    /**
     * Whether file download over SFTP should be disabled.  If set to true, file
     * downloads will not be allowed over SFTP.  If not set or set to false, file
     * downloads will be allowed.
     */
    bool sftp_disable_download;
    
    /**
     * Whether file uploads over SFTP should be disabled.  If set to true, file
     * uploads will not be allowed over SFTP.  If not set or set to false, file
     * uploads will be allowed.
     */
    bool sftp_disable_upload;

#ifdef ENABLE_SSH_AGENT
    /**
     * Whether the SSH agent is enabled.
     */
    bool enable_agent;
#endif

    /**
     * The path in which the typescript should be saved, if enabled. If no
     * typescript should be saved, this will be NULL.
     */
    char* typescript_path;

    /**
     * The filename to use for the typescript, if enabled.
     */
    char* typescript_name;

    /**
     * Whether the typescript path should be automatically created if it does
     * not already exist.
     */
    bool create_typescript_path;

    /**
     * Whether existing files should be appended to when creating a new
     * typescript. Disabled by default.
     */
    bool typescript_write_existing;

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
     * The number of seconds between sending server alive messages.
     */
    int server_alive_interval;

    /**
     * The integer ASCII code of the command to send for backspace.
     */
    int backspace;

    /**
     * The terminal emulator type that is passed to the remote system.
     */
    char* terminal_type;

    /**
     * The locale that should be forwarded to the remote system via the LANG
     * environment variable.
     */
    char* locale;

    /** 
     * The client timezone to pass to the remote system.
     */
    char* timezone;
    
    /**
     * Whether or not to send the Wake-on-LAN magic packet.
     */
    bool wol_send_packet;
    
    /**
     * The MAC address to put in the magic WoL packet for the host to wake.
     */
    char* wol_mac_addr;
    
    /**
     * The broadcast address to which to send the magic WoL packet.
     */
    char* wol_broadcast_addr;
    
    /**
     * The UDP port to use when sending the magic WoL packet.
     */
    unsigned short wol_udp_port;
    
    /**
     * The amount of time to wait for the system to wake after sending the packet.
     */
    int wol_wait_time;

} guac_ssh_settings;

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
 *     guac_ssh_settings_free() when no longer needed. If the arguments fail
 *     to parse, NULL is returned.
 */
guac_ssh_settings* guac_ssh_parse_args(guac_user* user,
        int argc, const char** argv);

/**
 * Frees the given guac_ssh_settings object, having been previously allocated
 * via guac_ssh_parse_args().
 *
 * @param settings
 *     The settings object to free.
 */
void guac_ssh_settings_free(guac_ssh_settings* settings);

/**
 * NULL-terminated array of accepted client args.
 */
extern const char* GUAC_SSH_CLIENT_ARGS[];

#endif

