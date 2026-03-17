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

import java.util.Set;
import org.apache.guacamole.GuacamoleException;

/**
 * Represents a connection group, which can contain both other connection groups
 * as well as connections.
 */
public interface ConnectionGroup extends Identifiable, Connectable, Attributes, Nameable {
  
    /**
     * All legal types of connection group.
     */
    public enum Type {

        /**
         * A connection group that purely organizes other connections or
         * connection groups, serving only as a container. An organizational
         * connection group is analogous to a directory or folder in a
         * filesystem.
         */
        ORGANIZATIONAL,

        /**
         * A connection group that acts as a load balancer. A balancing
         * connection group can be connected to in the same manner as a
         * connection, and will transparently route to the least-used
         * underlying connection.
         */
        BALANCING

    };

    /**
     * Returns the unique identifier of the parent ConnectionGroup for
     * this ConnectionGroup.
     * 
     * @return The unique identifier of the parent ConnectionGroup for
     * this ConnectionGroup.
     */
    public String getParentIdentifier();

    /**
     * Sets the unique identifier of the parent ConnectionGroup for
     * this ConnectionGroup.
     * 
     * @param parentIdentifier The unique identifier of the parent 
     * ConnectionGroup for this ConnectionGroup.
     */
    public void setParentIdentifier(String parentIdentifier);
    
    /**
     * Set the type of this ConnectionGroup.
     *
     * @param type The type of this ConnectionGroup.
     */
    public void setType(Type type);
    
    /**
     * Returns the type of this connection.
     * @return the type of this connection.
     */
    public Type getType();

    /**
     * Returns the identifiers of all readable connections that are children
     * of this connection group.
     *
     * @return
     *     The set of identifiers of all readable connections that are children
     *     of this connection group.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the identifiers.
     */
    public Set<String> getConnectionIdentifiers() throws GuacamoleException;

    /**
     * Returns the identifiers of all readable connection groups that are
     * children of this connection group.
     *
     * @return
     *     The set of identifiers of all readable connection groups that are
     *     children of this connection group.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the identifiers.
     */

    public Set<String> getConnectionGroupIdentifiers()
            throws GuacamoleException;

}
