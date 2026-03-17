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

#ifndef GUAC_OBJECT_H
#define GUAC_OBJECT_H

/**
 * Provides functions and structures required for allocating and using objects.
 *
 * @file object.h
 */

#include "object-types.h"
#include "user-fntypes.h"

struct guac_object {

    /**
     * The index of this object.
     */
    int index;

    /**
     * Arbitrary data associated with this object.
     */
    void* data;

    /**
     * Handler for get events sent by the Guacamole web-client.
     *
     * The handler takes a guac_object, containing the object index which will
     * persist through the duration of the transfer, and the name of the stream
     * being requested. It is up to the get handler to create the required body
     * stream.
     *
     * Example:
     * @code
     *     int get_handler(guac_user* user, guac_object* object,
     *             char* name);
     *
     *     int some_function(guac_user* user) {
     *
     *         guac_object* object = guac_user_alloc_object(user);
     *         object->get_handler = get_handler;
     *
     *     }
     * @endcode
     */
    guac_user_get_handler* get_handler;

    /**
     * Handler for put events sent by the Guacamole web-client.
     *
     * The handler takes a guac_object and guac_stream, which each contain their
     * respective indices which will persist through the duration of the
     * transfer, the mimetype of the data being transferred, and the name of
     * the stream within the object being written to.
     *
     * Example:
     * @code
     *     int put_handler(guac_user* user, guac_object* object,
     *             guac_stream* stream, char* mimetype, char* name);
     *
     *     int some_function(guac_user* user) {
     *
     *         guac_object* object = guac_user_alloc_object(user);
     *         object->put_handler = put_handler;
     *
     *     }
     * @endcode
     */
    guac_user_put_handler* put_handler;

};

#endif

