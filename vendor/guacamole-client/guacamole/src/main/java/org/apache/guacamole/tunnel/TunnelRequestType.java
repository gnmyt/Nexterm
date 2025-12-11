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

package org.apache.guacamole.tunnel;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.Connectable;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.UserContext;

/**
 * All supported object types that can be used as the destination of a tunnel.
 *
 * @see TunnelRequest#TYPE_PARAMETER
 * @see TunnelRequest#getType()
 */
public enum TunnelRequestType {

    /**
     * A Guacamole connection.
     */
    CONNECTION("c", "connection") {

        @Override
        public Connection getConnectable(UserContext userContext,
                String identifier) throws GuacamoleException {
            return userContext.getConnectionDirectory().get(identifier);
        }

    },

    /**
     * A Guacamole connection group.
     */
    CONNECTION_GROUP("g", "connection group") {

        @Override
        public ConnectionGroup getConnectable(UserContext userContext,
                String identifier) throws GuacamoleException {
            return userContext.getConnectionGroupDirectory().get(identifier);
        }

    },

    /**
     * An active Guacamole connection.
     */
    ACTIVE_CONNECTION("a", "active connection") {

        @Override
        public ActiveConnection getConnectable(UserContext userContext,
                String identifier) throws GuacamoleException {
            return userContext.getActiveConnectionDirectory().get(identifier);
        }

    };

    /**
     * The parameter value which denotes a destination object of this type
     * within a tunnel request.
     *
     * @see TunnelRequest#TYPE_PARAMETER
     * @see TunnelRequest#getType()
     */
    public final String PARAMETER_VALUE;

    /**
     * A human-readable, descriptive name of the type of destination object.
     */
    public final String NAME;

    /**
     * Defines a tunnel request type having the given corresponding parameter
     * value and human-readable name.
     *
     * @param value
     *     The parameter value which denotes a destination object of this
     *     type.
     *
     * @param name
     *     A human-readable, descriptive name of the type of destination
     *     object.
     */
    private TunnelRequestType(String value, String name) {
        PARAMETER_VALUE = value;
        NAME = name;
    }

    /**
     * Retrieves the object having the given identifier from the given
     * UserContext, where the type of object retrieved is the type of object
     * represented by this tunnel request type.
     *
     * @param userContext
     *     The UserContext to retrieve the object from.
     *
     * @param identifier
     *     The identifier of the object to retrieve.
     *
     * @return
     *     The object having the given identifier, or null if no such object
     *     exists.
     *
     * @throws GuacamoleException
     *     If an error occurs retrieving the requested object, or if permission
     *     to retrieve the object is denied.
     */
    public abstract Connectable getConnectable(UserContext userContext,
            String identifier) throws GuacamoleException;

    /**
     * Parses the given tunnel request type string, returning the
     * TunnelRequestType which matches that string, as declared by
     * {@link #PARAMETER_VALUE}. If no such type exists, null is returned.
     *
     * @param type
     *     The type string to parse.
     *
     * @return
     *     The TunnelRequestType which specifies the given string as its
     *     {@link #PARAMETER_VALUE}, or null if no such type exists.
     */
    public static TunnelRequestType parseType(String type) {

        // Locate type with given parameter value
        for (TunnelRequestType possibleType : values()) {
            if (type.equals(possibleType.PARAMETER_VALUE))
                return possibleType;
        }

        // No such type
        return null;

    }

}
