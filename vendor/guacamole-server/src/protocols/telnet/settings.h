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

#ifndef GUAC_TELNET_SETTINGS_H
#define GUAC_TELNET_SETTINGS_H

#include "config.h"

#include <guacamole/user.h>

#include <sys/types.h>
#include <regex.h>
#include <stdbool.h>
/**
 * The port to connect to when initiating any telnet connection, if no other
 * port is specified.
 */
#define GUAC_TELNET_DEFAULT_PORT "23"

/**
 * The default number of seconds to wait for a successful connection before
 * timing out.
 */
#define GUAC_TELNET_DEFAULT_TIMEOUT 10

/**
 * The filename to use for the typescript, if not specified.
 */
#define GUAC_TELNET_DEFAULT_TYPESCRIPT_NAME "typescript" 

/**
 * The filename to use for the screen recording, if not specified.
 */
#define GUAC_TELNET_DEFAULT_RECORDING_NAME "recording"

/**
 * The regular expression to use when searching for the username/login prompt
 * if no other regular expression is specified.
 */
#define GUAC_TELNET_DEFAULT_USERNAME_REGEX "[Ll]ogin:"

/**
 * The regular expression to use when searching for the password prompt if no
 * other regular expression is specified.
 */
#define GUAC_TELNET_DEFAULT_PASSWORD_REGEX "[Pp]assword:"

/**
 * Settings for the telnet connection. The values for this structure are parsed
 * from the arguments given during the Guacamole protocol handshake using the
 * guac_telnet_parse_args() function.
 */
typedef struct guac_telnet_settings {

    /**
     * The hostname of the telnet server to connect to.
     */
    char* hostname;

    /**
     * The port of the telnet server to connect to.
     */
    char* port;

    /**
     * The number of seconds to wait for a connection before timing out.
     */
    int timeout;

    /**
     * The name of the user to login as, if any. If no username is specified,
     * this will be NULL.
     */
    char* username;

    /**
     * The regular expression to use when searching for the username/login
     * prompt. If no username is specified, this will be NULL. If a username
     * is specified, this will either be the specified username regex, or the
     * default username regex.
     */
    regex_t* username_regex;

    /**
     * The password to give when authenticating, if any. If no password is
     * specified, this will be NULL.
     */
    char* password;

    /**
     * The regular expression to use when searching for the password prompt. If
     * no password is specified, this will be NULL. If a password is specified,
     * this will either be the specified password regex, or the default
     * password regex.
     */
    regex_t* password_regex;

    /**
     * The regular expression to use when searching for whether login was
     * successful. If no such regex is specified, or if no login failure regex
     * was specified, this will be NULL.
     */
    regex_t* login_success_regex;

    /**
     * The regular expression to use when searching for whether login failed.
     * If no such regex is specified, or if no login success regex was
     * specified, this will be NULL.
     */
    regex_t* login_failure_regex;

    /**
     * Whether this connection is read-only, and user input should be dropped.
     */
    bool read_only;

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
     * The ASCII code, as an integer, that the telnet client will use when the
     * backspace key is pressed.  By default, this is 127, ASCII delete, if
     * not specified in the client settings.
     */
    int backspace;

    /**
     * The terminal emulator type that is passed to the remote system.
     */
    char* terminal_type;
    
    /**
     * Whether or not to send the magic Wake-on-LAN (WoL) packet prior to
     * continuing the connection.
     */
    bool wol_send_packet;
    
    /**
     * The MAC address to put in the magic WoL packet for the remote host to
     * wake.
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
     * The number of seconds to wait after sending the magic WoL packet before
     * continuing the connection.
     */
    int wol_wait_time;

} guac_telnet_settings;

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
 *     guac_telnet_settings_free() when no longer needed. If the arguments fail
 *     to parse, NULL is returned.
 */
guac_telnet_settings* guac_telnet_parse_args(guac_user* user,
        int argc, const char** argv);

/**
 * Frees the regex pointed to by the given pointer, assigning the value NULL to
 * that pointer once the regex is freed. If the pointer already contains NULL,
 * this function has no effect.
 *
 * @param regex
 *     The address of the pointer to the regex that should be freed.
 */
void guac_telnet_regex_free(regex_t** regex);

/**
 * Frees the given guac_telnet_settings object, having been previously
 * allocated via guac_telnet_parse_args().
 *
 * @param settings
 *     The settings object to free.
 */
void guac_telnet_settings_free(guac_telnet_settings* settings);

/**
 * NULL-terminated array of accepted client args.
 */
extern const char* GUAC_TELNET_CLIENT_ARGS[];

#endif

