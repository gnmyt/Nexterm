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

#ifndef __GUAC_LIST_H
#define __GUAC_LIST_H

#include "config.h"

#include <pthread.h>

/**
 * Generic linked list element.
 */
typedef struct guac_common_list_element guac_common_list_element;

struct guac_common_list_element {

    /**
     * The next element in the list, or NULL if none.
     */
    guac_common_list_element* next;

    /**
     * Generic data.
     */
    void* data;

    /**
     * The pointer which points to this element, whether another element's
     * next pointer, or the entire list's head pointer.
     */
    guac_common_list_element** _ptr;

};

/**
 * Generic linked list.
 */
typedef struct guac_common_list {

    /**
     * The first element in the list.
     */
    guac_common_list_element* head;

    /**
     * Mutex which is locked when exclusive access to the list is required.
     * Possession of the lock is not enforced outside the
     * guac_common_list_lock() function.
     */
    pthread_mutex_t _lock;

} guac_common_list;

/**
 * Creates a new list.
 *
 * @return A newly-allocated list.
 */
guac_common_list* guac_common_list_alloc();

/**
 * A handler that will be invoked with the data pointer of each element of
 * the list when guac_common_list_free() is invoked.
 *
 * @param data
 *     The arbitrary data pointed to by the list element.
 */
typedef void guac_common_list_element_free_handler(void* data);

/**
 * Frees the given list.
 *
 * @param list The list to free.
 *
 * @param free_element_handler
 *     A handler that will be invoked with each arbitrary data pointer in the
 *     list, if not NULL.
 */
void guac_common_list_free(guac_common_list* list,
        guac_common_list_element_free_handler* free_element_handler);

/**
 * Adds the given data to the list as a new element, returning the created
 * element.
 *
 * @param list The list to add an element to.
 * @param data The data to associate with the newly-created element.
 * @param The newly-created element.
 */
guac_common_list_element* guac_common_list_add(guac_common_list* list,
        void* data);

/**
 * Removes the given element from the list.
 *
 * @param list The list to remove the element from.
 * @param element The element to remove.
 */
void guac_common_list_remove(guac_common_list* list,
        guac_common_list_element* element);

/**
 * Acquires exclusive access to the list. No list functions implicitly lock or
 * unlock the list, so any list access which must be threadsafe must use
 * guac_common_list_lock() and guac_common_list_unlock() manually.
 *
 * @param list The list to acquire exclusive access to.
 */
void guac_common_list_lock(guac_common_list* list);

/**
 * Releases exclusive access to the list.
 *
 * @param list The list to release from exclusive access.
 */
void guac_common_list_unlock(guac_common_list* list);

#endif

