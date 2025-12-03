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
import com.google.inject.Provider;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.sharing.SharedConnectionMap;
import org.apache.guacamole.auth.jdbc.user.RemoteAuthenticatedUser;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.Directory;

/**
 * A Directory implementation which exposes an explicitly-registered set of
 * share keys as connections. Only explicitly-registered share keys are
 * accessible a SharedConnectionDirectory.
 */
public class SharedConnectionDirectory implements Directory<Connection> {

    /**
     * Map of all currently-shared connections.
     */
    @Inject
    private SharedConnectionMap connectionMap;

    /**
     * Provider for retrieving SharedConnection instances.
     */
    @Inject
    private Provider<SharedConnection> connectionProvider;

    /**
     * The user associated with the UserContext that contains this directory.
     */
    private RemoteAuthenticatedUser currentUser;

    /**
     * The set of share keys that have been explicitly registered. In general,
     * only valid share keys will be present here, but invalid keys are only
     * removed after an attempt to retrieve those keys has been made.
     */
    private final Set<String> shareKeys =
            Collections.newSetFromMap(new ConcurrentHashMap<String, Boolean>());

    /**
     * Creates a new SharedConnectionDirectory which exposes share keys as
     * connections. Only explicitly-registered and valid share keys will be
     * accessible.
     *
     * @param currentUser
     *     The user associated with the UserContext that will contain this
     *     directory.
     */
    public void init(RemoteAuthenticatedUser currentUser) {
        this.currentUser = currentUser;
    }

    /**
     * Registers a new share key such that the connection associated with that
     * share key is accessible through this directory. The share key will be
     * automatically de-registered when it is no longer valid.
     *
     * @param shareKey
     *     The share key to register.
     */
    public void registerShareKey(String shareKey) {
        shareKeys.add(shareKey);
    }

    @Override
    public Connection get(String identifier) throws GuacamoleException {

        // Allow access only to registered share keys
        if (!shareKeys.contains(identifier))
            return null;

        // Retrieve the connection definition associated with that share key,
        // cleaning up the internally-stored share key if it's no longer valid
        SharedConnectionDefinition connectionDefinition = connectionMap.get(identifier);
        if (connectionDefinition == null) {
            shareKeys.remove(identifier);
            return null;
        }

        // Return a Connection which wraps that connection definition
        SharedConnection connection = connectionProvider.get();
        connection.init(currentUser, connectionDefinition);
        return connection;

    }

    @Override
    public Collection<Connection> getAll(Collection<String> identifiers)
            throws GuacamoleException {

        // Create collection with enough backing space to contain one
        // connection per identifier given
        Collection<Connection> matchingConnections =
                new ArrayList<Connection>(identifiers.size());

        // Add all connnections which exist according to get()
        for (String identifier : identifiers) {
            Connection connection = get(identifier);
            if (connection != null)
                matchingConnections.add(connection);
        }

        return Collections.unmodifiableCollection(matchingConnections);

    }

    @Override
    public Set<String> getIdentifiers() throws GuacamoleException {
        return Collections.unmodifiableSet(shareKeys);
    }

    @Override
    public void add(Connection object) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public void update(Connection object) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public void remove(String identifier) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

}
