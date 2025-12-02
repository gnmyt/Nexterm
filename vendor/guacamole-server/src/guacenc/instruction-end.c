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
#include "image-stream.h"
#include "log.h"

#include <guacamole/client.h>

#include <stdlib.h>

int guacenc_handle_end(guacenc_display* display, int argc, char** argv) {

    /* Verify argument count */
    if (argc < 1) {
        guacenc_log(GUAC_LOG_WARNING, "\"end\" instruction incomplete");
        return 1;
    }

    /* Parse arguments */
    int index = atoi(argv[0]);

    /* Retrieve image stream */
    guacenc_image_stream* stream =
        guacenc_display_get_image_stream(display, index);
    if (stream == NULL)
        return 1;

    /* Retrieve destination buffer */
    guacenc_buffer* buffer =
        guacenc_display_get_related_buffer(display, stream->index);
    if (buffer == NULL)
        return 1;

    /* End image stream, drawing final image to the buffer */
    return guacenc_image_stream_end(stream, buffer);

}

