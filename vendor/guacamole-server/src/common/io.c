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
#include "common/io.h"

#include <unistd.h>

int guac_common_write(int fd, void* buffer, int length) {
    
    unsigned char* bytes = (unsigned char*) buffer;

    while (length > 0) {

        /* Attempt write */
        int bytes_written = write(fd, bytes, length);
        if (bytes_written < 0)
            return bytes_written;

        /* Update buffer */
        length -= bytes_written;
        bytes += bytes_written;

    }

    /* Success */
    return length;

}

int guac_common_read(int fd, void* buffer, int length) {

    unsigned char* bytes = (unsigned char*) buffer;

    while (length > 0) {

        /* Attempt read */
        int bytes_read = read(fd, bytes, length);
        if (bytes_read < 0)
            return bytes_read;

        /* Update buffer */
        length -= bytes_read;
        bytes += bytes_read;

    }

    /* Success */
    return length;

}

