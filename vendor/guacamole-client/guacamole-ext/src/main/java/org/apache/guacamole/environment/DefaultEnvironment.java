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

import org.apache.guacamole.properties.GuacamoleProperties;
import java.util.Collection;
import java.util.Collections;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.properties.CaseSensitivity;
import org.apache.guacamole.properties.GuacamoleProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Internal implementation of Environment that provides the default
 * implementations for any functions that are added to the Environment
 * interface. This is primarily necessary to allow those default implementations
 * to log warnings or informational messages without needing to repeatedly
 * recreate the Logger.
 */
class DefaultEnvironment extends DelegatingEnvironment {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(DefaultEnvironment.class);

    /**
     * Creates a new DefaultEnvironment that provides default implementations
     * for functions that may not be implemented by the given Environment
     * implementation. The versions provided by DefaultEnvironment must still
     * be manually called by actual <code>public default</code> functions on
     * Environment to have any effect.
     *
     * @param environment
     *     The environment that may not provide implementations for all
     *     functions defined by the Environment interface.
     */
    protected DefaultEnvironment(Environment environment) {
        super(environment);
    }

    @Override
    public <Type> Collection<Type> getPropertyCollection(
            GuacamoleProperty<Type> property) throws GuacamoleException {
        
        /* Pull the given property as a string. */
        StringGuacamoleProperty stringProperty = new StringGuacamoleProperty() {
            
            @Override
            public String getName() { return property.getName(); }
            
        };
        
        /* Parse the string to a Collection of the desired type. */
        return property.parseValueCollection(getProperty(stringProperty));
        
    }
    
    @Override
    public <Type> Collection<Type> getPropertyCollection(
            GuacamoleProperty<Type> property, Type defaultValue)
            throws GuacamoleException {
        
        /* Pull the given property as a string. */
        StringGuacamoleProperty stringProperty = new StringGuacamoleProperty() {
            
            @Override
            public String getName() { return property.getName(); }
            
        };
        
        /* Check the value and return the default if null. */
        String stringValue = getProperty(stringProperty);
        if (stringValue == null)
            return Collections.singletonList(defaultValue);
        
        /* Parse the string and return the collection. */
        return property.parseValueCollection(stringValue);
        
    }

    @Override    
    public <Type> Collection<Type> getPropertyCollection(
            GuacamoleProperty<Type> property, Collection<Type> defaultValue)
            throws GuacamoleException {
        
        /* Pull the given property as a string. */
        StringGuacamoleProperty stringProperty = new StringGuacamoleProperty() {
            
            @Override
            public String getName() { return property.getName(); }
            
        };
        
        /* Check the value and return the default if null. */
        String stringValue = getProperty(stringProperty);
        if (stringValue == null)
            return defaultValue;
        
        /* Parse the string and return the collection. */
        return property.parseValueCollection(stringValue);
        
    }

    @Override    
    public <Type> Collection<Type> getRequiredPropertyCollection(
            GuacamoleProperty<Type> property) throws GuacamoleException {
        
        /* Pull the given property as a string. */
        StringGuacamoleProperty stringProperty = new StringGuacamoleProperty() {
            
            @Override
            public String getName() { return property.getName(); }
            
        };
        
        /* Parse the string to a Collection of the desired type. */
        return property.parseValueCollection(getRequiredProperty(stringProperty));
        
    }

    @Override
    public void addGuacamoleProperties(GuacamoleProperties properties)
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException(String.format("%s does not "
                + "support dynamic definition of Guacamole properties.",
                getClass()));
    }

    @Override
    public CaseSensitivity getCaseSensitivity() {

        try {
            return DefaultEnvironment.this.getProperty(CASE_SENSITIVITY, CaseSensitivity.ENABLED);
        }
        catch (GuacamoleException e) {

            logger.error("Defaulting to case-sensitive handling of "
                    + "usernames and group names as the desired case "
                    + "sensitivity configuration could not be read: {}",
                    e.getMessage());

            logger.debug("Error reading case sensitivity configuration.", e);
            return CaseSensitivity.ENABLED;

        }

    }

}
