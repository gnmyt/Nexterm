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

#include <pthread.h>
#include <stdint.h>
#include "guacamole/error.h"
#include "guacamole/rwlock.h"

/**
 * The value indicating that the current thread holds neither the read or write
 * locks.
 */
#define GUAC_REENTRANT_LOCK_NO_LOCK 0

/**
 * The value indicating that the current thread holds the read lock.
 */
#define GUAC_REENTRANT_LOCK_READ_LOCK 1

/**
 * The value indicating that the current thread holds the write lock.
 */
#define GUAC_REENTRANT_LOCK_WRITE_LOCK 2

void guac_rwlock_init(guac_rwlock* lock) {

    /* Configure to allow sharing this lock with child processes */
    pthread_rwlockattr_t lock_attributes;
    pthread_rwlockattr_init(&lock_attributes);
    pthread_rwlockattr_setpshared(&lock_attributes, PTHREAD_PROCESS_SHARED);

    /* Initialize the rwlock */
    pthread_rwlock_init(&(lock->lock), &lock_attributes);

    /* Initialize the  flags to 0, as threads won't have acquired it yet */
    pthread_key_create(&(lock->key), (void *) 0);

}

void guac_rwlock_destroy(guac_rwlock* lock) {

    /* Destroy the rwlock */
    pthread_rwlock_destroy(&(lock->lock));

    /* Destroy the thread-local key */
    pthread_key_delete(lock->key);

}

/**
 * Clean up and destroy the provided guac reentrant rwlock.
 *
 * @param lock
 *     The guac reentrant rwlock to be destroyed.
 */
void guac_rwlock_destroy(guac_rwlock* lock);

/**
 * Extract and return the flag indicating which lock is held, if any, from the
 * provided key value. The flag is always stored in the least-significant
 * nibble of the value.
 *
 * @param value
 *     The key value containing the flag.
 *
 * @return
 *     The flag indicating which lock is held, if any.
 */
static uintptr_t get_lock_flag(uintptr_t value) {
    return value & 0xF;
}

/**
 * Extract and return the lock count from the provided key. This returned value
 * is the difference between the number of lock and unlock requests made by the
 * current thread. This count is always stored in the remaining value after the
 * least-significant nibble where the flag is stored.
 *
 * @param value
 *     The key value containing the count.
 *
 * @return
 *     The difference between the number of lock and unlock requests made by
 *     the current thread.
 */
static uintptr_t get_lock_count(uintptr_t value) {
    return value >> 4;
}

/**
 * Given a flag indicating if and how the current thread controls a lock, and
 * a count of the depth of lock requests, return a value containing the flag
 * in the least-significant nibble, and the count in the rest.
 *
 * @param flag
 *     A flag indicating which lock, if any, is held by the current thread.
 *
 * @param count
 *     The depth of the lock attempt by the current thread, i.e. the number of
 *     lock requests minus unlock requests.
 *
 * @return
 *     A value containing the flag in the least-significant nibble, and the
 *     count in the rest, cast to a void* for thread-local storage.
 */
static void* get_value_from_flag_and_count(
        uintptr_t flag, uintptr_t count) {
    return (void*) ((flag & 0xF) | count << 4);
}

/**
 * Return zero if adding one to the current count would overflow the storage
 * allocated to the count, or a non-zero value otherwise.
 *
 * @param current_count
 *     The current count for a lock that the current thread is trying to
 *     reentrantly acquire.
 *
 * @return
 *     Zero if adding one to the current count would overflow the storage
 *     allocated to the count, or a non-zero value otherwise.
 */
static int would_overflow_count(uintptr_t current_count) {

    /**
     * The count will overflow if it's already equal or greater to the maximum
     * possible value that can be stored in a uintptr_t excluding the first nibble.
     */
    return current_count >= (UINTPTR_MAX >> 4);

}

int guac_rwlock_acquire_write_lock(guac_rwlock* reentrant_rwlock) {

    uintptr_t key_value = (uintptr_t) pthread_getspecific(reentrant_rwlock->key);
    uintptr_t flag = get_lock_flag(key_value);
    uintptr_t count = get_lock_count(key_value);

    /* If acquiring this lock again would overflow the counter storage */
    if (would_overflow_count(count)) {

        guac_error = GUAC_STATUS_TOO_MANY;
        guac_error_message = "Unable to acquire write lock because there's"
                " insufficient space to store another level of lock depth";

        return 1;

    }

    /* If the current thread already holds the write lock, increment the count */
    if (flag == GUAC_REENTRANT_LOCK_WRITE_LOCK) {
        pthread_setspecific(reentrant_rwlock->key, get_value_from_flag_and_count(
                flag, count + 1));

        /* This thread already has the lock */
        return 0;
    }

    /*
     * The read lock must be released before the write lock can be acquired.
     * This is a little odd because it may mean that a function further down
     * the stack may have requested a read lock, which will get upgraded to a
     * write lock by another function without the caller knowing about it. This
     * shouldn't cause any issues, however.
     */
    if (flag == GUAC_REENTRANT_LOCK_READ_LOCK)
        pthread_rwlock_unlock(&(reentrant_rwlock->lock));

    /* Acquire the write lock */
    pthread_rwlock_wrlock(&(reentrant_rwlock->lock));

    /* Mark that the current thread has the lock, and increment the count */
    pthread_setspecific(reentrant_rwlock->key, get_value_from_flag_and_count(
            GUAC_REENTRANT_LOCK_WRITE_LOCK, count + 1));

    return 0;

}

int guac_rwlock_acquire_read_lock(guac_rwlock* reentrant_rwlock) {

    uintptr_t key_value = (uintptr_t) pthread_getspecific(reentrant_rwlock->key);
    uintptr_t flag = get_lock_flag(key_value);
    uintptr_t count = get_lock_count(key_value);

    /* If acquiring this lock again would overflow the counter storage */
    if (would_overflow_count(count)) {

        guac_error = GUAC_STATUS_TOO_MANY;
        guac_error_message = "Unable to acquire read lock because there's"
                " insufficient space to store another level of lock depth";

        return 1;

    }

    /* The current thread may read if either the read or write lock is held */
    if (
            flag == GUAC_REENTRANT_LOCK_READ_LOCK ||
            flag == GUAC_REENTRANT_LOCK_WRITE_LOCK
    ) {

        /* Increment the depth counter */
        pthread_setspecific(reentrant_rwlock->key, get_value_from_flag_and_count(
                flag, count + 1));

        /* This thread already has the lock */
        return 0;
    }

    /* Acquire the lock */
    pthread_rwlock_rdlock(&(reentrant_rwlock->lock));

    /* Set the flag that the current thread has the read lock */
    pthread_setspecific(reentrant_rwlock->key, get_value_from_flag_and_count(
                GUAC_REENTRANT_LOCK_READ_LOCK, 1));

    return 0;

}

int guac_rwlock_release_lock(guac_rwlock* reentrant_rwlock) {

    uintptr_t key_value = (uintptr_t) pthread_getspecific(reentrant_rwlock->key);
    uintptr_t flag = get_lock_flag(key_value);
    uintptr_t count = get_lock_count(key_value);

    /*
     * Return an error if an attempt is made to release a lock that the current
     * thread does not control.
     */
    if (count <= 0) {

        guac_error = GUAC_STATUS_INVALID_ARGUMENT;
        guac_error_message = "Unable to free rwlock because it's not held by"
                " the current thread";

        return 1;

    }

    /* Release the lock if this is the last locked level */
    if (count == 1) {

        pthread_rwlock_unlock(&(reentrant_rwlock->lock));

        /* Set the flag that the current thread holds no locks */
        pthread_setspecific(reentrant_rwlock->key, get_value_from_flag_and_count(
                GUAC_REENTRANT_LOCK_NO_LOCK, 0));

        return 0;
    }

    /* Do not release the lock since it's still in use - just decrement */
    pthread_setspecific(reentrant_rwlock->key, get_value_from_flag_and_count(
            flag, count - 1));

    return 0;

}
