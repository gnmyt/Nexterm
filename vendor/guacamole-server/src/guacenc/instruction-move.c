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

#include <stdlib.h>

int guacenc_handle_move(guacenc_display* display, int argc, char** argv) {

    /* Verify argument count */
    if (argc < 5) {
        guacenc_log(GUAC_LOG_WARNING, "\"move\" instruction incomplete");
        return 1;
    }

    /* Parse arguments */
    int layer_index = atoi(argv[0]);
    int parent_index = atoi(argv[1]);
    int x = atoi(argv[2]);
    int y = atoi(argv[3]);
    int z = atoi(argv[4]);

    /* Retrieve requested layer */
    guacenc_layer* layer = guacenc_display_get_layer(display, layer_index);
    if (layer == NULL)
        return 1;

    /* Validate parent layer */
    if (guacenc_display_get_layer(display, parent_index) == NULL)
        return 1;

    /* Update layer properties */
    layer->parent_index = parent_index;
    layer->x = x;
    layer->y = y;
    layer->z = z;

    return 0;

}

