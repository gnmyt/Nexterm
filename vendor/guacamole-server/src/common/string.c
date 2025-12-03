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

#include "common/string.h"

#include <guacamole/mem.h>

#include <stdlib.h>
#include <string.h>

size_t guac_count_occurrences(const char* string, char c) {

    size_t count = 0;

    while (*string != 0) {

        /* Count each occurrence */
        if (*string == c)
            count = guac_mem_ckd_add_or_die(count, 1);

        /* Next character */
        string++;

    }

    return count;

}

char** guac_split(const char* string, char delim) {

    size_t i = 0;

    /* Calculate number of tokens present based on number of delimiters */
    size_t token_count = guac_mem_ckd_add_or_die(guac_count_occurrences(string, delim), 1);
    const char* token_start = string;

    /* Allocate space for tokens, including NULL terminator */
    char** tokens = guac_mem_alloc(sizeof(char*), guac_mem_ckd_add_or_die(token_count, 1));

    do {

        size_t length;
        char* token;

        /* Find end of token */
        while (*string != 0 && *string != delim)
            string++;

        /* Calculate token length */
        length = string - token_start;

        /* Allocate space for token and NULL terminator */
        tokens[i++] = token = guac_mem_alloc(guac_mem_ckd_add_or_die(length, 1));

        /* Copy token, store null */
        memcpy(token, token_start, length);
        token[length] = 0;

        /* Stop at end of string */
        if (*string == 0)
            break;

        /* Next token */
        token_start = ++string;

    } while (i < token_count);

    /* NULL terminator */
    tokens[i] = NULL;

    return tokens;

}

