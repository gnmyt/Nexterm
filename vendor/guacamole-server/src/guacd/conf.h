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

#ifndef GUACD_CONF_H
#define GUACD_CONF_H

#include "config.h"

#include <guacamole/client.h>

/**
 * The default host that guacd should bind to, if no other host is explicitly
 * specified.
 */
#define GUACD_DEFAULT_BIND_HOST "localhost"

/**
 * The default port that guacd should bind to, if no other port is explicitly
 * specified.
 */
#define GUACD_DEFAULT_BIND_PORT "4822"

/**
 * The contents of a guacd configuration file.
 */
typedef struct guacd_config {

    /**
     * The host to bind on.
     */
    char* bind_host;

    /**
     * The port to bind on.
     */
    char* bind_port;

    /**
     * The file to write the PID in, if any.
     */
    char* pidfile;

    /**
     * Whether guacd should run in the foreground.
     */
    int foreground;

    /**
     * Whether guacd should simply print its version information and exit.
     */
    int print_version;

#ifdef ENABLE_SSL
    /**
     * SSL certificate file.
     */
    char* cert_file;

    /**
     * SSL private key file.
     */
    char* key_file;
#endif

    /**
     * The maximum log level to be logged by guacd.
     */
    guac_client_log_level max_log_level;

} guacd_config;

#endif

