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
#include "instructions.h"
#include "log.h"

#include <guacamole/client.h>

#include <string.h>

guacenc_instruction_handler_mapping guacenc_instruction_handler_map[] = {
    {"blob",     guacenc_handle_blob},
    {"img",      guacenc_handle_img},
    {"end",      guacenc_handle_end},
    {"mouse",    guacenc_handle_mouse},
    {"sync",     guacenc_handle_sync},
    {"cursor",   guacenc_handle_cursor},
    {"copy",     guacenc_handle_copy},
    {"transfer", guacenc_handle_transfer},
    {"size",     guacenc_handle_size},
    {"rect",     guacenc_handle_rect},
    {"cfill",    guacenc_handle_cfill},
    {"move",     guacenc_handle_move},
    {"shade",    guacenc_handle_shade},
    {"dispose",  guacenc_handle_dispose},
    {NULL,       NULL}
};

int guacenc_handle_instruction(guacenc_display* display, const char* opcode,
        int argc, char** argv) {

    /* Search through mapping for instruction handler having given opcode */
    guacenc_instruction_handler_mapping* current = guacenc_instruction_handler_map;
    while (current->opcode != NULL) {

        /* Invoke handler if opcode matches (if defined) */
        if (strcmp(current->opcode, opcode) == 0) {

            /* Invoke defined handler */
            guacenc_instruction_handler* handler = current->handler;
            if (handler != NULL)
                return handler(display, argc, argv);

            /* Log defined but unimplemented instructions */
            guacenc_log(GUAC_LOG_DEBUG, "\"%s\" not implemented", opcode);
            return 0;

        }

        /* Next candidate handler */
        current++;

    } /* end opcode search */

    /* Ignore any unknown instructions */
    return 0;

}

