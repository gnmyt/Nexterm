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

#ifndef _GUACD_PROC_MAP_H
#define _GUACD_PROC_MAP_H

#include "config.h"
#include "common/list.h"
#include "proc.h"

#include <guacamole/client.h>

/**
 * The maximum number of concurrent connections to a single instance
 * of guacd.
 */
#define GUACD_CLIENT_MAX_CONNECTIONS 65536

/**
 * The number of hash buckets in each process map.
 */
#define GUACD_PROC_MAP_BUCKETS GUACD_CLIENT_MAX_CONNECTIONS*2

/**
 * Set of all active connections to guacd, indexed by connection ID.
 */
typedef struct guacd_proc_map {

    /**
     * Internal hash buckets. Each bucket is a linked list containing all
     * guac_client instances which hash to this bucket location.
     */
    guac_common_list* __buckets[GUACD_PROC_MAP_BUCKETS];

    /**
     * All processes present in the map. For internal use only. To operate on these
     * keys, use guacd_proc_map_foreach().
     */
    guac_common_list* processes;

} guacd_proc_map;

/**
 * Allocates a new client process map. There is intended to be exactly one
 * process map instance, which persists for the life of guacd.
 *
 * @return
 *     A newly-allocated client process map.
 */
guacd_proc_map* guacd_proc_map_alloc();

/**
 * Free all resources allocated for the provided map. Note that this function
 * will _not_ clean up the processes contained within the map, only the map
 * itself.
 *
 * @param map
 *    The guacd proc map to free.
 */
void guacd_proc_map_free(guacd_proc_map* map);

/**
 * Adds the given process to the client process map. On success, zero is
 * returned. If adding the client fails (due to lack of space, or duplicate
 * ID), a non-zero value is returned instead. The client process is stored by
 * the connection ID of the underlying guac_client.
 *
 * @param map
 *     The map in which the given client process should be stored.
 *
 * @param proc
 *     The client process to store in the given map.
 *
 * @return
 *     Zero if the process was successfully stored in the map, or non-zero if
 *     storing the process fails for any reason.
 */
int guacd_proc_map_add(guacd_proc_map* map, guacd_proc* proc);

/**
 * Retrieves the client process having the client with the given ID, or NULL if
 * no such process is stored.
 *
 * @param map
 *     The map from which to retrieve the process associated with the client
 *     having the given ID.
 *
 * @param id
 *     The ID of the client whose process should be retrieved.
 *
 * @return
 *     The process associated with the client having the given ID, or NULL if
 *     no such process exists.
 */
guacd_proc* guacd_proc_map_retrieve(guacd_proc_map* map, const char* id);

/**
 * Removes the client process having the client with the given ID, returning
 * the corresponding process. If no such process exists, NULL is returned.
 *
 * @param map
 *     The map from which to remove the process associated with the client
 *     having the given ID.
 *
 * @param id
 *     The ID of the client whose process should be removed.
 *
 * @return
 *     The process associated with the client having the given ID which has now
 *     been removed from the given map, or NULL if no such process exists.
 */
guacd_proc* guacd_proc_map_remove(guacd_proc_map* map, const char* id);

/**
 * A callback function that will be invoked with every guacd_proc stored
 * in the provided map, when provided to guacd_proc_map_foreach(), along with
 * any provided arbitrary data.
 *
 * @param proc
 *     The current guacd process.
 *
 * @param data
 *     The arbitrary data provided to guacd_proc_map_foreach().
 */
typedef void guacd_proc_map_foreach_callback(guacd_proc* proc, void* data);

/**
 * Invoke the provided callback with any provided arbitrary data and each guacd
 * proc contained in the provided map, once each and in no particular order.
 *
 * @param map
 *     The map from which all guacd processes should be extracted and provided
 *     to the callback.
 *
 * @param callback
 *     The callback function to be invoked once with each guacd process
 *     contained in the provided map.
 *
 * @param data
 *     Arbitrary data to be provided to the callback function.
 */
void guacd_proc_map_foreach(guacd_proc_map* map,
        guacd_proc_map_foreach_callback* callback, void* data);

#endif

