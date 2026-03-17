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

package org.apache.guacamole.net.auth.simple;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AbstractUser;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;

/**
 * A read-only User implementation which has no permissions. Implementations
 * that need to define permissions should extend this class and override the
 * associated getters.
 */
public class SimpleUser extends AbstractUser {

    /**
     * All user permissions granted to this user.
     */
    private final Set<ObjectPermission> userPermissions = new HashSet<>();

    /**
     * All connection permissions granted to this user.
     */
    private final Set<ObjectPermission> connectionPermissions = new HashSet<>();
    
    /**
     * All connection group permissions granted to this user.
     */
    private final Set<ObjectPermission> connectionGroupPermissions = new HashSet<>();

    /**
     * Creates a completely uninitialized SimpleUser.
     */
    public SimpleUser() {
    }

    /**
     * Creates a new SimpleUser having the given username.
     *
     * @param username
     *     The username to assign to this SimpleUser.
     */
    public SimpleUser(String username) {
        super.setIdentifier(username);
    }

    /**
     * Adds a new READ permission to the given set of permissions for each of
     * the given identifiers.
     *
     * @param permissions
     *     The set of permissions to add READ permissions to.
     *
     * @param identifiers
     *     The identifiers which should each have a corresponding READ
     *     permission added to the given set.
     */
    private void addReadPermissions(Set<ObjectPermission> permissions,
            Collection<String> identifiers) {

        // Add a READ permission to the set for each identifier given
        identifiers.forEach(identifier ->
            permissions.add(new ObjectPermission(
                ObjectPermission.Type.READ,
                identifier)
            ));

    }

    /**
     * Creates a new SimpleUser having the given username and READ access to
     * the connections and connection groups having the given identifiers.
     *
     * @param username
     *     The username to assign to this SimpleUser.
     *
     * @param connectionIdentifiers
     *     The identifiers of all connections this user has READ access to.
     *
     * @param connectionGroupIdentifiers
     *     The identifiers of all connection groups this user has READ access
     *     to.
     *
     * @deprecated
     *     Extend and override the applicable permission set getters instead,
     *     relying on SimpleUser to expose no permissions by default for all
     *     permission sets that aren't overridden. See {@link SimpleObjectPermissionSet}
     *     for convenient methods of providing a read-only permission set with
     *     specific permissions.
     */
    @Deprecated
    public SimpleUser(String username,
            Collection<String> connectionIdentifiers,
            Collection<String> connectionGroupIdentifiers) {

        this(username);

        // Add permissions
        addReadPermissions(connectionPermissions,      connectionIdentifiers);
        addReadPermissions(connectionGroupPermissions, connectionGroupIdentifiers);

    }

    /**
     * Creates a new SimpleUser having the given username and READ access to
     * the users, connections, and groups having the given identifiers.
     *
     * @param username
     *     The username to assign to this SimpleUser.
     *
     * @param userIdentifiers
     *     The identifiers of all users this user has READ access to.
     *
     * @param connectionIdentifiers
     *     The identifiers of all connections this user has READ access to.
     *
     * @param connectionGroupIdentifiers
     *     The identifiers of all connection groups this user has READ access
     *     to.
     *
     * @deprecated
     *     Extend and override the applicable permission set getters instead,
     *     relying on SimpleUser to expose no permissions by default for all
     *     permission sets that aren't overridden. See {@link SimpleObjectPermissionSet}
     *     for convenient methods of providing a read-only permission set with
     *     specific permissions.
     */
    @Deprecated
    public SimpleUser(String username,
            Collection<String> userIdentifiers,
            Collection<String> connectionIdentifiers,
            Collection<String> connectionGroupIdentifiers) {

        this(username);

        // Add permissions
        addReadPermissions(userPermissions,            userIdentifiers);
        addReadPermissions(connectionPermissions,      connectionIdentifiers);
        addReadPermissions(connectionGroupPermissions, connectionGroupIdentifiers);

    }

    @Override
    public ObjectPermissionSet getConnectionPermissions()
            throws GuacamoleException {
        return new SimpleObjectPermissionSet(connectionPermissions);
    }

    @Override
    public ObjectPermissionSet getConnectionGroupPermissions()
            throws GuacamoleException {
        return new SimpleObjectPermissionSet(connectionGroupPermissions);
    }

    @Override
    public ObjectPermissionSet getUserPermissions()
            throws GuacamoleException {
        return new SimpleObjectPermissionSet(userPermissions);
    }

}
