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

#ifndef GUAC_WAIT_FD_H
#define GUAC_WAIT_FD_H

/**
 * Waits for data to be available for reading on a given file descriptor,
 * similar to the POSIX select() and poll() functions.
 *
 * @param fd
 *     The file descriptor to wait for.
 *
 * @param usec_timeout
 *     The maximum number of microseconds to wait for data, or -1 to
 *     potentially wait forever.
 *
 * @return
 *     Positive if data is available for reading, zero if the timeout elapsed
 *     and no data is available, negative if an error occurs, in which case
 *     errno will also be set.
 */
int guac_wait_for_fd(int fd, int usec_timeout);

#endif
