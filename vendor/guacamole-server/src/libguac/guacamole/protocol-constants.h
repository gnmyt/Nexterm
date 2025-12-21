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

#ifndef GUAC_PROTOCOL_CONSTANTS_H
#define GUAC_PROTOCOL_CONSTANTS_H

/**
 * Constants related to the Guacamole protocol.
 *
 * @file protocol-constants.h
 */

/**
 * This defines the overall protocol version that this build of libguac
 * supports.  The protocol version is used to provide compatibility between
 * potentially different versions of Guacamole server and clients.  The
 * version number is a MAJOR_MINOR_PATCH version that matches the versioning
 * used throughout the components of the Guacamole project.  This version
 * will not necessarily increment with the other components, unless additional
 * functionality is introduced that affects compatibility.
 * 
 * This version is passed by the __guac_protocol_send_args() function from the
 * server to the client during the client/server handshake.
 */
#define GUACAMOLE_PROTOCOL_VERSION "VERSION_1_5_0"

/**
 * The maximum number of bytes that should be sent in any one blob instruction
 * to ensure the instruction does not exceed the maximum allowed instruction
 * size.
 *
 * @see GUAC_INSTRUCTION_MAX_LENGTH 
 */
#define GUAC_PROTOCOL_BLOB_MAX_LENGTH 6048

/**
 * The name of the layer parameter defining the number of simultaneous points
 * of contact supported by a layer. This parameter should be set to a non-zero
 * value if the associated layer should receive touch events ("touch"
 * instructions).
 *
 * This value specified for this parameter is advisory, and the client is not
 * required to honor the declared level of touch support.  Implementations are
 * expected to safely handle or ignore any received touch events, regardless of
 * the level of touch support declared.
 *
 * @see guac_protocol_send_set_int()
 */
#define GUAC_PROTOCOL_LAYER_PARAMETER_MULTI_TOUCH "multi-touch"

#endif

