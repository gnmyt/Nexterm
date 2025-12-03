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

package org.apache.guacamole.auth.jdbc.sharing.connectiongroup;

import org.apache.guacamole.auth.jdbc.sharing.user.SharedUserContext;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * A ConnectionGroup implementation which contains all connections accessible
 * via a given SharedUserContext. The identifier of a SharedRootConnectionGroup
 * is statically defined, and all Connections which are intended to be contained
 * within an instance of SharedRootConnectionGroup MUST return that identifier
 * via getParentIdentifier().
 */
public class SharedRootConnectionGroup implements ConnectionGroup {

    /**
     * The identifier of the root connection group. All Connections which are
     * intended to be contained within an instance of SharedRootConnectionGroup
     * MUST return this identifier via getParentIdentifier().
     */
    public static final String IDENTIFIER = "ROOT";

    /**
     * The SharedUserContext through which this connection group is accessible.
     */
    private final SharedUserContext userContext;

    /**
     * Creates a new SharedRootConnectionGroup which contains all connections
     * accessible via the given SharedUserContext. The SharedRootConnectionGroup
     * is backed by the SharedUserContext, and any changes to the connections
     * within the SharedUserContext are immediately reflected in the
     * SharedRootConnectionGroup.
     *
     * @param userContext
     *     The SharedUserContext which should back the new
     *     SharedRootConnectionGroup.
     */
    public SharedRootConnectionGroup(SharedUserContext userContext) {
        this.userContext = userContext;
    }

    @Override
    public String getIdentifier() {
        return IDENTIFIER;
    }

    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("The root group is immutable.");
    }

    @Override
    public String getName() {
        return IDENTIFIER;
    }

    @Override
    public void setName(String name) {
        throw new UnsupportedOperationException("The root group is immutable.");
    }

    @Override
    public String getParentIdentifier() {
        return IDENTIFIER;
    }

    @Override
    public void setParentIdentifier(String parentIdentifier) {
        throw new UnsupportedOperationException("The root group is immutable.");
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public Map<String, String> getAttributes() {
        return Collections.<String, String>emptyMap();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        // Do nothing - no attributes supported
    }

    @Override
    public int getActiveConnections() {
        return 0;
    }

    @Override
    public void setType(Type type) {
        throw new UnsupportedOperationException("The root group is immutable.");
    }

    @Override
    public Type getType() {
        return Type.ORGANIZATIONAL;
    }

    @Override
    public Set<String> getConnectionIdentifiers() throws GuacamoleException {
        Directory<Connection> connectionDirectory = userContext.getConnectionDirectory();
        return connectionDirectory.getIdentifiers();
    }

    @Override
    public Set<String> getConnectionGroupIdentifiers() throws GuacamoleException {
        return Collections.<String>emptySet();
    }

}
