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

package org.apache.guacamole.rest.connection;

import java.util.Date;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * A wrapper to make an APIConnection look like a Connection. Useful where a
 * org.apache.guacamole.net.auth.Connection is required.
 */
public class APIConnectionWrapper implements Connection {

    /**
     * The wrapped APIConnection.
     */
    private final APIConnection apiConnection;

    /**
     * Creates a new APIConnectionWrapper which wraps the given APIConnection
     * as a Connection.
     *
     * @param apiConnection
     *     The APIConnection to wrap.
     */
    public APIConnectionWrapper(APIConnection apiConnection) {
        this.apiConnection = apiConnection;
    }

    @Override
    public String getName() {
        return apiConnection.getName();
    }

    @Override
    public void setName(String name) {
        apiConnection.setName(name);
    }

    @Override
    public String getIdentifier() {
        return apiConnection.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        apiConnection.setIdentifier(identifier);
    }

    @Override
    public String getParentIdentifier() {
        return apiConnection.getParentIdentifier();
    }

    @Override
    public void setParentIdentifier(String parentIdentifier) {
        apiConnection.setParentIdentifier(parentIdentifier);
    }

    @Override
    public int getActiveConnections() {
        return apiConnection.getActiveConnections();
    }

    @Override
    public GuacamoleConfiguration getConfiguration() {
        
        // Create the GuacamoleConfiguration with current protocol
        GuacamoleConfiguration configuration = new GuacamoleConfiguration();
        configuration.setProtocol(apiConnection.getProtocol());

        // Add parameters, if available
        Map<String, String> parameters = apiConnection.getParameters();
        if (parameters != null)
            configuration.setParameters(parameters);
        
        return configuration;
    }

    @Override
    public void setConfiguration(GuacamoleConfiguration config) {
        
        // Set protocol and parameters
        apiConnection.setProtocol(config.getProtocol());
        apiConnection.setParameters(config.getParameters());

    }

    @Override
    public Map<String, String> getAttributes() {
        return apiConnection.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        apiConnection.setAttributes(attributes);
    }

    @Override
    public Set<String> getSharingProfileIdentifiers() throws GuacamoleException {
        throw new GuacamoleUnsupportedException("Operation not supported.");
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        throw new GuacamoleUnsupportedException("Operation not supported.");
    }

    @Override
    public Date getLastActive() {
        return null;
    }
    
}
