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

#ifndef _GUAC_POOL_H
#define _GUAC_POOL_H

/**
 * Provides functions and structures for maintaining dynamically allocated and
 * freed pools of integers.
 *
 * @file pool.h
 */

#include "pool-types.h"

#include <pthread.h>

struct guac_pool {

    /**
     * The minimum number of integers which must have been returned by
     * guac_pool_next_int before previously-used and freed integers are
     * allowed to be returned.
     */
    int min_size;

    /**
     * The number of integers currently in use.
     */
    int active;

    /**
     * The next integer to be released (after no more integers remain in the
     * pool.
     */
    int __next_value;

    /**
     * The first integer in the pool, if any.
     */
    guac_pool_int* __head;

    /**
     * The last integer in the pool, if any.
     */
    guac_pool_int* __tail;

    /**
     * Lock which is acquired when the pool is being modified or accessed.
     */
    pthread_mutex_t __lock;

};

struct guac_pool_int {

    /**
     * The integer value of this pool entry.
     */
    int value;

    /**
     * The next available (unused) guac_pool_int in the list of
     * allocated but free'd ints.
     */
    guac_pool_int* __next;

};

/**
 * Allocates a new guac_pool having the given minimum size.
 *
 * @param size The minimum number of integers which must have been returned by
 *             guac_pool_next_int before freed integers (previously used
 *             integers) are allowed to be returned.
 * @return A new, empty guac_pool, having the given minimum size.
 */
guac_pool* guac_pool_alloc(int size);

/**
 * Frees the given guac_pool.
 *
 * @param pool The guac_pool to free.
 */
void guac_pool_free(guac_pool* pool);

/**
 * Returns the next available integer from the given guac_pool. All integers
 * returned are non-negative, and are returned in sequence, starting from 0.
 * This operation is atomic.
 *
 * @param pool
 *     The guac_pool to retrieve an integer from.
 *
 * @return
 *     The next available integer, which may be either an integer not yet
 *     returned by a call to guac_pool_next_int, or an integer which was
 *     previously returned but has since been freed.
 */
int guac_pool_next_int(guac_pool* pool);

/**
 * Returns the next available integer from the given guac_pool that is below
 * the given limit. If no such integer can be obtained because all such
 * integers are already in use, -1 will be returned instead. All integers
 * successfully returned are non-negative, and are returned in sequence,
 * starting from 0. This operation is atomic.
 *
 * @param pool
 *     The guac_pool to retrieve an integer from.
 *
 * @param limit
 *     The exclusive upper bound to enforce on all integers returned by this
 *     function. Integers of this value or greater will never be returned. If
 *     all other integers are already in use, -1 will be returned instead.
 *
 * @return
 *     The next available integer, which may be either an integer not yet
 *     returned by a call to guac_pool_next_int, or an integer which was
 *     previously returned but has since been freed. If all integers are
 *     currently in use and no integer can be returned without reaching the
 *     given limit, -1 is returned.
 */
int guac_pool_next_int_below(guac_pool* pool, int limit);

/**
 * Returns the next available integer from the given guac_pool that is below
 * the given limit. If no such integer can be obtained because all such
 * integers are already in use, the current process will abort and this
 * function will not return. All integers successfully returned are
 * non-negative, and are returned in sequence, starting from 0. This operation
 * is atomic.
 *
 * @param pool
 *     The guac_pool to retrieve an integer from.
 *
 * @param limit
 *     The exclusive upper bound to enforce on all integers returned by this
 *     function. Integers of this value or greater will never be returned. If
 *     all other integers are already in use, the current process will abort
 *     and this function will not return.
 *
 * @return
 *     The next available integer, which may be either an integer not yet
 *     returned by a call to guac_pool_next_int, or an integer which was
 *     previously returned but has since been freed. If all integers are
 *     currently in use and no integer can be returned without reaching the
 *     given limit, the current process will abort and this function will not
 *     return.
 */
int guac_pool_next_int_below_or_die(guac_pool* pool, int limit);

/**
 * Frees the given integer back into the given guac_pool. The integer given
 * will be available for future calls to guac_pool_next_int.  This operation is
 * atomic.
 *
 * @param pool
 *     The guac_pool to free the given integer into.
 *
 * @param value
 *     The integer which should be returned to the given pool, such that it can
 *     be received by a future call to guac_pool_next_int.
 */
void guac_pool_free_int(guac_pool* pool, int value);

#endif

