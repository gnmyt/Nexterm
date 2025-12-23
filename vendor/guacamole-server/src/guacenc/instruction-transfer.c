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

int guacenc_handle_transfer(guacenc_display* display, int argc, char** argv) {

    /* Verify argument count */
    if (argc < 9) {
        guacenc_log(GUAC_LOG_WARNING, "\"transform\" instruction incomplete");
        return 1;
    }

    /* Parse arguments */
    int src_index = atoi(argv[0]);
    int src_x = atoi(argv[1]);
    int src_y = atoi(argv[2]);
    int src_w = atoi(argv[3]);
    int src_h = atoi(argv[4]);
    int function = atoi(argv[5]);
    int dst_index = atoi(argv[6]);
    int dst_x = atoi(argv[7]);
    int dst_y = atoi(argv[8]);

    /* TODO: Unimplemented for now (rarely used) */
    guacenc_log(GUAC_LOG_DEBUG, "transform: src_layer=%i (%i, %i) %ix%i "
            "function=0x%X dst_layer=%i (%i, %i)", src_index, src_x, src_y,
            src_w, src_h, function, dst_index, dst_x, dst_y);

    return 0;

}

