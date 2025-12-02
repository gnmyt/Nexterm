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
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.AbstractConnectionGroup;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * An extremely simple read-only implementation of a ConnectionGroup which
 * returns the connection and connection group identifiers it was constructed
 * with. Load balancing across this connection group is not allowed.
 */
public class SimpleConnectionGroup extends AbstractConnectionGroup {

    /**
     * The identifiers of all connections in this group.
     */
    private final Set<String> connectionIdentifiers;

    /**
     * The identifiers of all connection groups in this group.
     */
    private final Set<String> connectionGroupIdentifiers;

    /**
     * Creates a new SimpleConnectionGroup having the given name and identifier
     * which will expose the given contents.
     * 
     * @param name
     *     The name to associate with this connection group.
     *
     * @param identifier
     *     The identifier to associate with this connection group.
     *
     * @param connectionIdentifiers
     *     The connection identifiers to expose when requested.
     *
     * @param connectionGroupIdentifiers
     *     The connection group identifiers to expose when requested.
     */
    public SimpleConnectionGroup(String name, String identifier,
            Collection<String> connectionIdentifiers, 
            Collection<String> connectionGroupIdentifiers) {

        // Set name
        setName(name);

        // Set identifier
        setIdentifier(identifier);
        
        // Set group type
        setType(ConnectionGroup.Type.ORGANIZATIONAL);

        // Populate contents
        this.connectionIdentifiers = new HashSet<String>(connectionIdentifiers);
        this.connectionGroupIdentifiers = new HashSet<String>(connectionGroupIdentifiers);

    }

    @Override
    public int getActiveConnections() {
        return 0;
    }

    @Override
    public Set<String> getConnectionIdentifiers() {
        return connectionIdentifiers;
    }

    @Override
    public Set<String> getConnectionGroupIdentifiers() {
        return connectionGroupIdentifiers;
    }

    @Override
    public Map<String, String> getAttributes() {
        return Collections.<String, String>emptyMap();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        // Do nothing - there are no attributes
    }

    @Override
    @Deprecated
    public GuacamoleTunnel connect(GuacamoleClientInformation info)
            throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        return connect(info);
    }

}
