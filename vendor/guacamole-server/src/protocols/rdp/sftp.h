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

#ifndef GUAC_RDP_SFTP_H
#define GUAC_RDP_SFTP_H

#include <guacamole/stream.h>
#include <guacamole/user.h>

/**
 * Handles an incoming stream from a Guacamole "file" instruction, saving the
 * contents of that stream to the file having the given name.
 *
 * @param user
 *     The user uploading the file.
 *
 * @param stream
 *     The stream through which the uploaded file data will be received.
 *
 * @param mimetype
 *     The mimetype of the data being received.
 *
 * @param filename
 *     The filename of the file to write to.
 *
 * @return
 *     Zero if the incoming stream has been handled successfully, non-zero on
 *     failure.
 */
int guac_rdp_sftp_file_handler(guac_user* user, guac_stream* stream,
        char* mimetype, char* filename);

#endif

