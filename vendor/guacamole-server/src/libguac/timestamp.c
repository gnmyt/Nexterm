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

#include "guacamole/timestamp.h"

#include <sys/time.h>

#if defined(HAVE_CLOCK_GETTIME) || defined(HAVE_NANOSLEEP)
#include <time.h>
#endif

guac_timestamp guac_timestamp_current() {

#ifdef HAVE_CLOCK_GETTIME

    struct timespec current;

    /* Get current time, monotonically increasing */ 
#ifdef CLOCK_MONOTONIC
    clock_gettime(CLOCK_MONOTONIC, &current);
#else
    clock_gettime(CLOCK_REALTIME, &current);
#endif    

    /* Calculate milliseconds */
    return (guac_timestamp) current.tv_sec * 1000 + current.tv_nsec / 1000000;

#else

    struct timeval current;

    /* Get current time */
    gettimeofday(&current, NULL);
    
    /* Calculate milliseconds */
    return (guac_timestamp) current.tv_sec * 1000 + current.tv_usec / 1000;

#endif

}

void guac_timestamp_msleep(int duration) {

    /* Split milliseconds into equivalent seconds + nanoseconds */
    struct timespec sleep_period = {
        .tv_sec  =  duration / 1000,
        .tv_nsec = (duration % 1000) * 1000000
    };

    /* Sleep for specified interval */
    nanosleep(&sleep_period, NULL);

}

