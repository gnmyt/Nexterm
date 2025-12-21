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

#ifndef GUAC_ENCODE_WEBP_H
#define GUAC_ENCODE_WEBP_H

#include "config.h"

#include "guacamole/socket.h"
#include "guacamole/stream.h"

#include <cairo/cairo.h>

/**
 * Encodes the given surface as a WebP, and sends the resulting data over the
 * given stream and socket as blobs.
 *
 * @param socket
 *     The socket to send WebP blobs over.
 *
 * @param stream
 *     The stream to associate with each blob.
 *
 * @param surface
 *     The Cairo surface to write to the given stream and socket as PNG blobs.
 *
 * @param quality
 *     The WebP image quality to use. For lossy images, larger values indicate
 *     improving quality at the expense of larger file size. For lossless
 *     images, this dictates the quality of compression, with larger values
 *     producing smaller files at the expense of speed.
 *
 * @param lossless
 *     Zero for a lossy image, non-zero for lossless.
 *
 * @return
 *     Zero if the encoding operation is successful, non-zero otherwise.
 */
int guac_webp_write(guac_socket* socket, guac_stream* stream,
        cairo_surface_t* surface, int quality, int lossless);

#endif
