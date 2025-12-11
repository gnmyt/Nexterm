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

#ifndef _GUAC_CLIENT_TYPES_H
#define _GUAC_CLIENT_TYPES_H

/**
 * Type definitions related to the Guacamole client structure, guac_client.
 *
 * @file client-types.h
 */

/**
 * Guacamole proxy client.
 *
 * Represents a Guacamole proxy client (the client which communicates to
 * a server on behalf of Guacamole, on behalf of the web-client).
 */
typedef struct guac_client guac_client;

/**
 * Possible current states of the Guacamole client. Currently, the only
 * two states are GUAC_CLIENT_RUNNING and GUAC_CLIENT_STOPPING.
 */
typedef enum guac_client_state {

    /**
     * The state of the client from when it has been allocated by the main
     * daemon until it is killed or disconnected.
     */
    GUAC_CLIENT_RUNNING,

    /**
     * The state of the client when a stop has been requested, signalling the
     * I/O threads to shutdown.
     */
    GUAC_CLIENT_STOPPING

} guac_client_state;

/**
 * All supported log levels used by the logging subsystem of each Guacamole
 * client. With the exception of GUAC_LOG_TRACE, these log levels correspond to
 * a subset of the log levels defined by RFC 5424.
 */
typedef enum guac_client_log_level {

    /**
     * Fatal errors.
     */
    GUAC_LOG_ERROR = 3,

    /**
     * Non-fatal conditions that indicate problems.
     */
    GUAC_LOG_WARNING = 4,

    /**
     * Informational messages of general interest to users or administrators.
     */
    GUAC_LOG_INFO = 6,

    /**
     * Informational messages which can be useful for debugging, but are
     * otherwise not useful to users or administrators. It is expected that
     * debug level messages, while verbose, will not negatively affect
     * performance.
     */
    GUAC_LOG_DEBUG = 7,

    /**
     * Informational messages which can be useful for debugging, like
     * GUAC_LOG_DEBUG, but which are so low-level that they may affect
     * performance.
     */
    GUAC_LOG_TRACE = 8

} guac_client_log_level;

#endif

