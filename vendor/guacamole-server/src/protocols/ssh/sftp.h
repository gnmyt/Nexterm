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

#ifndef _SSH_GUAC_SFTP_H
#define _SSH_GUAC_SFTP_H

#include "config.h"

#include <guacamole/client.h>
#include <guacamole/stream.h>
#include <guacamole/user.h>

/**
 * Handles an incoming stream from a Guacamole "file" instruction, saving the
 * contents of that stream to the file having the given name within the
 * upload directory set by guac_sftp_set_upload_path().
 */
guac_user_file_handler guac_sftp_file_handler;

/**
 * Initiates an SFTP file download to the user via the Guacamole "file"
 * instruction. The download will be automatically monitored and continued
 * after this function terminates in response to "ack" instructions received by
 * the client.
 *
 * @param client
 *     The client associated with the terminal emulator receiving the file.
 *
 * @param filename
 *     The filename of the file to download, relative to the given filesystem.
 *
 * @return
 *     The file stream created for the file download, already configured to
 *     properly handle "ack" responses, etc. from the client.
 */
guac_stream* guac_sftp_download_file(guac_client* client, char* filename);

/**
 * Sets the destination directory for future uploads submitted via Guacamole
 * "file" instruction. This function has no bearing on the destination
 * directories of files uploaded with "put" instructions.
 *
 * @param client
 *     The client setting the upload path.
 *
 * @param path
 *     The path to use for future uploads submitted via "file" instruction.
 */
void guac_sftp_set_upload_path(guac_client* client, char* path);

#endif

