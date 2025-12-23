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

package org.apache.guacamole.rest.permission;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * The set of permissions which are granted to a specific user or user group,
 * organized by object type and, if applicable, identifier. This object can be
 * constructed with arbitrary permissions present, or manipulated after creation
 * through the manipulation or replacement of its collections of permissions,
 * but is otherwise not intended for internal use as a data structure for
 * permissions. Its primary purpose is as a hierarchical format for exchanging
 * granted permissions with REST clients.
 */
public class APIPermissionSet {

    /**
     * Map of connection ID to the set of granted permissions.
     */
    private Map<String, Set<ObjectPermission.Type>> connectionPermissions =
            new HashMap<String, Set<ObjectPermission.Type>>();

    /**
     * Map of connection group ID to the set of granted permissions.
     */
    private Map<String, Set<ObjectPermission.Type>> connectionGroupPermissions =
            new HashMap<String, Set<ObjectPermission.Type>>();

    /**
     * Map of sharing profile ID to the set of granted permissions.
     */
    private Map<String, Set<ObjectPermission.Type>> sharingProfilePermissions =
            new HashMap<String, Set<ObjectPermission.Type>>();

    /**
     * Map of active connection ID to the set of granted permissions.
     */
    private Map<String, Set<ObjectPermission.Type>> activeConnectionPermissions =
            new HashMap<String, Set<ObjectPermission.Type>>();

    /**
     * Map of user ID to the set of granted permissions.
     */
    private Map<String, Set<ObjectPermission.Type>> userPermissions =
            new HashMap<String, Set<ObjectPermission.Type>>();

    /**
     * Map of user group ID to the set of granted permissions.
     */
    private Map<String, Set<ObjectPermission.Type>> userGroupPermissions =
            new HashMap<String, Set<ObjectPermission.Type>>();

    /**
     * Set of all granted system-level permissions.
     */
    private Set<SystemPermission.Type> systemPermissions =
            EnumSet.noneOf(SystemPermission.Type.class);

    /**
     * Creates a new permission set which contains no granted permissions. Any
     * permissions must be added by manipulating or replacing the applicable
     * permission collection.
     */
    public APIPermissionSet() {
    }

    /**
     * Adds the system permissions from the given SystemPermissionSet to the
     * Set of system permissions provided.
     *
     * @param permissions
     *     The Set to add system permissions to.
     *
     * @param permSet
     *     The SystemPermissionSet containing the system permissions to add.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving system permissions from the
     *     SystemPermissionSet.
     */
    private void addSystemPermissions(Set<SystemPermission.Type> permissions,
            SystemPermissionSet permSet) throws GuacamoleException {

        // Add all provided system permissions 
        for (SystemPermission permission : permSet.getPermissions())
            permissions.add(permission.getType());

    }
    
    /**
     * Adds the object permissions from the given ObjectPermissionSet to the
     * Map of object permissions provided.
     *
     * @param permissions
     *     The Map to add object permissions to.
     *
     * @param permSet
     *     The ObjectPermissionSet containing the object permissions to add.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving object permissions from the
     *     ObjectPermissionSet.
     */
    private void addObjectPermissions(Map<String, Set<ObjectPermission.Type>> permissions,
            ObjectPermissionSet permSet) throws GuacamoleException {

        // Add all provided object permissions 
        for (ObjectPermission permission : permSet.getPermissions()) {

            // Get associated set of permissions
            String identifier = permission.getObjectIdentifier();
            Set<ObjectPermission.Type> objectPermissions = permissions.get(identifier);

            // Create new set if none yet exists
            if (objectPermissions == null)
                permissions.put(identifier, EnumSet.of(permission.getType()));

            // Otherwise add to existing set
            else
                objectPermissions.add(permission.getType());

        }

    }
    
    /**
     * Creates a new permission set containing all permissions currently
     * granted within the given Permissions object.
     *
     * @param permissions
     *     The permissions that should be stored within this permission set.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the permissions.
     */
    public APIPermissionSet(Permissions permissions) throws GuacamoleException {

        // Add all permissions from the provided user
        addSystemPermissions(systemPermissions,           permissions.getSystemPermissions());
        addObjectPermissions(connectionPermissions,       permissions.getConnectionPermissions());
        addObjectPermissions(connectionGroupPermissions,  permissions.getConnectionGroupPermissions());
        addObjectPermissions(sharingProfilePermissions,   permissions.getSharingProfilePermissions());
        addObjectPermissions(activeConnectionPermissions, permissions.getActiveConnectionPermissions());
        addObjectPermissions(userPermissions,             permissions.getUserPermissions());
        addObjectPermissions(userGroupPermissions,        permissions.getUserGroupPermissions());
        
    }

    /**
     * Returns a map of connection IDs to the set of permissions granted for
     * that connection. If no permissions are granted to a particular
     * connection, its ID will not be present as a key in the map. This map is
     * mutable, and changes to this map will affect the permission set
     * directly.
     *
     * @return
     *     A map of connection IDs to the set of permissions granted for that
     *     connection.
     */
    public Map<String, Set<ObjectPermission.Type>> getConnectionPermissions() {
        return connectionPermissions;
    }

    /**
     * Returns a map of connection group IDs to the set of permissions granted
     * for that connection group. If no permissions are granted to a particular
     * connection group, its ID will not be present as a key in the map. This
     * map is mutable, and changes to this map will affect the permission set
     * directly.
     *
     * @return
     *     A map of connection group IDs to the set of permissions granted for
     *     that connection group.
     */
    public Map<String, Set<ObjectPermission.Type>> getConnectionGroupPermissions() {
        return connectionGroupPermissions;
    }

    /**
     * Returns a map of sharing profile identifiers to the set of permissions
     * granted for that sharing profile. If no permissions are granted to a
     * particular sharing profile, its identifier will not be present as a key
     * in the map. This map is mutable, and changes to this map will affect the
     * permission set directly.
     *
     * @return
     *     A map of sharing profile identifiers to the set of permissions
     *     granted for that sharing profile.
     */
    public Map<String, Set<ObjectPermission.Type>> getSharingProfilePermissions() {
        return sharingProfilePermissions;
    }

    /**
     * Returns a map of active connection IDs to the set of permissions granted
     * for that active connection. If no permissions are granted to a particular
     * active connection, its ID will not be present as a key in the map. This
     * map is mutable, and changes to this map will affect the permission set
     * directly.
     *
     * @return
     *     A map of active connection IDs to the set of permissions granted for
     *     that active connection.
     */
    public Map<String, Set<ObjectPermission.Type>> getActiveConnectionPermissions() {
        return activeConnectionPermissions;
    }

    /**
     * Returns a map of user IDs to the set of permissions granted for that
     * user. If no permissions are granted for a particular user, its ID will
     * not be present as a key in the map. This map is mutable, and changes to
     * to this map will affect the permission set directly.
     *
     * @return
     *     A map of user IDs to the set of permissions granted for that user.
     */
    public Map<String, Set<ObjectPermission.Type>> getUserPermissions() {
        return userPermissions;
    }

    /**
     * Returns a map of user group IDs to the set of permissions granted for
     * that user group. If no permissions are granted for a particular user
     * group, its ID will not be present as a key in the map. This map is
     * mutable, and changes to to this map will affect the permission set
     * directly.
     *
     * @return
     *     A map of user IDs to the set of permissions granted for that user.
     */
    public Map<String, Set<ObjectPermission.Type>> getUserGroupPermissions() {
        return userGroupPermissions;
    }

    /**
     * Returns the set of granted system-level permissions. If no permissions
     * are granted at the system level, this will be an empty set. This set is
     * mutable, and changes to this set will affect the permission set
     * directly.
     *
     * @return
     *     The set of granted system-level permissions.
     */
    public Set<SystemPermission.Type> getSystemPermissions() {
        return systemPermissions;
    }

    /**
     * Replaces the current map of connection permissions with the given map,
     * which must map connection ID to its corresponding set of granted
     * permissions. If a connection has no permissions, its ID must not be
     * present as a key in the map.
     *
     * @param connectionPermissions
     *     The map which must replace the currently-stored map of permissions.
     */
    public void setConnectionPermissions(Map<String, Set<ObjectPermission.Type>> connectionPermissions) {
        this.connectionPermissions = connectionPermissions;
    }

    /**
     * Replaces the current map of connection group permissions with the given
     * map, which must map connection group ID to its corresponding set of
     * granted permissions. If a connection group has no permissions, its ID
     * must not be present as a key in the map.
     *
     * @param connectionGroupPermissions
     *     The map which must replace the currently-stored map of permissions.
     */
    public void setConnectionGroupPermissions(Map<String, Set<ObjectPermission.Type>> connectionGroupPermissions) {
        this.connectionGroupPermissions = connectionGroupPermissions;
    }

    /**
     * Replaces the current map of sharing profile permissions with the given
     * map, which must map each sharing profile identifier to its corresponding
     * set of granted permissions. If a sharing profile has no permissions, its
     * identifier must not be present as a key in the map.
     *
     * @param sharingProfilePermissions
     *     The map which must replace the currently-stored map of permissions.
     */
    public void setSharingProfilePermissions(Map<String, Set<ObjectPermission.Type>> sharingProfilePermissions) {
        this.sharingProfilePermissions = sharingProfilePermissions;
    }

    /**
     * Replaces the current map of active connection permissions with the give
     * map, which must map active connection ID to its corresponding set of
     * granted permissions. If an active connection has no permissions, its ID
     * must not be present as a key in the map.
     *
     * @param activeConnectionPermissions
     *     The map which must replace the currently-stored map of permissions.
     */
    public void setActiveConnectionPermissions(Map<String, Set<ObjectPermission.Type>> activeConnectionPermissions) {
        this.activeConnectionPermissions = activeConnectionPermissions;
    }

    /**
     * Replaces the current map of user permissions with the given map, which
     * must map user ID to its corresponding set of granted permissions. If a
     * user has no permissions, its ID must not be present as a key in the map.
     *
     * @param userPermissions
     *     The map which must replace the currently-stored map of permissions.
     */
    public void setUserPermissions(Map<String, Set<ObjectPermission.Type>> userPermissions) {
        this.userPermissions = userPermissions;
    }

    /**
     * Replaces the current map of user group permissions with the given map,
     * which must map user group ID to its corresponding set of granted
     * permissions. If a user group has no permissions, its ID must not be
     * present as a key in the map.
     *
     * @param userGroupPermissions
     *     The map which must replace the currently-stored map of permissions.
     */
    public void setUserGroupPermissions(Map<String, Set<ObjectPermission.Type>> userGroupPermissions) {
        this.userGroupPermissions = userGroupPermissions;
    }

    /**
     * Replaces the current set of system-level permissions with the given set.
     * If no system-level permissions are granted, the empty set must be
     * specified.
     *
     * @param systemPermissions
     *     The set which must replace the currently-stored set of permissions.
     */
    public void setSystemPermissions(Set<SystemPermission.Type> systemPermissions) {
        this.systemPermissions = systemPermissions;
    }
    
}
