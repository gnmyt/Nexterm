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

package org.apache.guacamole.properties;

import java.util.Collection;
import java.util.Collections;
import org.apache.guacamole.GuacamoleException;

/**
 * An abstract representation of a property in the guacamole.properties file,
 * which parses into a specific type.
 *
 * @param <Type>
 *     The type this GuacamoleProperty will parse into.
 */
public interface GuacamoleProperty<Type> {
    
    /**
     * Returns the name of the property in guacamole.properties that this
     * GuacamoleProperty will parse.
     *
     * @return
     *     The name of the property in guacamole.properties that this
     *     GuacamoleProperty will parse.
     */
    public String getName();

    /**
     * Parses the given string value into the type associated with this
     * GuacamoleProperty.
     *
     * @param value
     *     The string value to parse.
     * 
     * @return
     *     The parsed value.
     * 
     * @throws GuacamoleException
     *     If an error occurs while parsing the provided value.
     */
    public Type parseValue(String value) throws GuacamoleException;
    
    /**
     * Parses the given string value into a Collection of values of the type
     * associated with this GuacamoleProperty. The default implementation
     * simply returns a list containing a single item as parsed by the
     * parseValue method.
     * 
     * @param value
     *     The string value to parse.
     * 
     * @return
     *     A sorted Collection of the parsed values.
     * 
     * @throws GuacamoleException 
     *     If an error occurs while parsing the provided value.
     */
    default public Collection<Type> parseValueCollection(String value)
            throws GuacamoleException {
        
        return Collections.singletonList(parseValue(value));
        
    }

}
