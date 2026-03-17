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

#ifndef GUAC_ENCODE_PNG_H
#define GUAC_ENCODE_PNG_H

#include "config.h"

#include "guacamole/socket.h"
#include "guacamole/stream.h"

#include <cairo/cairo.h>

/**
 * Encodes the given surface as a PNG, and sends the resulting data over the
 * given stream and socket as blobs.
 *
 * @param socket
 *     The socket to send PNG blobs over.
 *
 * @param stream
 *     The stream to associate with each blob.
 *
 * @param surface
 *     The Cairo surface to write to the given stream and socket as PNG blobs.
 *
 * @return
 *     Zero if the encoding operation is successful, non-zero otherwise.
 */
int guac_png_write(guac_socket* socket, guac_stream* stream,
        cairo_surface_t* surface);

#endif

