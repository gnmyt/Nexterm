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

import com.google.inject.Inject;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.quickconnect.utility.QCParser;
import org.apache.guacamole.auth.quickconnect.conf.ConfigurationService;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.simple.SimpleConnection;
import org.apache.guacamole.net.auth.simple.SimpleDirectory;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * Implementation of a directory to store Connection objects
 * completely in memory.
 */
public class QuickConnectDirectory extends SimpleDirectory<Connection> {
    
    /**
     * The configuration service for the QuickConnect module.
     */
    @Inject
    private ConfigurationService confService;
    
    /**
     * The connections to store.
     */
    private final Map<String, Connection> connections =
            new ConcurrentHashMap<>();

    /**
     * The root connection group for this directory.
     */
    private QuickConnectionGroup rootGroup;

    /**
     * The internal counter for connection IDs.
     */
    private AtomicInteger connectionId;

    /**
     * Initialize the QuickConnectDirectory with the default empty Map for
     * Connection objects, and the specified ConnectionGroup at the root of
     * the directory.
     *
     * @param rootGroup
     *     A group that should be at the root of this directory.
     */
    public void init(ConnectionGroup rootGroup) {
        this.rootGroup = (QuickConnectionGroup)rootGroup;
        this.connectionId = new AtomicInteger();
        super.setObjects(this.connections);
        
    }

    /**
     * Returns the current connection identifier counter and then increments it.
     *
     * @return
     *     An int representing the next available connection
     *     identifier to be used when adding connections.
     */
    private int getNextConnectionID() {
        return connectionId.getAndIncrement();
    }

    @Override
    public void add(Connection connection) throws GuacamoleException {
        connections.put(connection.getIdentifier(), connection);
    }

    /**
     * Taking a URI, parse the URI into a GuacamoleConfiguration object and
     * then use the configuration to create a SimpleConnection object, obtain
     * an identifier, and place it on the tree, returning the identifier value
     * of the new connection.
     *
     * @param uri
     *     The URI to parse into a GuacamoleConfiguration, which will then be
     *     used to generate the SimpleConnection.
     *
     * @return
     *     The identifier of the connection created in the directory.
     *
     * @throws GuacamoleException
     *     If an error occurs adding the object to the tree.
     */
    public String create(String uri) throws GuacamoleException {

        // Get the next available connection identifier.
        String newConnectionId = Integer.toString(getNextConnectionID());

        // Get a new QCParser
        QCParser parser = new QCParser(confService.getAllowedParameters(),
                                        confService.getDeniedParameters());
        
        // Parse the URI into a configuration
        GuacamoleConfiguration config = parser.getConfiguration(uri);

        // Generate a name for the configuration.
        String name = parser.getName(config);

        // Create a new connection and set the parent identifier.
        Connection connection = new SimpleConnection(name, newConnectionId, config, true);
        connection.setParentIdentifier(QuickConnectUserContext.ROOT_IDENTIFIER);

        // Place the object in this directory.
        add(connection);

        // Add connection to the tree.
        rootGroup.addConnectionIdentifier(newConnectionId);

        return newConnectionId;
    }

}
