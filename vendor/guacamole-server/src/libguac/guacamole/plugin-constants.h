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

#ifndef _GUAC_PLUGIN_CONSTANTS_H
#define _GUAC_PLUGIN_CONSTANTS_H

/**
 * Constants related to client plugins.
 *
 * @file plugin-constants.h
 */

/**
 * String prefix which begins the library filename of all client plugins.
 */
#define GUAC_PROTOCOL_LIBRARY_PREFIX "libguac-client-"

/**
 * String suffix which ends the library filename of all client plugins.
 */
#define GUAC_PROTOCOL_LIBRARY_SUFFIX ".so"

/**
 * The maximum number of characters (COUNTING NULL TERMINATOR) to allow
 * for protocol names within the library filename of client plugins.
 */
#define GUAC_PROTOCOL_NAME_LIMIT 256

/**
 * The maximum number of characters (INCLUDING NULL TERMINATOR) that a
 * character array containing the concatenation of the library prefix,
 * protocol name, and suffix can contain, assuming the protocol name is
 * limited to GUAC_PROTOCOL_NAME_LIMIT characters.
 */
#define GUAC_PROTOCOL_LIBRARY_LIMIT (                                  \
                                                                       \
      sizeof(GUAC_PROTOCOL_LIBRARY_PREFIX) - 1 /* "libguac-client-" */ \
    +        GUAC_PROTOCOL_NAME_LIMIT      - 1 /* [up to 256 chars] */ \
    + sizeof(GUAC_PROTOCOL_LIBRARY_SUFFIX) - 1 /* ".so"             */ \
    + 1                                        /* NULL terminator   */ \
                                                                       \
)

#endif

