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

#ifndef _GUAC_USER_CONSTANTS_H
#define _GUAC_USER_CONSTANTS_H

/**
 * Constants related to the Guacamole user structure, guac_user.
 *
 * @file user-constants.h
 */

/**
 * The character prefix which identifies a user ID.
 */
#define GUAC_USER_ID_PREFIX '@'

/**
 * The maximum number of inbound or outbound streams supported by any one
 * guac_user.
 */
#define GUAC_USER_MAX_STREAMS 512

/**
 * The index of a closed stream.
 */
#define GUAC_USER_CLOSED_STREAM_INDEX -1

/**
 * The maximum number of objects supported by any one guac_client.
 */
#define GUAC_USER_MAX_OBJECTS 64

/**
 * The index of an object which has not been defined.
 */
#define GUAC_USER_UNDEFINED_OBJECT_INDEX -1

/**
 * The stream name reserved for the root of a Guacamole protocol object.
 */
#define GUAC_USER_OBJECT_ROOT_NAME "/"

/**
 * The mimetype of a stream containing a map of available stream names to their
 * corresponding mimetypes. The root of a Guacamole protocol object is
 * guaranteed to have this type.
 */
#define GUAC_USER_STREAM_INDEX_MIMETYPE "application/vnd.glyptodon.guacamole.stream-index+json"

#endif

