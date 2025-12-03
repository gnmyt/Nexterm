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

package org.apache.guacamole.auth.jdbc.sharing;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import org.apache.guacamole.auth.jdbc.sharing.connection.SharedConnectionDefinition;

/**
 * A HashMap-based implementation of the SharedConnectionMap.
 */
public class HashSharedConnectionMap implements SharedConnectionMap {

    /**
     * Keeps track of the share key to SharedConnectionDefinition mapping.
     */
    private final ConcurrentMap<String, SharedConnectionDefinition> connectionMap =
            new ConcurrentHashMap<String, SharedConnectionDefinition>();

    @Override
    public SharedConnectionDefinition get(String key) {
        
        // There are no null share keys
        if (key == null)
            return null;

        // Update the last access time and return the SharedConnectionDefinition
        return connectionMap.get(key);

    }

    @Override
    public void add(SharedConnectionDefinition definition) {

        // Store definition by share key
        String shareKey = definition.getShareKey();
        connectionMap.put(shareKey, definition);

    }

    @Override
    public SharedConnectionDefinition remove(String key) {

        // There are no null share keys
        if (key == null)
            return null;

        // Attempt to retrieve only if non-null
        SharedConnectionDefinition definition = connectionMap.remove(key);
        if (definition == null)
            return null;

        // Close all associated tunnels and disallow further sharing
        definition.invalidate();
        return definition;

    }

}
