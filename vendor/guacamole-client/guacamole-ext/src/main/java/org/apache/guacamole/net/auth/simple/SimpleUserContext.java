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

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AbstractUserContext;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * An extremely simple UserContext implementation which provides access to
 * a defined and restricted set of GuacamoleConfigurations. Access to
 * querying or modifying either users or permissions is denied.
 */
public class SimpleUserContext extends AbstractUserContext {

    /**
     * The AuthenticationProvider that created this UserContext.
     */
    private final AuthenticationProvider authProvider;

    /**
     * The unique identifier (username) of the user whose permissions dictate
     * the configurations accessible within this UserContext.
     */
    private final String username;

    /**
     * The Directory with access to all connections within the root group
     * associated with this UserContext.
     */
    private final Directory<Connection> connectionDirectory;

    /**
     * Creates a new SimpleUserContext which provides access to only those
     * configurations within the given Map. The username is set to the
     * ANONYMOUS_IDENTIFIER defined by AuthenticatedUser, effectively declaring
     * the current user as anonymous. Parameter tokens within the given
     * GuacamoleConfigurations will not be interpreted.
     *
     * @param authProvider
     *     The AuthenticationProvider creating this UserContext.
     *
     * @param configs
     *     A Map of all configurations for which the user associated with this
     *     UserContext has read access.
     */
    public SimpleUserContext(AuthenticationProvider authProvider,
            Map<String, GuacamoleConfiguration> configs) {
        this(authProvider, AuthenticatedUser.ANONYMOUS_IDENTIFIER, configs);
    }

    /**
     * Creates a new SimpleUserContext for the user with the given username
     * which provides access to only those configurations within the given Map.
     * Parameter tokens within the given GuacamoleConfigurations will not be
     * interpreted.
     *
     * @param authProvider
     *     The AuthenticationProvider creating this UserContext.
     *
     * @param username
     *     The username of the user associated with this UserContext.
     *
     * @param configs
     *     A Map of all configurations for which the user associated with
     *     this UserContext has read access.
     */
    public SimpleUserContext(AuthenticationProvider authProvider,
            String username, Map<String, GuacamoleConfiguration> configs) {
        this(authProvider, username, configs, false);
    }

    /**
     * Creates a new SimpleUserContext for the user with the given username
     * which provides access to only those configurations within the given Map.
     * Parameter tokens within the given GuacamoleConfigurations will be
     * interpreted if explicitly requested.
     *
     * @param authProvider
     *     The AuthenticationProvider creating this UserContext.
     *
     * @param username
     *     The username of the user associated with this UserContext.
     *
     * @param configs
     *     A Map of all configurations for which the user associated with
     *     this UserContext has read access.
     *
     * @param interpretTokens
     *     Whether parameter tokens in the underlying GuacamoleConfigurations
     *     should be automatically applied upon connecting. If false, parameter
     *     tokens will not be interpreted at all.
     */
    public SimpleUserContext(AuthenticationProvider authProvider,
            String username, Map<String, GuacamoleConfiguration> configs,
            boolean interpretTokens) {

        // Produce map of connections from given configs
        Map<String, Connection> connections = new ConcurrentHashMap<String, Connection>(configs.size());
        for (Map.Entry<String, GuacamoleConfiguration> configEntry : configs.entrySet()) {

            // Get connection identifier and configuration
            String identifier = configEntry.getKey();
            GuacamoleConfiguration config = configEntry.getValue();

            // Add as simple connection
            Connection connection = new SimpleConnection(identifier, identifier, config, interpretTokens);
            connection.setParentIdentifier(DEFAULT_ROOT_CONNECTION_GROUP);
            connections.put(identifier, connection);

        }

        this.username = username;
        this.authProvider = authProvider;
        this.connectionDirectory = new SimpleDirectory<Connection>(connections);

    }

    @Override
    public User self() {
        return new SimpleUser(username) {

            @Override
            public ObjectPermissionSet getConnectionGroupPermissions() throws GuacamoleException {
                return new SimpleObjectPermissionSet(getConnectionDirectory().getIdentifiers());
            }

            @Override
            public ObjectPermissionSet getConnectionPermissions() throws GuacamoleException {
                return new SimpleObjectPermissionSet(getConnectionGroupDirectory().getIdentifiers());
            }

        };
    }

    @Override
    public Object getResource() throws GuacamoleException {
        return null;
    }

    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return authProvider;
    }

    @Override
    public Directory<Connection> getConnectionDirectory()
            throws GuacamoleException {
        return connectionDirectory;
    }

}
