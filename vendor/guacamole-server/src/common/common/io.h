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

#ifndef __GUAC_COMMON_IO_H
#define __GUAC_COMMON_IO_H

#include "config.h"

/**
 * Writes absolutely all bytes from within the given buffer, returning an error
 * only if the required writes fail.
 *
 * @param fd The file descriptor to write to.
 * @param buffer The buffer containing the data to write.
 * @param length The number of bytes to write.
 * @return The number of bytes written, or a value less than zero if an error
 *         occurs.
 */
int guac_common_write(int fd, void* buffer, int length);

/**
 * Reads enough bytes to fill the given buffer, returning an error only if the
 * required reads fail.
 *
 * @param fd The file descriptor to read from.
 * @param buffer The buffer to read data into.
 * @param length The number of bytes to read.
 * @return The number of bytes read, or a value less than zero if an error
 *         occurs.
 */
int guac_common_read(int fd, void* buffer, int length);

#endif

