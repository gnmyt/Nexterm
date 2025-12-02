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

package org.apache.guacamole.auth.quickconnect;

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
 * Provides a simple, single-level connection group used for
 * temporarily storing the Connection objects created by users.
 */
public class QuickConnectionGroup extends AbstractConnectionGroup {

    /**
     * A set that will store the Connection identifiers for this group.
     */
    private final Set<String> connectionIdentifiers =
            new HashSet<String>(Collections.<String>emptyList());

    /**
     * Set up a QuickConnectionGroup with the provided name and
     * identifier.
     *
     * @param name
     *     The name of the QuickConnectionGroup.
     *
     * @param identifier
     *     The identifier of the QuickConnectionGroup.
     */
    public QuickConnectionGroup(String name, String identifier) {

        super();
        super.setName(name);
        super.setIdentifier(identifier);
        super.setType(ConnectionGroup.Type.ORGANIZATIONAL);

    }

    /**
     * Add a connection identifier to this connection group, and
     * return the identifier if the add succeeds, otherwise
     * return null.
     *
     * @param identifier
     *     The identifier of the connection to add to the group.
     *
     * @return
     *     The String identifier of the connection if the add
     *     operation was successful; otherwise null.
     */
    public String addConnectionIdentifier(String identifier) {
        if (connectionIdentifiers.add(identifier))
            return identifier;
        return null;
    }

    @Override
    public int getActiveConnections() {
        // This group does not track active connections.
        return 0;
    }

    @Override
    public Set<String> getConnectionIdentifiers() {
        return connectionIdentifiers;
    }

    @Override
    public Set<String> getConnectionGroupIdentifiers() {
        // This group contains only connections, not other groups.
        return Collections.<String>emptySet();
    }

    @Override
    public Map<String, String> getAttributes() {
        // There are no attributes associated with this group.
        return Collections.<String, String>emptyMap();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        // Do nothing - there are no attributes
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        // This group does not support connections
        throw new GuacamoleSecurityException("Permission denied.");
    }

}
