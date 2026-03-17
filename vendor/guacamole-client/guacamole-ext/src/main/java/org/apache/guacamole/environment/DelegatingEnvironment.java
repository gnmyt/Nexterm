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

package org.apache.guacamole.environment;

import java.io.File;
import java.util.Collection;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.GuacamoleProxyConfiguration;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.guacamole.properties.GuacamoleProperties;
import org.apache.guacamole.properties.GuacamoleProperty;
import org.apache.guacamole.protocols.ProtocolInfo;

/**
 * Environment implementation which simply delegates all function calls to a
 * wrapped Environment instance.
 */
public class DelegatingEnvironment implements Environment {

    /**
     * The Environment instance that all function calls should be delegated to.
     */
    private final Environment environment;

    /**
     * Creates a new DelegatingEnvironment which delegates all function calls
     * to the given Environment.
     *
     * @param environment
     *     The Environment that all function calls should be delegated to.
     */
    public DelegatingEnvironment(Environment environment) {
        this.environment = environment;
    }

    @Override
    public File getGuacamoleHome() {
        return environment.getGuacamoleHome();
    }

    @Override
    public Map<String, ProtocolInfo> getProtocols() {
        return environment.getProtocols();
    }

    @Override
    public ProtocolInfo getProtocol(String name) {
        return environment.getProtocol(name);
    }

    @Override
    public <Type> Type getProperty(GuacamoleProperty<Type> property) throws GuacamoleException {
        return environment.getProperty(property);
    }

    @Override
    public <Type> Type getProperty(GuacamoleProperty<Type> property, Type defaultValue) throws GuacamoleException {
        return environment.getProperty(property, defaultValue);
    }
    
    @Override
    public <Type> Collection<Type> getPropertyCollection(GuacamoleProperty<Type> property)
            throws GuacamoleException {
        return environment.getPropertyCollection(property);
    }
    
    @Override
    public <Type> Collection<Type> getPropertyCollection(GuacamoleProperty<Type> property,
            Type defaultValue) throws GuacamoleException {
        return environment.getPropertyCollection(property, defaultValue);
    }
    
    @Override
    public <Type> Collection<Type> getPropertyCollection(GuacamoleProperty<Type> property,
            Collection<Type> defaultValue) throws GuacamoleException {
        return environment.getPropertyCollection(property, defaultValue);
    }

    @Override
    public <Type> Type getRequiredProperty(GuacamoleProperty<Type> property) throws GuacamoleException {
        return environment.getRequiredProperty(property);
    }
    
    @Override
    public <Type> Collection<Type> getRequiredPropertyCollection(GuacamoleProperty<Type> property)
            throws GuacamoleException {
        return environment.getRequiredPropertyCollection(property);
    }

    @Override
    public GuacamoleProxyConfiguration getDefaultGuacamoleProxyConfiguration() throws GuacamoleException {
        return environment.getDefaultGuacamoleProxyConfiguration();
    }

    @Override
    public void addGuacamoleProperties(GuacamoleProperties properties) throws GuacamoleException {
        environment.addGuacamoleProperties(properties);
    }
    
    @Override
    public CaseSensitivity getCaseSensitivity() {
        return environment.getCaseSensitivity();
    }

}
