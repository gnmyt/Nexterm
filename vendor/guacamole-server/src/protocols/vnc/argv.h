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

#ifndef ARGV_H
#define ARGV_H

#include "config.h"

#include <guacamole/argv.h>
#include <guacamole/user.h>

/**
 * Handles a received argument value from a Guacamole "argv" instruction,
 * updating the given connection parameter.
 *
 * As noted in the user.c file, care should be taken when updating this
 * callback to make sure that arguments are handled correctly when
 * a connection is marked as read-only, and to make sure that any
 * usage of this callback for non-owner users of a connection does
 * not have unintended security implications.
 */
guac_argv_callback guac_vnc_argv_callback;

/**
 * The name of the parameter Guacamole will use to specify/update the username
 * for the VNC connection.
 */
#define GUAC_VNC_ARGV_USERNAME "username"

/**
 * The name of the parameter Guacamole will use to specify/update the password
 * for the VNC connection.
 */
#define GUAC_VNC_ARGV_PASSWORD "password"

#endif /* ARGV_H */

