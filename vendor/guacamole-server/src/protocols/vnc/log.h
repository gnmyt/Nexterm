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

#ifndef GUAC_VNC_LOG_H
#define GUAC_VNC_LOG_H

#include "config.h"

#include "client.h"
#include "common/iconv.h"

#include <cairo/cairo.h>
#include <guacamole/client.h>
#include <guacamole/layer.h>
#include <guacamole/protocol.h>
#include <guacamole/socket.h>
#include <rfb/rfbclient.h>
#include <rfb/rfbproto.h>

#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <syslog.h>

/**
 * Callback invoked by libVNCServer when an informational message needs to be
 * logged.
 *
 * @param format
 *     A printf-style format string to log.
 *
 * @param ...
 *     The values to use when filling the conversion specifiers within the
 *     format string.
 */
void guac_vnc_client_log_info(const char* format, ...);

/**
 * Callback invoked by libVNCServer when an error message needs to be logged.
 *
 * @param format
 *     A printf-style format string to log.
 *
 * @param ...
 *     The values to use when filling the conversion specifiers within the
 *     format string.
 */
void guac_vnc_client_log_error(const char* format, ...);

#endif

