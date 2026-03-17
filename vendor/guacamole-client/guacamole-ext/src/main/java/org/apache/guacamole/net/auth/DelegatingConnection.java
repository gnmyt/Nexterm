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

package org.apache.guacamole.net.auth;

import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.protocol.GuacamoleClientInformation;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * Connection implementation which simply delegates all function calls to an
 * underlying Connection.
 */
public class DelegatingConnection implements Connection {

    /**
     * The wrapped Connection.
     */
    private final Connection connection;

    /**
     * The tokens which should apply strictly to the next call to
     * {@link #connect(org.apache.guacamole.protocol.GuacamoleClientInformation)}.
     * This storage is intended as a temporary bridge allowing the old version
     * of connect() to be overridden while still resulting in the same behavior
     * as older versions of DelegatingConnection. <strong>This storage should be
     * removed once support for the old, deprecated connect() is removed.</strong>
     */
    private final ThreadLocal<Map<String, String>> currentTokens =
            new ThreadLocal<Map<String, String>>() {

        @Override
        protected Map<String, String> initialValue() {
            return Collections.emptyMap();
        }

    };

    /**
     * Wraps the given Connection such that all function calls against this
     * DelegatingConnection will be delegated to it.
     *
     * @param connection
     *     The Connection to wrap.
     */
    public DelegatingConnection(Connection connection) {
        this.connection = connection;
    }

    /**
     * Returns the underlying Connection wrapped by this DelegatingConnection.
     *
     * @return
     *     The Connection wrapped by this DelegatingConnection.
     */
    protected Connection getDelegateConnection() {
        return connection;
    }

    @Override
    public String getIdentifier() {
        return connection.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        connection.setIdentifier(identifier);
    }

    @Override
    public String getName() {
        return connection.getName();
    }

    @Override
    public void setName(String name) {
        connection.setName(name);
    }

    @Override
    public String getParentIdentifier() {
        return connection.getParentIdentifier();
    }

    @Override
    public void setParentIdentifier(String parentIdentifier) {
        connection.setParentIdentifier(parentIdentifier);
    }

    @Override
    public GuacamoleConfiguration getConfiguration() {
        return connection.getConfiguration();
    }

    @Override
    public void setConfiguration(GuacamoleConfiguration config) {
        connection.setConfiguration(config);
    }

    @Override
    public Map<String, String> getAttributes() {
        return connection.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        connection.setAttributes(attributes);
    }

    @Override
    public Date getLastActive() {
        return connection.getLastActive();
    }

    @Deprecated
    @Override
    public List<? extends ConnectionRecord> getHistory()
            throws GuacamoleException {
        return connection.getHistory();
    }
    
    @Override
    public ActivityRecordSet<ConnectionRecord> getConnectionHistory()
            throws GuacamoleException {
        return connection.getConnectionHistory();
    }

    @Override
    public Set<String> getSharingProfileIdentifiers()
            throws GuacamoleException {
        return connection.getSharingProfileIdentifiers();
    }

    @Override
    @Deprecated
    public GuacamoleTunnel connect(GuacamoleClientInformation info)
            throws GuacamoleException {
        return connection.connect(info, currentTokens.get());
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {

        // Make received tokens available within the legacy connect() strictly
        // in context of the current connect() call
        try {
            currentTokens.set(tokens);
            return connect(info);
        }
        finally {
            currentTokens.remove();
        }

    }

    @Override
    public int getActiveConnections() {
        return connection.getActiveConnections();
    }

}
