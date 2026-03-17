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

#include "guacamole/flag.h"

#include <pthread.h>
#include <stdint.h>
#include <stdlib.h>
#include <time.h>
#include <unistd.h>

/**
 * The number of nanoseconds in a whole second.
 */
#define NANOS_PER_SECOND 1000000000L

void guac_flag_init(guac_flag* event_flag) {

    /* The condition used by guac_flag to signal changes in its
     * value must be safe to share between processes, and must use the
     * system-wide monotonic clock (not the realtime clock, which is subject to
     * time changes) */
    pthread_condattr_t cond_attr;
    pthread_condattr_init(&cond_attr);
    pthread_condattr_setclock(&cond_attr, CLOCK_MONOTONIC);
    pthread_condattr_setpshared(&cond_attr, PTHREAD_PROCESS_SHARED);
    pthread_cond_init(&event_flag->value_changed, &cond_attr);

    /* In addition to being safe to share between processes, the mutex used by
     * guac_flag to guard concurrent access to its value (AND to
     * signal changes in its value) must be recursive (you can lock the mutex
     * again even if the current thread has already locked it) */
    pthread_mutexattr_t mutex_attr;
    pthread_mutexattr_init(&mutex_attr);
    pthread_mutexattr_setpshared(&mutex_attr, PTHREAD_PROCESS_SHARED);
    pthread_mutexattr_settype(&mutex_attr, PTHREAD_MUTEX_RECURSIVE);
    pthread_mutex_init(&event_flag->value_mutex, &mutex_attr);

    /* The initial value of all flags is unset (0) */
    event_flag->value = 0;

}

void guac_flag_destroy(guac_flag* event_flag) {
    pthread_cond_destroy(&event_flag->value_changed);
    pthread_mutex_destroy(&event_flag->value_mutex);
}

void guac_flag_set_and_lock(guac_flag* event_flag,
        unsigned int flags) {

    guac_flag_lock(event_flag);

    /* Set specific bits of flag, leaving other bits unaffected */
    unsigned int old_value = event_flag->value;
    event_flag->value |= flags;

    /* Signal other threads only if flag has changed as a result of this call */
    if (event_flag->value != old_value)
        pthread_cond_broadcast(&event_flag->value_changed);

}

void guac_flag_set(guac_flag* event_flag,
        unsigned int flags) {
    guac_flag_set_and_lock(event_flag, flags);
    guac_flag_unlock(event_flag);
}

void guac_flag_clear_and_lock(guac_flag* event_flag,
        unsigned int flags) {

    guac_flag_lock(event_flag);

    /* Clear specific bits of flag, leaving other bits unaffected */
    event_flag->value &= ~flags;

    /* NOTE: Other threads are NOT signalled here. Threads wait only for flags
     * to be set, not for flags to be cleared. */

}

void guac_flag_clear(guac_flag* event_flag,
        unsigned int flags) {
    guac_flag_clear_and_lock(event_flag, flags);
    guac_flag_unlock(event_flag);
}

void guac_flag_lock(guac_flag* event_flag) {
    pthread_mutex_lock(&event_flag->value_mutex);
}

void guac_flag_unlock(guac_flag* event_flag) {
    pthread_mutex_unlock(&event_flag->value_mutex);
}

void guac_flag_wait_and_lock(guac_flag* event_flag,
        unsigned int flags) {

    guac_flag_lock(event_flag);

    /* Continue waiting until at least one of the desired flags has been set */
    while (!(event_flag->value & flags)) {

        /* Wait for any change to any flags, bailing out if something is wrong
         * that would prevent waiting from ever succeeding (such a failure
         * would turn this into a busy loop) */
        if (pthread_cond_wait(&event_flag->value_changed,
                    &event_flag->value_mutex)) {
            abort(); /* This should not happen except due to a bug */
        }

    }

    /* If we reach this point, at least one of the desired flags has been set,
     * and it is intentional that we continue to hold the lock (acquired on
     * behalf of the caller) */

}

int guac_flag_timedwait_and_lock(guac_flag* event_flag,
        unsigned int flags, unsigned int msec_timeout) {

    guac_flag_lock(event_flag);

    /* Short path: skip wait completely when possible */
    if (!msec_timeout) {

        int retval = event_flag->value & flags;
        if (!retval)
            guac_flag_unlock(event_flag);

        return retval;

    }

    struct timespec ts_timeout;
    clock_gettime(CLOCK_MONOTONIC, &ts_timeout);

    uint64_t nsec_timeout = msec_timeout * 1000000 + ts_timeout.tv_nsec;
    ts_timeout.tv_sec += nsec_timeout / NANOS_PER_SECOND;
    ts_timeout.tv_nsec = nsec_timeout % NANOS_PER_SECOND;

    /* Continue waiting until at least one of the desired flags has been set */
    while (!(event_flag->value & flags)) {

        /* Wait for any change to any flags, failing if a timeout occurs */
        if (pthread_cond_timedwait(&event_flag->value_changed,
                    &event_flag->value_mutex, &ts_timeout)) {
            guac_flag_unlock(event_flag);
            return 0;
        }

    }

    /* If we reach this point, at least one of the desired flags has been set,
     * and it is intentional that we continue to hold the lock (acquired on
     * behalf of the caller) */
    return 1;

}

