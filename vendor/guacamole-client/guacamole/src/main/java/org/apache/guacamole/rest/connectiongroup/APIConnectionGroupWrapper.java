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

package org.apache.guacamole.rest.connectiongroup;

import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * A wrapper to make an APIConnection look like a ConnectionGroup.
 * Useful where a org.apache.guacamole.net.auth.ConnectionGroup is required.
 */
public class APIConnectionGroupWrapper implements ConnectionGroup {

    /**
     * The wrapped APIConnectionGroup.
     */
    private final APIConnectionGroup apiConnectionGroup;
    
    /**
     * Create a new APIConnectionGroupWrapper to wrap the given 
     * APIConnectionGroup as a ConnectionGroup.
     * @param apiConnectionGroup the APIConnectionGroup to wrap.
     */
    public APIConnectionGroupWrapper(APIConnectionGroup apiConnectionGroup) {
        this.apiConnectionGroup = apiConnectionGroup;
    }
    
    @Override
    public String getName() {
        return apiConnectionGroup.getName();
    }

    @Override
    public void setName(String name) {
        apiConnectionGroup.setName(name);
    }

    @Override
    public String getIdentifier() {
        return apiConnectionGroup.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        apiConnectionGroup.setIdentifier(identifier);
    }

    @Override
    public String getParentIdentifier() {
        return apiConnectionGroup.getParentIdentifier();
    }

    @Override
    public void setParentIdentifier(String parentIdentifier) {
        apiConnectionGroup.setParentIdentifier(parentIdentifier);
    }

    @Override
    public void setType(Type type) {
        apiConnectionGroup.setType(type);
    }

    @Override
    public Type getType() {
        return apiConnectionGroup.getType();
    }

    @Override
    public int getActiveConnections() {
        return apiConnectionGroup.getActiveConnections();
    }

    @Override
    public Set<String> getConnectionIdentifiers() {
        throw new UnsupportedOperationException("Operation not supported.");
    }

    @Override
    public Set<String> getConnectionGroupIdentifiers() {
        throw new UnsupportedOperationException("Operation not supported.");
    }

    @Override
    public Map<String, String> getAttributes() {
        return apiConnectionGroup.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        apiConnectionGroup.setAttributes(attributes);
    }

    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        throw new UnsupportedOperationException("Operation not supported.");
    }

}
