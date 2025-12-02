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

#include "guacamole/fifo.h"
#include "guacamole/flag.h"

#include <stddef.h>
#include <stdlib.h>
#include <string.h>

void guac_fifo_init(guac_fifo* fifo, void* items,
        size_t max_items, size_t item_size) {

    /* Init values describing the memory structure of the items array */
    fifo->items_offset = (char*) items - (char*) fifo;
    fifo->max_items = max_items;
    fifo->item_size = item_size;

    /* The fifo is currently empty */
    guac_flag_init(&fifo->state);
    guac_flag_set(&fifo->state, GUAC_FIFO_STATE_READY);
    fifo->head = 0;
    fifo->item_count = 0;

}

void guac_fifo_destroy(guac_fifo* fifo) {
    guac_flag_destroy(&fifo->state);
}

void guac_fifo_invalidate(guac_fifo* fifo) {
    guac_flag_set(&fifo->state, GUAC_FIFO_STATE_INVALID);
}

void guac_fifo_lock(guac_fifo* fifo) {
    guac_flag_lock(&fifo->state);
}

void guac_fifo_unlock(guac_fifo* fifo) {
    guac_flag_unlock(&fifo->state);
}

int guac_fifo_is_valid(guac_fifo* fifo) {
    /* We don't need to acquire the lock here as (1) we are only reading the
     * flag and (2) the flag in question is a one-way, single-use signal (it's
     * only set, never cleared) */
    return !(fifo->state.value & GUAC_FIFO_STATE_INVALID);
}

int guac_fifo_enqueue(guac_fifo* fifo,
        const void* item) {

    if (!guac_fifo_enqueue_and_lock(fifo, item))
        return 0;

    guac_flag_unlock(&fifo->state);
    return 1;

}

int guac_fifo_enqueue_and_lock(guac_fifo* fifo,
        const void* item) {

    /* Block until fifo is ready for further items OR until the fifo is
     * invalidated */
    guac_flag_wait_and_lock(&fifo->state,
            GUAC_FIFO_STATE_INVALID | GUAC_FIFO_STATE_READY);

    /* Bail out if the fifo has become invalid */
    if (fifo->state.value & GUAC_FIFO_STATE_INVALID) {
        guac_flag_unlock(&fifo->state);
        return 0;
    }

    /* Abort program execution entirely if the fifo reports readiness but
     * somehow actually does not have available space (this should never happen
     * and indicates a bug) */
    if (fifo->item_count >= fifo->max_items)
        abort();

    /* Update count of items within the fifo, clearing the readiness flag if
     * there is no longer any space for further items */
    fifo->item_count++;
    if (fifo->item_count == fifo->max_items)
        guac_flag_clear(&fifo->state, GUAC_FIFO_STATE_READY);

    /* NOTE: At this point, there are `item_count - 1` items present in the
     * fifo, and `item_count - 1` is the index of the space in the items array
     * that should receive the item being added (relative to head) */

    /* Copy data of item buffer into last item in fifo */
    size_t tail = (fifo->head + fifo->item_count - 1) % fifo->max_items;
    void* tail_item = ((char*) fifo) + fifo->items_offset + fifo->item_size * tail;
    memcpy(tail_item, item, fifo->item_size);

    /* Advise any waiting threads that the fifo is now non-empty */
    guac_flag_set(&fifo->state, GUAC_FIFO_STATE_NONEMPTY);

    /* Item enqueued successfully */
    return 1;

}

/**
 * Dequeues a single item from the given guac_fifo, storing a copy
 * of that item in the provided buffer. The event fifo MUST be non-empty. The
 * state flag of the fifo MUST already be locked.
 *
 * @param fifo
 *     The guac_fifo to dequeue an item from.
 *
 * @param item
 *     The buffer that should receive a copy of the dequeued item.
 */
static void dequeue(guac_fifo* fifo, void* item) {

    /* Copy data of first item in fifo to provided output buffer */
    void* head_item = ((char*) fifo) + fifo->items_offset + fifo->item_size * fifo->head;
    memcpy(item, head_item, fifo->item_size);

    /* Advance to next item in fifo, if any */
    fifo->item_count--;
    fifo->head = (fifo->head + 1) % fifo->max_items;

    /* Keep state flag up-to-date with respect to non-emptiness ... */
    if (fifo->item_count == 0)
        guac_flag_clear(&fifo->state, GUAC_FIFO_STATE_NONEMPTY);

    /* ... and readiness for further items */
    guac_flag_set(&fifo->state, GUAC_FIFO_STATE_READY);

    /* Item has been dequeued successfully */

}

int guac_fifo_dequeue(guac_fifo* fifo, void* item) {

    if (!guac_fifo_dequeue_and_lock(fifo, item))
        return 0;

    guac_flag_unlock(&fifo->state);
    return 1;

}

int guac_fifo_timed_dequeue(guac_fifo* fifo,
        void* item, int msec_timeout) {

    if (!guac_fifo_timed_dequeue_and_lock(fifo, item, msec_timeout))
        return 0;

    guac_flag_unlock(&fifo->state);
    return 1;

}

int guac_fifo_dequeue_and_lock(guac_fifo* fifo, void* item) {

    /* Block indefinitely while waiting for an item to be added, but bail out
     * if the fifo becomes invalid */
    guac_flag_wait_and_lock(&fifo->state,
            GUAC_FIFO_STATE_NONEMPTY | GUAC_FIFO_STATE_INVALID);

    if (fifo->state.value & GUAC_FIFO_STATE_INVALID) {
        guac_flag_unlock(&fifo->state);
        return 0;
    }

    dequeue(fifo, item);
    return 1;

}

int guac_fifo_timed_dequeue_and_lock(guac_fifo* fifo,
        void* item, int msec_timeout) {

    /* Wait up to timeout for an item to be present in the fifo, failing if no
     * items enter the fifo before the timeout lapses */
    if (!guac_flag_timedwait_and_lock(&fifo->state,
                GUAC_FIFO_STATE_NONEMPTY | GUAC_FIFO_STATE_INVALID,
                msec_timeout)) {
        return 0;
    }

    if (fifo->state.value & GUAC_FIFO_STATE_INVALID) {
        guac_flag_unlock(&fifo->state);
        return 0;
    }

    dequeue(fifo, item);
    return 1;

}

