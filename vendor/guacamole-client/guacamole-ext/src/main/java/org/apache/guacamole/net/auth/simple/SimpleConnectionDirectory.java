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
import org.apache.guacamole.net.auth.Connection;

/**
 * An extremely simple read-only implementation of a Directory of
 * GuacamoleConfigurations which provides access to a pre-defined Map of
 * GuacamoleConfigurations.
 *
 * @deprecated Use {@link SimpleDirectory} instead.
 */
@Deprecated
public class SimpleConnectionDirectory extends SimpleDirectory<Connection> {

    /**
     * The Map of Connections to provide access to.
     */
    private final Map<String, Connection> connections =
            new HashMap<String, Connection>();

    /**
     * Creates a new SimpleConnectionDirectory which provides access to the
     * connections contained within the given Map.
     *
     * @param connections
     *     A Collection of all connections that should be present in this
     *     connection directory.
     */
    public SimpleConnectionDirectory(Collection<Connection> connections) {

        // Add all given connections
        for (Connection connection : connections)
            this.connections.put(connection.getIdentifier(), connection);

        // Use the connection map to back the underlying directory 
        super.setObjects(this.connections);

    }

    /**
     * An internal method for modifying the Connections in this Directory.
     * Returns the previous connection for the given identifier, if found.
     *
     * @param connection The connection to add or update the Directory with.
     * @return The previous connection for the connection identifier, if found.
     */
    public Connection putConnection(Connection connection) {
        return connections.put(connection.getIdentifier(), connection);
    }

    /**
     * An internal method for removing a Connection from this Directory.
     * @param identifier The identifier of the Connection to remove.
     * @return The previous connection for the given identifier, if found.
     */
    public Connection removeConnection(String identifier) {
        return connections.remove(identifier);
    }

}
