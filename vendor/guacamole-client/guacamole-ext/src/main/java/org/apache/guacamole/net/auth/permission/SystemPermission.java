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
 * A permission which affects the system as a whole, rather than an individual
 * object.
 */
public class SystemPermission implements Permission<SystemPermission.Type> {

    /**
     * Specific types of system-level permissions. Each permission type is
     * related to a specific class of system-level operation.
     */
    public enum Type {

        /**
         * Create users.
         */
        CREATE_USER,

        /**
         * Create user groups.
         */
        CREATE_USER_GROUP,

        /**
         * Create connections.
         */
        CREATE_CONNECTION,

        /**
         * Create connection groups.
         */
        CREATE_CONNECTION_GROUP,

        /**
         * Create sharing profiles.
         */
        CREATE_SHARING_PROFILE,
        
        /**
         * Audit the system in general, which involves the ability to view
         * active and historical connection records, user logon records, etc.,
         * but lacks permission to change any of these details (interact with
         * active connections, update user accounts, etc).
         */
        AUDIT,

        /**
         * Administer the system in general, including adding permissions
         * which affect the system (like user creation, connection creation,
         * and system administration).
         */
        ADMINISTER

    }

    /**
     * The type of operation affected by this permission.
     */
    private Type type;

    /**
     * Creates a new SystemPermission with the given
     * type.
     *
     * @param type The type of operation controlled by this permission.
     */
    public SystemPermission(Type type) {
        this.type = type;
    }

    @Override
    public Type getType() {
        return type;
    }

    @Override
    public int hashCode() {
        return type.hashCode();
    }

    @Override
    public boolean equals(Object obj) {

        // Not equal if null or wrong type
        if (obj == null) return false;
        if (getClass() != obj.getClass()) return false;

        final SystemPermission other = (SystemPermission) obj;

        // Compare types
        if (type != other.type)
            return false;

        return true;
    }

}
