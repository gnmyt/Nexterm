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

package org.apache.guacamole.net.auth.simple;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.apache.guacamole.net.auth.ConnectionGroup;

/**
 * An extremely simple read-only implementation of a Directory of
 * ConnectionGroup which provides which provides access to a pre-defined
 * Collection of ConnectionGroups.
 *
 * @deprecated Use {@link SimpleDirectory} instead.
 */
@Deprecated
public class SimpleConnectionGroupDirectory
    extends SimpleDirectory<ConnectionGroup> {

    /**
     * The Map of ConnectionGroups to provide access to.
     */
    private final Map<String, ConnectionGroup> connectionGroups =
            new HashMap<String, ConnectionGroup>();

    /**
     * Creates a new SimpleConnectionGroupDirectory which contains the given
     * groups.
     *
     * @param groups A Collection of all groups that should be present in this
     *               connection group directory.
     */
    public SimpleConnectionGroupDirectory(Collection<ConnectionGroup> groups) {

        // Add all given groups
        for (ConnectionGroup group : groups)
            connectionGroups.put(group.getIdentifier(), group);

        // Use the connection group map to back the underlying AbstractDirectory
        super.setObjects(connectionGroups);

    }

    /**
     * An internal method for modifying the ConnectionGroups in this Directory.
     * Returns the previous connection group for the given identifier, if found.
     *
     * @param connectionGroup The connection group to add or update the
     *                        Directory with.
     * @return The previous connection group for the connection group
     *         identifier, if found.
     */
    public ConnectionGroup putConnectionGroup(ConnectionGroup connectionGroup) {
        return connectionGroups.put(connectionGroup.getIdentifier(), connectionGroup);
    }

    /**
     * An internal method for removing a ConnectionGroup from this Directory.
     *
     * @param identifier The identifier of the ConnectionGroup to remove.
     * @return The previous connection group for the given identifier, if found.
     */
    public ConnectionGroup removeConnectionGroup(String identifier) {
        return connectionGroups.remove(identifier);
    }

}
