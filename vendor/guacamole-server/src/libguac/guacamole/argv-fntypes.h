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

#ifndef GUAC_ARGV_FNTYPES_H
#define GUAC_ARGV_FNTYPES_H

/**
 * Function type definitions related to automatic handling of received "argv"
 * instructions.
 *
 * @file argv-fntypes.h
 */

#include "user-types.h"

/**
 * Callback which is invoked by the automatic "argv" handling when the full
 * value of a received argument has been received.
 *
 * @param user
 *     The user that opened the argument value stream.
 *
 * @param mimetype
 *     The mimetype of the data that will be sent along the stream.
 *
 * @param name
 *     The name of the connection parameter being updated. It is up to the
 *     implementation of this handler to decide whether and how to update a
 *     connection parameter.
 *
 * @param value
 *     The value of the received argument.
 *
 * @param data
 *     Any arbitrary data that was provided when the received argument was
 *     registered with guac_argv_register().
 *
 * @return
 *     Zero if the received argument value has been accepted and has either
 *     taken effect or is being intentionally ignored, non-zero otherwise.
 */
typedef int guac_argv_callback(guac_user* user, const char* mimetype,
        const char* name, const char* value, void* data);

#endif

