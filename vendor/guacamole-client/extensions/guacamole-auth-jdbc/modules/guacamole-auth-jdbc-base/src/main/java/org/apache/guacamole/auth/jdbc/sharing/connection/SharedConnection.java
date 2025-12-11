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

package org.apache.guacamole.auth.jdbc.sharing.connection;

import com.google.inject.Inject;
import java.util.Collections;
import java.util.Date;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.sharing.connectiongroup.SharedRootConnectionGroup;
import org.apache.guacamole.auth.jdbc.tunnel.GuacamoleTunnelService;
import org.apache.guacamole.auth.jdbc.user.RemoteAuthenticatedUser;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * A Connection which joins an active connection, limited by restrictions
 * defined by a sharing profile.
 */
public class SharedConnection implements Connection {

    /**
     * The name of the attribute which contains the username of the user that
     * shared this connection.
     */
    public static final String CONNECTION_OWNER = "jdbc-shared-by";

    /**
     * Service for establishing tunnels to Guacamole connections.
     */
    @Inject
    private GuacamoleTunnelService tunnelService;

    /**
     * The user that successfully authenticated to obtain access to this
     * SharedConnection.
     */
    private RemoteAuthenticatedUser user;

    /**
     * The SharedConnectionDefinition dictating the connection being shared and
     * any associated restrictions.
     */
    private SharedConnectionDefinition definition;

    /**
     * Creates a new SharedConnection which can be used to join the connection
     * described by the given SharedConnectionDefinition.
     *
     * @param user
     *     The user that successfully authenticated to obtain access to this
     *     SharedConnection.
     *
     * @param definition
     *     The SharedConnectionDefinition dictating the connection being shared
     *     and any associated restrictions.
     */
    public void init(RemoteAuthenticatedUser user, SharedConnectionDefinition definition) {
        this.user = user;
        this.definition = definition;
    }

    @Override
    public String getIdentifier() {
        return definition.getShareKey();
    }

    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("Shared connections are immutable.");
    }

    @Override
    public String getName() {
        return definition.getActiveConnection().getConnection().getName();
    }

    @Override
    public void setName(String name) {
        throw new UnsupportedOperationException("Shared connections are immutable.");
    }

    @Override
    public String getParentIdentifier() {
        return SharedRootConnectionGroup.IDENTIFIER;
    }

    @Override
    public void setParentIdentifier(String parentIdentifier) {
        throw new UnsupportedOperationException("Shared connections are immutable.");
    }

    @Override
    public GuacamoleConfiguration getConfiguration() {

        // Pull the connection being shared
        Connection primaryConnection = definition.getActiveConnection().getConnection();

        // Construct a skeletal configuration that exposes only the protocol in use
        GuacamoleConfiguration config = new GuacamoleConfiguration();
        config.setProtocol(primaryConnection.getConfiguration().getProtocol());
        return config;

    }

    @Override
    public void setConfiguration(GuacamoleConfiguration config) {
        throw new UnsupportedOperationException("Shared connections are immutable.");
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        return tunnelService.getGuacamoleTunnel(user, definition, info, tokens);
    }

    @Override
    public Map<String, String> getAttributes() {
        String sharedBy = definition.getActiveConnection().getUser().getIdentifier();
        return Collections.<String, String>singletonMap(CONNECTION_OWNER, sharedBy);
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        // Do nothing - changing attributes not supported
    }

    @Override
    public Date getLastActive() {
        return null;
    }

    @Override
    public Set<String> getSharingProfileIdentifiers()
            throws GuacamoleException {
        return Collections.<String>emptySet();
    }

    @Override
    public int getActiveConnections() {
        return 0;
    }

}
