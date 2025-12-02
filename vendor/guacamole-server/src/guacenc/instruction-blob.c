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

#include "config.h"
#include "display.h"
#include "log.h"

#include <guacamole/client.h>
#include <guacamole/protocol.h>

#include <stdlib.h>

int guacenc_handle_blob(guacenc_display* display, int argc, char** argv) {

    /* Verify argument count */
    if (argc < 2) {
        guacenc_log(GUAC_LOG_WARNING, "\"blob\" instruction incomplete");
        return 1;
    }

    /* Parse arguments */
    int index = atoi(argv[0]);
    char* data = argv[1];
    int length = guac_protocol_decode_base64(data);

    /* Retrieve image stream */
    guacenc_image_stream* stream =
        guacenc_display_get_image_stream(display, index);
    if (stream == NULL)
        return 1;

    /* Send data to decoder within associated stream */
    return guacenc_image_stream_receive(stream, (unsigned char*) data, length);

}

