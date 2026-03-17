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

package org.apache.guacamole.auth.jdbc.tunnel;

import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Mapping of object identifiers to lists of connection records. Records are
 * added or removed individually, and the overall list of current records
 * associated with a given object can be retrieved at any time. The public
 * methods of this class are all threadsafe.
 */
public class ActiveConnectionMultimap {

    /**
     * All active connections to a connection having a given identifier.
     */
    private final Map<String, Set<ActiveConnectionRecord>> records =
            new HashMap<String, Set<ActiveConnectionRecord>>();

    /**
     * Stores the given connection record in the list of active connections
     * associated with the object having the given identifier.
     *
     * @param identifier
     *     The identifier of the object being connected to.
     *
     * @param record
     *     The record associated with the active connection.
     */
    public void put(String identifier, ActiveConnectionRecord record) {
        synchronized (records) {

            // Get set of active connection records, creating if necessary
            Set<ActiveConnectionRecord> connections = records.get(identifier);
            if (connections == null) {
                connections = Collections.synchronizedSet(Collections.newSetFromMap(new LinkedHashMap<ActiveConnectionRecord, Boolean>()));
                records.put(identifier, connections);
            }

            // Add active connection
            connections.add(record);

        }
    }

    /**
     * Removes the given connection record from the list of active connections
     * associated with the object having the given identifier.
     *
     * @param identifier
     *     The identifier of the object being disconnected from.
     *
     * @param record
     *     The record associated with the active connection.
     */
    public void remove(String identifier, ActiveConnectionRecord record) {
        synchronized (records) {

            // Get set of active connection records
            Set<ActiveConnectionRecord> connections = records.get(identifier);
            assert(connections != null);

            // Remove old record
            connections.remove(record);

            // If now empty, clean the tracking entry
            if (connections.isEmpty())
                records.remove(identifier);

        }
    }

    /**
     * Returns a collection of active connection records associated with the
     * object having the given identifier. The collection will be sorted in
     * insertion order. If there are no such connections, an empty collection is
     * returned.
     *
     * @param identifier
     *     The identifier of the object to check.
     *
     * @return
     *     An immutable collection of records associated with the object having
     *     the given identifier, or an empty collection if there are no such
     *     records.
     */
    public Collection<ActiveConnectionRecord> get(String identifier) {
        synchronized (records) {

            // Get set of active connection records
            Collection<ActiveConnectionRecord> connections = records.get(identifier);
            if (connections != null)
                return Collections.unmodifiableCollection(connections);

            return Collections.<ActiveConnectionRecord>emptyList();

        }
    }

}
