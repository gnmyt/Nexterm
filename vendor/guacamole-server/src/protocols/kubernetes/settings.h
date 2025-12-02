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

#ifndef GUAC_KUBERNETES_SETTINGS_H
#define GUAC_KUBERNETES_SETTINGS_H

#include <guacamole/user.h>

#include <stdbool.h>

/**
 * The port to connect to when initiating any Kubernetes connection, if no
 * other port is specified.
 */
#define GUAC_KUBERNETES_DEFAULT_PORT 8080

/**
 * The name of the Kubernetes namespace that should be used by default if no
 * specific Kubernetes namespace is provided.
 */
#define GUAC_KUBERNETES_DEFAULT_NAMESPACE "default"

/**
 * The filename to use for the typescript, if not specified.
 */
#define GUAC_KUBERNETES_DEFAULT_TYPESCRIPT_NAME "typescript" 

/**
 * The filename to use for the screen recording, if not specified.
 */
#define GUAC_KUBERNETES_DEFAULT_RECORDING_NAME "recording"

/**
 * Settings for the Kubernetes connection. The values for this structure are
 * parsed from the arguments given during the Guacamole protocol handshake
 * using the guac_kubernetes_parse_args() function.
 */
typedef struct guac_kubernetes_settings {

    /**
     * The hostname of the Kubernetes server to connect to.
     */
    char* hostname;

    /**
     * The port of the Kubernetes server to connect to.
     */
    int port;

    /**
     * The name of the Kubernetes namespace of the pod containing the container
     * being attached to.
     */
    char* kubernetes_namespace;

    /**
     * The name of the Kubernetes pod containing with the container being
     * attached to.
     */
    char* kubernetes_pod;

    /**
     * The name of the container to attach to, or NULL to arbitrarily attach to
     * the first container in the pod.
     */
    char* kubernetes_container;

    /**
     * The command to generate api endpoint for call exec. 
     * If omitted call attach will be used.
     */
    char* exec_command;

    /**
     * Whether SSL/TLS should be used.
     */
    bool use_ssl;

    /**
     * The certificate to use if performing SSL/TLS client authentication to
     * authenticate with the Kubernetes server, in PEM format. If omitted, SSL
     * client authentication will not be performed.
     */
    char* client_cert;

    /**
     * The key to use if performing SSL/TLS client authentication to
     * authenticate with the Kubernetes server, in PEM format. If omitted, SSL
     * client authentication will not be performed.
     */
    char* client_key;

    /**
     * The certificate of the certificate authority that signed the certificate
     * of the Kubernetes server, in PEM format. If omitted. verification of
     * the Kubernetes server certificate will use the systemwide certificate
     * authorities.
     */
    char* ca_cert;

    /**
     * Whether the certificate used by the Kubernetes server for SSL/TLS should
     * be ignored if it cannot be validated.
     */
    bool ignore_cert;

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
     * The ASCII code, as an integer, that the Kubernetes client will use when
     * the backspace key is pressed. By default, this is 127, ASCII delete, if
     * not specified in the client settings.
     */
    int backspace;

} guac_kubernetes_settings;

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
 *     guac_kubernetes_settings_free() when no longer needed. If the arguments
 *     fail to parse, NULL is returned.
 */
guac_kubernetes_settings* guac_kubernetes_parse_args(guac_user* user,
        int argc, const char** argv);

/**
 * Frees the given guac_kubernetes_settings object, having been previously
 * allocated via guac_kubernetes_parse_args().
 *
 * @param settings
 *     The settings object to free.
 */
void guac_kubernetes_settings_free(guac_kubernetes_settings* settings);

/**
 * NULL-terminated array of accepted client args.
 */
extern const char* GUAC_KUBERNETES_CLIENT_ARGS[];

#endif

