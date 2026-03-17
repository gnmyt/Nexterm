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

#include <guacamole/timestamp.h>

#include <errno.h>
#include <limits.h>
#include <string.h>
#include <stdlib.h>

int guacenc_parse_int(char* arg, int* i) {

    char* end;

    /* Parse string as an integer */
    errno = 0;
    long int value = strtol(arg, &end, 10);

    /* Ignore number if invalid / non-positive */
    if (errno != 0 || value <= 0 || value > INT_MAX || *end != '\0')
        return 1;

    /* Store value */
    *i = value;

    /* Parsing successful */
    return 0;

}

int guacenc_parse_dimensions(char* arg, int* width, int* height) {

    /* Locate the 'x' within the dimensions string */
    char* x = strchr(arg, 'x');
    if (x == NULL)
        return 1;

    /* Replace 'x' with a null terminator */
    *x = '\0';

    /* Parse width and height */
    int w, h;
    if (guacenc_parse_int(arg, &w) || guacenc_parse_int(x+1, &h))
        return 1;

    /* Width and height are both valid */
    *width = w;
    *height = h;

    return 0;

}

guac_timestamp guacenc_parse_timestamp(const char* str) {

    int sign = 1;
    int64_t num = 0;

    for (; *str != '\0'; str++) {

        /* Flip sign for each '-' encountered */
        if (*str == '-')
            sign = -sign;

        /* If not '-', assume the character is a digit */
        else
            num = num * 10 + (*str - '0');

    }

    return (guac_timestamp) (num * sign);

}

