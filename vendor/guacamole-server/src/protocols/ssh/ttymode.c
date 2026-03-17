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
#include "ttymode.h"

#include <stdarg.h>
#include <stdbool.h>
#include <stdlib.h>
#include <string.h>

int guac_ssh_ttymodes_init(char opcode_array[], ...) {

    /* Initialize the variable argument list. */
    va_list args;
    va_start(args, opcode_array);

    /* Initialize array pointer and byte counter. */
    char *current = opcode_array;

    /* Loop through variable argument list. */
    while (true) {
       
        /* Next argument should be an opcode. */
        char opcode = (char)va_arg(args, int);
        *(current++) = opcode;

        /* If it's the end opcode, we're done. */
        if (opcode == GUAC_SSH_TTY_OP_END)
            break;

        /* Next argument should be 4-byte value. */
        uint32_t value = va_arg(args, uint32_t);
        *(current++) = (value >> 24) & 0xFF;
        *(current++) = (value >> 16) & 0xFF;
        *(current++) = (value >> 8) & 0xFF;
        *(current++) = value & 0xFF;
    }

    /* We're done processing arguments. */
    va_end(args);

    return current - opcode_array;

}
