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

#include "guacamole/assert.h"
#include "guacamole/mem.h"
#include "guacamole/pool.h"

#include <limits.h>
#include <stdlib.h>

guac_pool* guac_pool_alloc(int size) {

    pthread_mutexattr_t lock_attributes;
    guac_pool* pool = guac_mem_alloc(sizeof(guac_pool));

    /* If unable to allocate, just return NULL. */
    if (pool == NULL)
        return NULL;

    /* Initialize empty pool */
    pool->min_size = size;
    pool->active = 0;
    pool->__next_value = 0;
    pool->__head = NULL;
    pool->__tail = NULL;

    /* Init lock */
    pthread_mutexattr_init(&lock_attributes);
    pthread_mutexattr_setpshared(&lock_attributes, PTHREAD_PROCESS_SHARED);
    pthread_mutex_init(&(pool->__lock), &lock_attributes);

    return pool;

}

void guac_pool_free(guac_pool* pool) {

    /* Free all ints in pool */
    guac_pool_int* current = pool->__head;
    while (current != NULL) {

        guac_pool_int* old = current;
        current = current->__next;

        guac_mem_free(old);
    }

    /* Destroy lock */
    pthread_mutex_destroy(&(pool->__lock));

    /* Free pool */
    guac_mem_free(pool);

}

/**
 * Returns the next available integer from the given guac_pool. All integers
 * returned are non-negative, and are returned in sequence, starting from 0.
 *
 * Unlike the public guac_pool_next_int() function, this function is NOT atomic
 * and depends on the caller having already acquired the pool's lock.
 *
 * @param pool
 *     The guac_pool to retrieve an integer from.
 *
 * @return
 *     The next available integer, which may be either an integer not yet
 *     returned by a call to guac_pool_next_int, or an integer which was
 *     previously returned but has since been freed.
 */
static int __guac_pool_next_int(guac_pool* pool) {

    int value;

    /* It's unlikely that any usage of guac_pool will ever manage to reach
     * INT_MAX concurrent requests for integers, but we definitely should bail
     * out if ever this does happen. Tracing this sort of issue down would be
     * extremely difficult without fail-fast behavior. */
    GUAC_ASSERT(pool->__next_value < INT_MAX);
    GUAC_ASSERT(pool->active < INT_MAX);

    pool->active++;

    /* If more integers are needed, return a new one. */
    if (pool->__head == NULL || pool->__next_value < pool->min_size)
        value = pool->__next_value++;

    /* Otherwise, reuse a previously freed integer */
    else {

        value = pool->__head->value;

        /* If only one element exists, reset pool to empty. */
        if (pool->__tail == pool->__head) {
            guac_mem_free(pool->__head);
            pool->__head = NULL;
            pool->__tail = NULL;
        }

        /* Otherwise, advance head. */
        else {
            guac_pool_int* old_head = pool->__head;
            pool->__head = old_head->__next;
            guac_mem_free(old_head);
        }

    }

    /* Again, this should never happen and would be a sign of some fairly
     * fundamental assumption failing. It's important for such things to fail
     * fast. */
    GUAC_ASSERT(value >= 0);

    return value;

}

int guac_pool_next_int(guac_pool* pool) {

    pthread_mutex_lock(&(pool->__lock));
    int value = __guac_pool_next_int(pool);
    pthread_mutex_unlock(&(pool->__lock));

    return value;

}

int guac_pool_next_int_below(guac_pool* pool, int limit) {

    pthread_mutex_lock(&(pool->__lock));

    int value;

    /* Explicitly bail out now if there we would need to return a new integer,
     * but can't without reaching the given limit */
    if (pool->active >= limit || (pool->__next_value >= limit && pool->__head == NULL)) {
        value = -1;
    }

    /* In all other cases, attempt to obtain the requested integer (either
     * reusing a freed integer or allocating a new one), but verify that some
     * fundamental misuse of guac_pool hasn't resulted in values defying
     * expectations */
    else {
        value = __guac_pool_next_int(pool);
        GUAC_ASSERT(value < limit);
    }

    pthread_mutex_unlock(&(pool->__lock));

    return value;

}

int guac_pool_next_int_below_or_die(guac_pool* pool, int limit) {

    int value = guac_pool_next_int_below(pool, limit);

    /* Abort current process entirely if no integer can be obtained without
     * reaching the given limit */
    GUAC_ASSERT(value >= 0);

    return value;

}

void guac_pool_free_int(guac_pool* pool, int value) {

    /* Allocate and initialize new returned value */
    guac_pool_int* pool_int = guac_mem_alloc(sizeof(guac_pool_int));
    pool_int->value = value;
    pool_int->__next = NULL;

    /* Acquire exclusive access */
    pthread_mutex_lock(&(pool->__lock));

    GUAC_ASSERT(pool->active > 0);
    pool->active--;

    /* If pool empty, store as sole entry. */
    if (pool->__tail == NULL)
        pool->__head = pool->__tail = pool_int;

    /* Otherwise, append to end of pool. */
    else {
        pool->__tail->__next = pool_int;
        pool->__tail = pool_int;
    }

    /* Value has been freed */
    pthread_mutex_unlock(&(pool->__lock));

}

