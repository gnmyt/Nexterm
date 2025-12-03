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
#include "state.h"
#include "instructions.h"
#include "log.h"

#include <string.h>

guaclog_instruction_handler_mapping guaclog_instruction_handler_map[] = {
    {"key", guaclog_handle_key},
    {NULL,  NULL}
};

int guaclog_handle_instruction(guaclog_state* state, const char* opcode,
        int argc, char** argv) {

    /* Search through mapping for instruction handler having given opcode */
    guaclog_instruction_handler_mapping* current = guaclog_instruction_handler_map;
    while (current->opcode != NULL) {

        /* Invoke handler if opcode matches (if defined) */
        if (strcmp(current->opcode, opcode) == 0) {

            /* Invoke defined handler */
            guaclog_instruction_handler* handler = current->handler;
            if (handler != NULL)
                return handler(state, argc, argv);

            /* Log defined but unimplemented instructions */
            guaclog_log(GUAC_LOG_DEBUG, "\"%s\" not implemented", opcode);
            return 0;

        }

        /* Next candidate handler */
        current++;

    } /* end opcode search */

    /* Ignore any unknown instructions */
    return 0;

}

