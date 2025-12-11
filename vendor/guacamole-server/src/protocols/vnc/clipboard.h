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

#ifndef _GUAC_VNC_CLIPBOARD_H
#define _GUAC_VNC_CLIPBOARD_H

#include "config.h"

#include <guacamole/client.h>
#include <guacamole/user.h>
#include <rfb/rfbclient.h>

/**
 * Sets the encoding of clipboard data exchanged with the VNC server to the
 * encoding having the given name. If the name is NULL, or is invalid, the
 * standard ISO8859-1 encoding will be used.
 *
 * @param client
 *     The client to set the clipboard encoding of.
 *
 * @param name
 *     The name of the encoding to use for all clipboard data. Valid values
 *     are: "ISO8859-1", "UTF-8", "UTF-16", "CP1252", or NULL.
 *
 * @return
 *     Zero if the chosen encoding is standard for VNC, or non-zero if the VNC
 *     standard is being violated.
 */
int guac_vnc_set_clipboard_encoding(guac_client* client,
        const char* name);

/**
 * Handler for inbound clipboard data from Guacamole users.
 */
guac_user_clipboard_handler guac_vnc_clipboard_handler;

/**
 * Handler for stream data related to clipboard.
 */
guac_user_blob_handler guac_vnc_clipboard_blob_handler;

/**
 * Handler for end-of-stream related to clipboard.
 */
guac_user_end_handler guac_vnc_clipboard_end_handler;

/**
 * Handler for clipboard data received via VNC, invoked by libVNCServer
 * whenever text has been copied or cut within the VNC session.
 *
 * @param client
 *     The VNC client associated with the session in which the user cut or
 *     copied text.
 *
 * @param text
 *     The string of cut/copied text.
 *
 * @param textlen
 *     The number of bytes in the string of cut/copied text.
 */
void guac_vnc_cut_text(rfbClient* client, const char* text, int textlen);

#endif

