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

#ifndef GUAC_FLAG_H
#define GUAC_FLAG_H

#include "flag-types.h"

#include <pthread.h>

struct guac_flag {

    /**
     * The mutex used to ensure concurrent changes to the value of this flag
     * are threadsafe, as well as to satisfy the requirements of the pthread
     * conditional used to signal changes to the value of this flag.
     */
    pthread_mutex_t value_mutex;

    /**
     * Condition variable that signals when the value of this flag has changed.
     */
    pthread_cond_t value_changed;

    /**
     * The current value of this flag. This value may be the bitwise OR'd value
     * of any number of arbitrary flags, so long as those flags fit within an
     * int. It is entirely up to the user of this guac_flag to
     * define the meaning of any value(s) assigned.
     */
    unsigned int value;

};

/**
 * Initializes the given guac_flag such that it may be safely
 * included in shared memory and accessed by multiple processes. This function
 * MUST be invoked once (and ONLY once) for each guac_flag being
 * used, and MUST be invoked before any such flag is used.
 *
 * The value of the flag upon initialization is 0 (no flags set).
 *
 * @param event_flag
 *     The flag to initialize.
 */
void guac_flag_init(guac_flag* event_flag);

/**
 * Releases all underlying resources used by the given guac_flag,
 * such as pthread mutexes and conditions. The given guac_flag MAY
 * NOT be used after this function has been called. This function MAY NOT be
 * called while exclusive access to the guac_flag is held by any
 * thread.
 *
 * This function does NOT free() the given guac_flag pointer. If the
 * memory associated with the given guac_flag has been manually
 * allocated, it must be manually freed as necessary.
 *
 * @param event_flag
 *     The flag to destroy.
 */
void guac_flag_destroy(guac_flag* event_flag);

/**
 * Sets the given bitwise flag(s) within the value of the given
 * guac_flag, setting their corresponding bits to 1. The values of
 * other bitwise flags are not affected. If other threads are waiting for any
 * of these flags to be set, and at least one such flag has been set as a
 * result of this call, they will be signalled accordingly.
 *
 * This function is threadsafe and will acquire exclusive access to the given
 * guac_flag prior to changing the flag value. It is also safe to
 * call this function if exclusive access has already been acquired through
 * guac_flag_lock() or similar.
 *
 * @param event_flag
 *     The guac_flag to modify.
 *
 * @param flags
 *     The bitwise OR'd value of the flags to be set.
 */
void guac_flag_set(guac_flag* event_flag,
        unsigned int flags);

/**
 * Sets the given bitwise flag(s) within the value of the given guac_flag,
 * setting their corresponding bits to 1, while also acquiring exclusive access
 * to the guac_flag. The values of other bitwise flags are not affected. If
 * other threads are waiting for any of these flags to be set, and at least one
 * such flag has been set as a result of this call, they will be signalled
 * accordingly.
 *
 * This function is threadsafe and will acquire exclusive access to the given
 * guac_flag prior to changing the flag value. It is also safe to
 * call this function if exclusive access has already been acquired through
 * guac_flag_lock() or similar.
 *
 * @param event_flag
 *     The guac_flag to modify.
 *
 * @param flags
 *     The bitwise OR'd value of the flags to be set.
 */
void guac_flag_set_and_lock(guac_flag* event_flag,
        unsigned int flags);

/**
 * Clears the given bitwise flag(s) within the value of the given
 * guac_flag, setting their corresponding bits to 0. The values of
 * other bitwise flags are not affected. Unlike guac_flag_set(),
 * no threads will be notified that these flag values have changed.
 *
 * This function is threadsafe and will acquire exclusive access to the given
 * guac_flag prior to changing the flag value. It is also safe to
 * call this function if exclusive access has already been acquired through
 * guac_flag_lock() or similar.
 *
 * @param event_flag
 *     The guac_flag to modify.
 *
 * @param flags
 *     The bitwise OR'd value of the flags to be cleared. Each bit in this
 *     value that is set to 1 will be set to 0 in the value of the
 *     guac_flag.
 */
void guac_flag_clear(guac_flag* event_flag,
        unsigned int flags);

/**
 * Clears the given bitwise flag(s) within the value of the given guac_flag,
 * setting their corresponding bits to 0, while also acquiring exclusive access
 * to the guac_flag. The values of other bitwise flags are not affected. Unlike
 * guac_flag_set(), no threads will be notified that these flag values have
 * changed.
 *
 * This function is threadsafe and will acquire exclusive access to the given
 * guac_flag prior to changing the flag value. It is also safe to
 * call this function if exclusive access has already been acquired through
 * guac_flag_lock() or similar.
 *
 * @param event_flag
 *     The guac_flag to modify.
 *
 * @param flags
 *     The bitwise OR'd value of the flags to be cleared. Each bit in this
 *     value that is set to 1 will be set to 0 in the value of the
 *     guac_flag.
 */
void guac_flag_clear_and_lock(guac_flag* event_flag,
        unsigned int flags);

/**
 * Acquires exclusive access to this guac_flag. When exclusive
 * access is no longer required, it must be manually relinquished through a
 * call to guac_flag_unlock(). This function may be safely called
 * while the current thread already has exclusive access, however every such
 * call must eventually have a matching call to guac_flag_unlock().
 *
 * NOTE: It is intended that locking/unlocking a guac_flag may be
 * used in lieu of a mutex to guard concurrent access to any number of shared
 * resources related to the flag.
 *
 * @param event_flag
 *     The guac_flag to lock.
 */
void guac_flag_lock(guac_flag* event_flag);

/**
 * Relinquishes exclusive access to this guac_flag. This function
 * may only be called by a thread that currently has exclusive access to the
 * guac_flag.
 *
 * NOTE: It is intended that locking/unlocking a guac_flag may be
 * used in lieu of a mutex to guard concurrent access to any number of shared
 * resources related to the flag.
 *
 * @param event_flag
 *     The guac_flag to unlock.
 */
void guac_flag_unlock(guac_flag* event_flag);

/**
 * Waits indefinitely for any of the given flags to be set within the given
 * guac_flag. This function returns only after at least one of the
 * given flags has been set. After this function returns, the current thread
 * has exclusive access to the guac_flag and MUST relinquish that
 * access with a call to guac_flag_unlock() when finished.
 *
 * @param event_flag
 *     The guac_flag to wait on.
 *
 * @param flags
 *     The bitwise OR'd value of the specific flag(s) to wait for.
 */
void guac_flag_wait_and_lock(guac_flag* event_flag,
        unsigned int flags);

/**
 * Waits no longer than the given number of milliseconds for any of the given
 * flags to be set within the given guac_flag. This function returns
 * after at least one of the given flags has been set, or after the provided
 * time limit expires. After this function returns successfully, the current
 * thread has exclusive access to the guac_flag and MUST relinquish
 * that access with a call to guac_flag_unlock() when finished. If
 * the time limit lapses before any of the given flags has been set, this
 * function returns unsuccessfully without acquiring exclusive access.
 *
 * @param event_flag
 *     The guac_flag to wait on.
 *
 * @param flags
 *     The bitwise OR'd value of the specific flag(s) to wait for.
 *
 * @param msec_timeout
 *     The maximum number of milliseconds to wait for at least one of the
 *     desired flags to be set.
 *
 * @return
 *     Non-zero if at least one of the desired flags has been set and the
 *     current thread now has exclusive access to the guac_flag, zero if none
 *     of the desired flags were set within the time limit and the current
 *     thread DOES NOT have exclusive access.
 */
int guac_flag_timedwait_and_lock(guac_flag* event_flag,
        unsigned int flags, unsigned int msec_timeout);

#endif

