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

package org.apache.guacamole.auth.json.user;

import com.google.inject.Inject;
import java.util.Collections;
import java.util.Date;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.json.connection.ConnectionService;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * Connection implementation which automatically manages related UserData if
 * the connection is used. Connections which are marked as single-use will
 * be removed from the given UserData such that only the first connection
 * attempt can succeed.
 */
public class UserDataConnection implements Connection {

    /**
     * Service for establishing and managing connections.
     */
    @Inject
    private ConnectionService connectionService;

    /**
     * A human-readable value which both uniquely identifies this connection
     * and serves as the connection display name.
     */
    private String identifier;

    /**
     * The UserData associated with this connection. This UserData will be
     * automatically updated as this connection is used.
     */
    private UserData data;

    /**
     * The connection entry for this connection within the associated UserData.
     */
    private UserData.Connection connection;

    /**
     * Initializes this UserDataConnection with the given data, unique
     * identifier, and connection information. This function MUST be invoked
     * before any particular UserDataConnection is actually used.
     *
     * @param data
     *     The UserData that this connection should manage.
     *
     * @param identifier
     *     The identifier associated with this connection within the given
     *     UserData.
     *
     * @param connection
     *     The connection data associated with this connection within the given
     *     UserData.
     *
     * @return
     *     A reference to this UserDataConnection.
     */
    public UserDataConnection init(UserData data, String identifier,
            UserData.Connection connection) {

        this.identifier = identifier;
        this.data = data;
        this.connection = connection;

        return this;

    }

    @Override
    public String getIdentifier() {
        return identifier;
    }

    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("UserDataConnection is immutable.");
    }

    @Override
    public String getName() {
        return identifier;
    }

    @Override
    public void setName(String name) {
        throw new UnsupportedOperationException("UserDataConnection is immutable.");
    }

    @Override
    public String getParentIdentifier() {
        return UserContext.ROOT_CONNECTION_GROUP;
    }

    @Override
    public void setParentIdentifier(String parentIdentifier) {
        throw new UnsupportedOperationException("UserDataConnection is immutable.");
    }

    @Override
    public GuacamoleConfiguration getConfiguration() {

        // Generate configuration, using a skeleton configuration if generation
        // fails
        GuacamoleConfiguration config = connectionService.getConfiguration(connection);
        if (config == null)
            config = new GuacamoleConfiguration();

        return config;

    }

    @Override
    public void setConfiguration(GuacamoleConfiguration config) {
        throw new UnsupportedOperationException("UserDataConnection is immutable.");
    }

    @Override
    public Map<String, String> getAttributes() {
        return Collections.<String, String>emptyMap();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        throw new UnsupportedOperationException("UserDataConnection is immutable.");
    }

    @Override
    public Date getLastActive() {
        return null;
    }

    @Override
    public Set<String> getSharingProfileIdentifiers() throws GuacamoleException {
        return Collections.<String>emptySet();
    }

    @Override
    public int getActiveConnections() {
        return 0;
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {

        // Prevent future use immediately upon connect
        if (connection.isSingleUse()) {

            // Deny access if another user already used the connection
            if (data.removeConnection(getIdentifier()) == null)
                throw new GuacamoleSecurityException("Permission denied");

        }

        // Perform connection operation
        return connectionService.connect(connection, info, tokens);

    }

}
