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

#ifndef GUAC_VNC_INPUT_H
#define GUAC_VNC_INPUT_H

#include "config.h"

#include <guacamole/user.h>

/**
 * Handler for Guacamole user mouse events.
 */
guac_user_mouse_handler guac_vnc_user_mouse_handler;

/**
 * Handler for Guacamole user key events.
 */
guac_user_key_handler guac_vnc_user_key_handler;

#ifdef LIBVNC_HAS_EXTENDED_KEY_EVENT
/**
 * Handler for Guacamole user extended key events with scancode.
 * Uses SendExtendedKeyEvent to send XT scancodes for proper keyboard layout support.
 */
guac_user_key_handler_ext guac_vnc_user_key_handler_ext;
#endif // LIBVNC_HAS_EXTENDED_KEY_EVENT

/**
 * Handler for Guacamole user resize events.
 */
guac_user_size_handler guac_vnc_user_size_handler;

#endif // GUAC_VNC_INPUT_H
