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

package org.apache.guacamole.auth.jdbc.connectiongroup;

import com.google.inject.Inject;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.auth.jdbc.connection.ConnectionService;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.base.RestrictedObject;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * The root connection group, here represented as its own dedicated object as
 * the database does not contain an actual root group.
 */
public class RootConnectionGroup extends RestrictedObject
    implements ConnectionGroup {

    /**
     * The identifier used to represent the root connection group. There is no
     * corresponding entry in the database, thus a reserved identifier that
     * cannot collide with database-generated identifiers is needed.
     */
    public static final String IDENTIFIER = "ROOT";

    /**
     * The human-readable name of this connection group. The name of the root
     * group is not normally visible, and may even be replaced by the web
     * interface for the sake of translation.
     */
    public static final String NAME = "ROOT";

    /**
     * Service for managing connection objects.
     */
    @Inject
    private ConnectionService connectionService;

    /**
     * Service for managing connection group objects.
     */
    @Inject
    private ConnectionGroupService connectionGroupService;
    
    /**
     * Creates a new, empty RootConnectionGroup.
     */
    public RootConnectionGroup() {
    }

    @Override
    public String getName() {
        return NAME;
    }

    @Override
    public void setName(String name) {
        throw new UnsupportedOperationException("The root connection group cannot be modified.");
    }

    @Override
    public String getParentIdentifier() {
        return null;
    }

    @Override
    public void setParentIdentifier(String parentIdentifier) {
        throw new UnsupportedOperationException("The root connection group cannot be modified.");
    }

    @Override
    public Type getType() {
        return ConnectionGroup.Type.ORGANIZATIONAL;
    }

    @Override
    public void setType(Type type) {
        throw new UnsupportedOperationException("The root connection group cannot be modified.");
    }

    @Override
    public Set<String> getConnectionIdentifiers() throws GuacamoleException {
        return connectionService.getIdentifiersWithin(getCurrentUser(), null);
    }

    @Override
    public Set<String> getConnectionGroupIdentifiers()
            throws GuacamoleException {
        return connectionGroupService.getIdentifiersWithin(getCurrentUser(), null);
    }

    @Override
    public String getIdentifier() {
        return IDENTIFIER;
    }

    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("The root connection group cannot be modified.");
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public int getActiveConnections() {
        return 0;
    }

    @Override
    public Map<String, String> getAttributes() {
        return Collections.<String, String>emptyMap();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        throw new UnsupportedOperationException("The root connection group cannot be modified.");
    }

}
