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
#include "settings.h"
#include "terminal/terminal.h"

#include <guacamole/mem.h>
#include <guacamole/user.h>

#include <stdlib.h>

/* Client plugin arguments */
const char* GUAC_KUBERNETES_CLIENT_ARGS[] = {
    "hostname",
    "port",
    "namespace",
    "pod",
    "container",
    "exec-command",
    "use-ssl",
    "client-cert",
    "client-key",
    "ca-cert",
    "ignore-cert",
    GUAC_KUBERNETES_ARGV_FONT_NAME,
    GUAC_KUBERNETES_ARGV_FONT_SIZE,
    GUAC_KUBERNETES_ARGV_COLOR_SCHEME,
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
    "backspace",
    "scrollback",
    "disable-copy",
    "disable-paste",
    NULL
};

enum KUBERNETES_ARGS_IDX {
    
    /**
     * The hostname to connect to. Required.
     */
    IDX_HOSTNAME,

    /**
     * The port to connect to. Optional.
     */
    IDX_PORT,

    /**
     * The name of the Kubernetes namespace of the pod containing the container
     * being attached to. If omitted, the default namespace will be used.
     */
    IDX_NAMESPACE,

    /**
     * The name of the Kubernetes pod containing with the container being
     * attached to. Required.
     */
    IDX_POD,

    /**
     * The name of the container to attach to. If omitted, the first container
     * in the pod will be used.
     */
    IDX_CONTAINER,

    /**
     * The command used by exec call. If omitted, attach call will be used.
     */
    IDX_EXEC_COMMAND,

    /**
     * Whether SSL/TLS should be used. If omitted, SSL/TLS will not be used.
     */
    IDX_USE_SSL,

    /**
     * The certificate to use if performing SSL/TLS client authentication to
     * authenticate with the Kubernetes server, in PEM format. If omitted, SSL
     * client authentication will not be performed.
     */
    IDX_CLIENT_CERT,

    /**
     * The key to use if performing SSL/TLS client authentication to
     * authenticate with the Kubernetes server, in PEM format. If omitted, SSL
     * client authentication will not be performed.
     */
    IDX_CLIENT_KEY,

    /**
     * The certificate of the certificate authority that signed the certificate
     * of the Kubernetes server, in PEM format. If omitted. verification of
     * the Kubernetes server certificate will use the systemwide certificate
     * authorities.
     */
    IDX_CA_CERT,

    /**
     * Whether the certificate used by the Kubernetes server for SSL/TLS should
     * be ignored if it cannot be validated.
     */
    IDX_IGNORE_CERT,

    /**
     * The name of the font to use within the terminal.
     */
    IDX_FONT_NAME,

    /**
     * The size of the font to use within the terminal, in points.
     */
    IDX_FONT_SIZE,

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
     * ASCII code, as an integer to use for the backspace key, or
     * GUAC_TERMINAL_DEFAULT_BACKSPACE if not specified.
     */
    IDX_BACKSPACE,

    /**
     * The maximum size of the scrollback buffer in rows.
     */
    IDX_SCROLLBACK,

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

    KUBERNETES_ARGS_COUNT
};

guac_kubernetes_settings* guac_kubernetes_parse_args(guac_user* user,
        int argc, const char** argv) {

    /* Validate arg count */
    if (argc != KUBERNETES_ARGS_COUNT) {
        guac_user_log(user, GUAC_LOG_WARNING, "Incorrect number of connection "
                "parameters provided: expected %i, got %i.",
                KUBERNETES_ARGS_COUNT, argc);
        return NULL;
    }

    guac_kubernetes_settings* settings =
        guac_mem_zalloc(sizeof(guac_kubernetes_settings));

    /* Read hostname */
    settings->hostname =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_HOSTNAME, "");

    /* Read port */
    settings->port =
        guac_user_parse_args_int(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_PORT, GUAC_KUBERNETES_DEFAULT_PORT);

    /* Read Kubernetes namespace */
    settings->kubernetes_namespace =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_NAMESPACE, GUAC_KUBERNETES_DEFAULT_NAMESPACE);

    /* Read name of Kubernetes pod (required) */
    settings->kubernetes_pod =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_POD, NULL);

    /* Read container of pod (optional) */
    settings->kubernetes_container =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_CONTAINER, NULL);

    /* Read exec command (optional) */
    settings->exec_command =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_EXEC_COMMAND, NULL);

    /* Parse whether SSL should be used */
    settings->use_ssl =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_USE_SSL, false);

    /* Read SSL/TLS connection details only if enabled */
    if (settings->use_ssl) {

        settings->client_cert =
            guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS,
                    argv, IDX_CLIENT_CERT, NULL);

        settings->client_key =
            guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS,
                    argv, IDX_CLIENT_KEY, NULL);

        settings->ca_cert =
            guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS,
                    argv, IDX_CA_CERT, NULL);

        settings->ignore_cert =
            guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS,
                    argv, IDX_IGNORE_CERT, false);

    }

    /* Read-only mode */
    settings->read_only =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_READ_ONLY, false);

    /* Read maximum scrollback size */
    settings->max_scrollback =
        guac_user_parse_args_int(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_SCROLLBACK, GUAC_TERMINAL_DEFAULT_MAX_SCROLLBACK);

    /* Read font name */
    settings->font_name =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_FONT_NAME, GUAC_TERMINAL_DEFAULT_FONT_NAME);

    /* Read font size */
    settings->font_size =
        guac_user_parse_args_int(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_FONT_SIZE, GUAC_TERMINAL_DEFAULT_FONT_SIZE);

    /* Copy requested color scheme */
    settings->color_scheme =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_COLOR_SCHEME, GUAC_TERMINAL_DEFAULT_COLOR_SCHEME);

    /* Pull width/height/resolution directly from user */
    settings->width      = user->info.optimal_width;
    settings->height     = user->info.optimal_height;
    settings->resolution = user->info.optimal_resolution;

    /* Read typescript path */
    settings->typescript_path =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_TYPESCRIPT_PATH, NULL);

    /* Read typescript name */
    settings->typescript_name =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_TYPESCRIPT_NAME, GUAC_KUBERNETES_DEFAULT_TYPESCRIPT_NAME);

    /* Parse path creation flag */
    settings->create_typescript_path =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_CREATE_TYPESCRIPT_PATH, false);

    /* Parse allow write existing file flag */
    settings->typescript_write_existing =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_TYPESCRIPT_WRITE_EXISTING, false);

    /* Read recording path */
    settings->recording_path =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_RECORDING_PATH, NULL);

    /* Read recording name */
    settings->recording_name =
        guac_user_parse_args_string(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_RECORDING_NAME, GUAC_KUBERNETES_DEFAULT_RECORDING_NAME);

    /* Parse output exclusion flag */
    settings->recording_exclude_output =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_OUTPUT, false);

    /* Parse mouse exclusion flag */
    settings->recording_exclude_mouse =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_RECORDING_EXCLUDE_MOUSE, false);

    /* Parse key event inclusion flag */
    settings->recording_include_keys =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_RECORDING_INCLUDE_KEYS, false);

    /* Parse path creation flag */
    settings->create_recording_path =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_CREATE_RECORDING_PATH, false);

    /* Parse allow write existing file flag */
    settings->recording_write_existing =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_RECORDING_WRITE_EXISTING, false);

    /* Parse backspace key code */
    settings->backspace =
        guac_user_parse_args_int(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_BACKSPACE, GUAC_TERMINAL_DEFAULT_BACKSPACE);

    /* Parse clipboard copy disable flag */
    settings->disable_copy =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_DISABLE_COPY, false);

    /* Parse clipboard paste disable flag */
    settings->disable_paste =
        guac_user_parse_args_boolean(user, GUAC_KUBERNETES_CLIENT_ARGS, argv,
                IDX_DISABLE_PASTE, false);

    /* Parsing was successful */
    return settings;

}

void guac_kubernetes_settings_free(guac_kubernetes_settings* settings) {

    /* Free network connection information */
    guac_mem_free(settings->hostname);

    /* Free Kubernetes pod/container details */
    guac_mem_free(settings->kubernetes_namespace);
    guac_mem_free(settings->kubernetes_pod);
    guac_mem_free(settings->kubernetes_container);

    /* Free Kubernetes exec command */
    guac_mem_free(settings->exec_command);

    /* Free SSL/TLS details */
    guac_mem_free(settings->client_cert);
    guac_mem_free(settings->client_key);
    guac_mem_free(settings->ca_cert);

    /* Free display preferences */
    guac_mem_free(settings->font_name);
    guac_mem_free(settings->color_scheme);

    /* Free typescript settings */
    guac_mem_free(settings->typescript_name);
    guac_mem_free(settings->typescript_path);

    /* Free screen recording settings */
    guac_mem_free(settings->recording_name);
    guac_mem_free(settings->recording_path);

    /* Free overall structure */
    guac_mem_free(settings);

}

