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
#include "proc.h"
#include "proc-map.h"

#include <guacamole/client.h>
#include <guacamole/mem.h>

#include <stdlib.h>
#include <string.h>

/**
 * A value to be stored in the buckets, containing the guacd proc itself,
 * as well as a link to the element in the list of all guacd processes.
 */
typedef struct guacd_proc_map_entry {

    /**
     * The guacd process itself.
     */
    guacd_proc* proc;

    /**
     * A pointer to the corresponding entry in the list of all processes.
     */
    guac_common_list_element* element;

} guacd_proc_map_entry;

/**
 * Returns a hash code based on the given connection ID.
 *
 * @param str
 *     The string containing the connection ID.
 *
 * @return
 *     A reasonably well-distributed hash code for the given string.
 */
static unsigned int __guacd_client_hash(const char* str) {

    unsigned int hash_value = 0;
    int c;

    /* Apply each character in string to the hash code */
    while ((c = *(str++)))
        hash_value = hash_value * 65599 + c;

    return hash_value;

}

/**
 * Locates the bucket corresponding to the hash code indicated by the given id,
 * where the hash code is dictated by __guacd_client_hash().  Each bucket is an
 * instance of guac_common_list.
 *
 * @param map
 *     The map to retrieve the hash bucket from.
 *
 * @param id
 *     The ID whose hash code determines the bucket being retrieved.
 *
 * @return
 *     The bucket corresponding to the hash code for the given ID, represented
 *     by a guac_common_list.
 */
static guac_common_list* __guacd_proc_find_bucket(guacd_proc_map* map,
        const char* id) {

    const int index = __guacd_client_hash(id) % GUACD_PROC_MAP_BUCKETS;
    return map->__buckets[index];

}

/**
 * Given a bucket of guacd_proc instances, returns the guacd_proc having the
 * guac_client with the given ID, or NULL if no such client is stored.
 *
 * @param bucket
 *     The bucket of guacd_proc instances to search, represented as a
 *     guac_common_list.
 *
 * @param id
 *     The ID of the guac_client whose corresponding guacd_proc instance should
 *     be located within the bucket.
 *
 * @return
 *     The guac_common_list_element containing the guacd_proc instance
 *     corresponding to the guac_client having the given ID, or NULL of no such
 *     element exists.
 */
static guac_common_list_element* __guacd_proc_find(guac_common_list* bucket,
        const char* id) {

    guac_common_list_element* current = bucket->head;

    /* Search for matching element within bucket */
    while (current != NULL) {

        /* Check connection ID */
        guacd_proc* proc = ((guacd_proc_map_entry*) current->data)->proc;
        if (strcmp(proc->client->connection_id, id) == 0)
            break;

        current = current->next;
    }

    return current;

}

guacd_proc_map* guacd_proc_map_alloc() {

    guacd_proc_map* map = guac_mem_alloc(sizeof(guacd_proc_map));
    map->processes = guac_common_list_alloc();
    guac_common_list** current;

    int i;

    /* Init all buckets */
    current = map->__buckets;

    for (i=0; i<GUACD_PROC_MAP_BUCKETS; i++) {
        *current = guac_common_list_alloc();
        current++;
    }

    return map;

}

int guacd_proc_map_add(guacd_proc_map* map, guacd_proc* proc) {

    const char* identifier = proc->client->connection_id;
    guac_common_list* bucket = __guacd_proc_find_bucket(map, identifier);
    guac_common_list_element* found;

    /* Retrieve corresponding element, if any */
    guac_common_list_lock(bucket);
    found = __guacd_proc_find(bucket, identifier);

    /* If no such element, we can add the new client successfully */
    if (found == NULL) {

        guacd_proc_map_entry* entry = guac_mem_alloc(sizeof(guacd_proc_map_entry));

        guac_common_list_lock(map->processes);
        entry->element = guac_common_list_add(map->processes, proc);
        guac_common_list_unlock(map->processes);

        entry->proc = proc;

        guac_common_list_add(bucket, entry);
        guac_common_list_unlock(bucket);

        return 0;
    }

    /* Otherwise, fail - already exists */
    guac_common_list_unlock(bucket);
    return 1;

}

guacd_proc* guacd_proc_map_retrieve(guacd_proc_map* map, const char* id) {

    guacd_proc* proc;

    guac_common_list* bucket = __guacd_proc_find_bucket(map, id);
    guac_common_list_element* found;

    /* Retrieve corresponding element, if any */
    guac_common_list_lock(bucket);
    found = __guacd_proc_find(bucket, id);

    /* If no such element, fail */
    if (found == NULL) {
        guac_common_list_unlock(bucket);
        return NULL;
    }

    proc = ((guacd_proc_map_entry*) found->data)->proc;

    guac_common_list_unlock(bucket);
    return proc;

}

guacd_proc* guacd_proc_map_remove(guacd_proc_map* map, const char* id) {

    guacd_proc* proc;

    guac_common_list* bucket = __guacd_proc_find_bucket(map, id);
    guac_common_list_element* found;

    /* Retrieve corresponding element, if any */
    guac_common_list_lock(bucket);
    found = __guacd_proc_find(bucket, id);

    /* If no such element, fail */
    if (found == NULL) {
        guac_common_list_unlock(bucket);
        return NULL;
    }

    guacd_proc_map_entry* entry = (guacd_proc_map_entry*) found->data;

    /* Find and remove the key from the process list */
    guac_common_list_lock(map->processes);
    guac_common_list_remove(map->processes, entry->element);
    guac_common_list_unlock(map->processes);

    proc = entry->proc;
    guac_common_list_remove(bucket, found);

    free (entry);

    guac_common_list_unlock(bucket);
    return proc;

}

void guacd_proc_map_foreach(guacd_proc_map* map,
        guacd_proc_map_foreach_callback* callback, void* data) {

    guac_common_list* list = map->processes;

    guac_common_list_lock(list);

    /* Invoke the callback for every element in the list */
    guac_common_list_element* element;
    for (element = list->head; element != NULL; element = element->next)
        callback((guacd_proc*) element->data, data);

    guac_common_list_unlock(list);

}

void guacd_proc_map_free(guacd_proc_map* map) {

    /* Free the list of all processes */
    guac_common_list_free(map->processes, NULL);

    /* Free each bucket */
    guac_common_list** buckets = map->__buckets;
    int i;
    for (i = 0; i < GUACD_PROC_MAP_BUCKETS; i++) {
        guac_common_list_free(*(buckets + i), free);
    }

}

