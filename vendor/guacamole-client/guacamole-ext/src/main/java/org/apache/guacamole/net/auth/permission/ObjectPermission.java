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

package org.apache.guacamole.net.auth.permission;


/**
 * A permission which affects a specific object, rather than the system as a
 * whole.
 */
public class ObjectPermission implements Permission<ObjectPermission.Type> {

    /**
     * Specific types of object-level permissions. Each permission type is
     * related to a specific class of object-level operation.
     */
    public enum Type {

        /**
         * Read data within an object.
         */
        READ,

        /**
         * Update data within an object.
         */
        UPDATE,

        /**
         * Delete an object.
         */
        DELETE,

        /**
         * Change who has access to an object.
         */
        ADMINISTER

    }

    /**
     * The identifier of the GuacamoleConfiguration associated with the
     * operation affected by this permission.
     */
    private final String identifier;

    /**
     * The type of operation affected by this permission.
     */
    private final Type type;

    /**
     * Creates a new ObjectPermission having the given type and identifier.
     * The identifier must be the unique identifier assigned to the object
     * associated with this permission by the AuthenticationProvider in use.
     *
     * @param type
     *     The type of operation affected by this permission.
     *
     * @param identifier
     *     The identifier of the object associated with the operation affected
     *     by this permission.
     */
    public ObjectPermission(Type type, String identifier) {

        this.identifier = identifier;
        this.type = type;

    }

   /**
     * Returns the identifier of the specific object affected by this
     * permission.
     *
     * @return The identifier of the specific object affected by this
     *         permission.
     */
    public String getObjectIdentifier() {
        return identifier;
    }

    @Override
    public Type getType() {
        return type;
    }

    @Override
    public int hashCode() {
        int hash = 5;
        if (identifier != null) hash = 47 * hash + identifier.hashCode();
        if (type != null)       hash = 47 * hash + type.hashCode();
        return hash;
    }

    @Override
    public boolean equals(Object obj) {

        // Not equal if null or wrong type
        if (obj == null) return false;
        if (getClass() != obj.getClass()) return false;

        final ObjectPermission other = (ObjectPermission) obj;

        // Not equal if different type
        if (this.type != other.type)
            return false;

        // If null identifier, equality depends on whether other identifier
        // is null
        if (identifier == null)
            return other.identifier == null;

        // Otherwise, equality depends entirely on identifier
        return identifier.equals(other.identifier);

    }

}
