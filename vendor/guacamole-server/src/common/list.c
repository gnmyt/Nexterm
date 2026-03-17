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
#include "common/list.h"

#include <guacamole/mem.h>

#include <stdlib.h>
#include <pthread.h>

guac_common_list* guac_common_list_alloc() {

    guac_common_list* list = guac_mem_alloc(sizeof(guac_common_list));

    pthread_mutex_init(&list->_lock, NULL);
    list->head = NULL;

    return list;

}

void guac_common_list_free(
        guac_common_list* list,
        guac_common_list_element_free_handler* free_element_handler) {

    /* Free every element of the list */
    guac_common_list_element* element = list->head;
    while(element != NULL) {

        guac_common_list_element* next = element->next;

        if (free_element_handler != NULL)
            free_element_handler(element->data);

        guac_mem_free(element);
        element = next;
    }

    /* Free the list itself */
    guac_mem_free(list);

}

guac_common_list_element* guac_common_list_add(guac_common_list* list,
        void* data) {

    /* Allocate element, initialize as new head */
    guac_common_list_element* element =
        guac_mem_alloc(sizeof(guac_common_list_element));
    element->data = data;
    element->next = list->head;
    element->_ptr = &(list->head);

    /* If head already existed, point it at this element */
    if (list->head != NULL)
        list->head->_ptr = &(element->next);

    /* Set as new head */
    list->head = element;
    return element;

}

void guac_common_list_remove(guac_common_list* list,
        guac_common_list_element* element) {

    /* Point previous (or head) to next */
    *(element->_ptr) = element->next;

    if (element->next != NULL)
        element->next->_ptr = element->_ptr;

    guac_mem_free(element);

}

void guac_common_list_lock(guac_common_list* list) {
    pthread_mutex_lock(&list->_lock);
}

void guac_common_list_unlock(guac_common_list* list) {
    pthread_mutex_unlock(&list->_lock);
}

