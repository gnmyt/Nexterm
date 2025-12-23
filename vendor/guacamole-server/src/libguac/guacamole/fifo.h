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

#ifndef GUAC_FIFO_H
#define GUAC_FIFO_H

#include "fifo-constants.h"
#include "fifo-types.h"
#include "flag.h"

#include <stddef.h>
#include <sys/types.h>

/**
 * Base FIFO implementation that allows arbitrary element sizes and arbitrary
 * element storage.
 *
 * @defgroup fifo guac_fifo
 * @{
 */

/**
 * Provides an abstract FIFO implementation (guac_fifo), which can support
 * arbitrary element sizes and storage.
 *
 * @file fifo.h
 */

struct guac_fifo {

    /**
     * The current state of this FIFO. This state primarily represents whether
     * the FIFO contains at least one item (is non-empty), but it is also used
     * to represent whether the FIFO is invalid (no longer permitted to contain
     * any items).
     */
    guac_flag state;

    /**
     * The maximum number of items that may be stored in this FIFO.
     */
    size_t max_items;

    /**
     * The size of each individual item, in bytes. All FIFO items must have a
     * constant size, though that size is implementation-dependent.
     */
    size_t item_size;

    /**
     * The index of the first item within this FIFO. As items are
     * added/removed, this value will advance as necessary to avoid needing to
     * spend CPU time moving existing items around in memory.
     */
    size_t head;

    /**
     * The current number of items stored within this FIFO.
     */
    size_t item_count;

    /**
     * The offset of the first byte of the implementation-specific array of
     * items within this FIFO, relative to the first byte of guac_fifo
     * structure.
     */
    ssize_t items_offset;

};

/**
 * Initializes the given guac_fifo such that it may be safely included in
 * shared memory and accessed by multiple processes. This function MUST be
 * invoked once (and ONLY once) for each guac_fifo being used, and MUST be
 * invoked before any such FIFO is used.
 *
 * The FIFO is empty upon initialization.
 *
 * @param fifo
 *     The FIFO to initialize.
 *
 * @param items
 *     The storage that the base implementation should use for queued items.
 *     This storage MUST be large enough to contain the maximum number of items
 *     as a contiguous array.
 *
 * @param max_items
 *     The maximum number of items supported by the provided storage.
 *
 * @param item_size
 *     The number of bytes required for each individual item in storage.
 */
void guac_fifo_init(guac_fifo* fifo, void* items,
        size_t max_items, size_t item_size);

/**
 * Releases all underlying resources used by the given guac_fifo, such as
 * pthread mutexes and conditions. The given guac_fifo MAY NOT be used after
 * this function has been called. This function MAY NOT be called while
 * exclusive access to the underlying state flag is held by any thread.
 *
 * This function does NOT free() the given guac_fifo pointer. If the memory
 * associated with the given guac_fifo has been manually allocated, it must be
 * manually freed as necessary.
 *
 * @param fifo
 *     The FIFO to destroy.
 */
void guac_fifo_destroy(guac_fifo* fifo);

/**
 * Marks the given FIFO as invalid, preventing any further additions or
 * removals from the FIFO. Attempts to add/remove items from the FIFO from this
 * point forward will fail immediately, as will any outstanding attempts to
 * remove items that are currently blocked.
 *
 * This function is primarily necessary to allow for threadsafe cleanup of
 * queues. Lacking this function, there is no guarantee that an outstanding
 * call to guac_fifo_dequeue() won't still be indefinitely blocking.
 * Internally, such a condition would mean that the mutex of the state flag is
 * still held, which would mean that the FIFO can never be safely destroyed.
 *
 * @param fifo
 *     The FIFO to invalidate.
 */
void guac_fifo_invalidate(guac_fifo* fifo);

/**
 * Returns whether the given FIFO is still valid. A FIFO is valid if it has not
 * yet been invalidated through a call to guac_fifo_invalidate().
 *
 * @param fifo
 *     The FIFO to test.
 *
 * @return
 *     Non-zero if the given FIFO is still valid, zero otherwise.
 */
int guac_fifo_is_valid(guac_fifo* fifo);

/**
 * Acquires exclusive access to this guac_fifo. When exclusive access is no
 * longer required, it must be manually relinquished through a call to
 * guac_fifo_unlock(). This function may be safely called while the current
 * thread already has exclusive access, however every such call must eventually
 * have a matching call to guac_fifo_unlock().
 *
 * NOTE: It is intended that locking/unlocking a guac_fifo may be used in lieu
 * of a mutex to guard concurrent access to any number of shared resources
 * related to the FIFO.
 *
 * @param fifo
 *     The guac_fifo to lock.
 */
void guac_fifo_lock(guac_fifo* fifo);

/**
 * Relinquishes exclusive access to this guac_fifo. This function may only be
 * called by a thread that currently has exclusive access to the guac_fifo.
 *
 * NOTE: It is intended that locking/unlocking a guac_fifo may be used in lieu
 * of a mutex to guard concurrent access to any number of shared resources
 * related to the FIFO.
 *
 * @param fifo
 *     The guac_fifo to unlock.
 */
void guac_fifo_unlock(guac_fifo* fifo);

/**
 * Adds a copy of the given item to the end of the given FIFO, and signals any
 * waiting threads that the FIFO is now non-empty. If there is insufficient
 * space in the FIFO, this function will block until at space is available. If
 * the FIFO is invalid or becomes invalid, this function returns immediately.
 *
 * @param fifo
 *     The FIFO to add an item to.
 *
 * @param item
 *     The item to add.
 *
 * @return
 *     Non-zero if the item was successfully added, zero if items cannot be
 *     added to the FIFO because the FIFO has been invalidated.
 */
int guac_fifo_enqueue(guac_fifo* fifo, const void* item);

/**
 * Atomically adds a copy of the given item to the end of the given FIFO,
 * signals any waiting threads that the FIFO is now non-empty, and leaves the
 * given FIFO locked. If there is insufficient space in the FIFO, this function
 * will block until at space is available. If the FIFO is invalid or becomes
 * invalid, this function returns immediately and the FIFO is not locked.
 *
 * @param fifo
 *     The FIFO to add an item to.
 *
 * @param item
 *     The item to add.
 *
 * @return
 *     Non-zero if the item was successfully added, zero if items cannot be
 *     added to the FIFO because the FIFO has been invalidated.
 */
int guac_fifo_enqueue_and_lock(guac_fifo* fifo, const void* item);

/**
 * Removes the oldest (first) item from the FIFO, storing a copy of that item
 * within the provided buffer. If the FIFO is currently empty, this function
 * will block until at least one item has been added to the FIFO or until the
 * FIFO becomes invalid.
 *
 * @param fifo
 *     The FIFO to remove an item from.
 *
 * @param item
 *     The buffer that should receive a copy of the removed item.
 *
 * @return
 *     Non-zero if an item was successfully removed, zero if items cannot be
 *     removed from the FIFO because the FIFO has been invalidated.
 */
int guac_fifo_dequeue(guac_fifo* fifo, void* item);

/**
 * Atomically removes the oldest (first) item from the FIFO, storing a copy of
 * that item within the provided buffer. If this function successfully removes
 * an item, the FIFO is left locked after this function returns. If the FIFO is
 * currently empty, this function will block until at least one item has been
 * added to the FIFO or until the FIFO becomes invalid.
 *
 * @param fifo
 *     The FIFO to remove an item from.
 *
 * @param item
 *     The buffer that should receive a copy of the removed item.
 *
 * @return
 *     Non-zero if an item was successfully removed, zero if items cannot be
 *     removed from the FIFO because the FIFO has been invalidated.
 */
int guac_fifo_dequeue_and_lock(guac_fifo* fifo, void* item);

/**
 * Removes the oldest (first) item from the FIFO, storing a copy of that item
 * within the provided buffer. If the FIFO is currently empty, this function
 * will block until at least one item has been added to the FIFO, until the
 * given timeout has elapsed, or until the FIFO becomes invalid.
 *
 * @param fifo
 *     The FIFO to remove an item from.
 *
 * @param item
 *     The buffer that should receive a copy of the removed item.
 *
 * @param msec_timeout
 *     The maximum number of milliseconds to wait for at least one item to be
 *     present within the FIFO (or for the FIFO to become invalid).
 *
 * @return
 *     Non-zero if an item was successfully removed, zero if the timeout has
 *     elapsed or if items cannot be removed from the FIFO because the FIFO has
 *     been invalidated.
 */
int guac_fifo_timed_dequeue(guac_fifo* fifo,
        void* item, int msec_timeout);

/**
 * Atomically removes the oldest (first) item from the FIFO, storing a copy of
 * that item within the provided buffer. If this function successfully removes
 * an item, the FIFO is left locked after this function returns. If the FIFO is
 * currently empty, this function will block until at least one item has been
 * added to the FIFO, until the given timeout has elapsed, or until the FIFO
 * becomes invalid.
 *
 * @param fifo
 *     The FIFO to remove an item from.
 *
 * @param item
 *     The buffer that should receive a copy of the removed item.
 *
 * @param msec_timeout
 *     The maximum number of milliseconds to wait for at least one item to be
 *     present within the FIFO (or for the FIFO to become invalid).
 *
 * @return
 *     Non-zero if an item was successfully removed, zero if the timeout has
 *     elapsed or if items cannot be removed from the FIFO because the FIFO has
 *     been invalidated.
 */
int guac_fifo_timed_dequeue_and_lock(guac_fifo* fifo,
        void* item, int msec_timeout);

/**
 * @}
 */

#endif

