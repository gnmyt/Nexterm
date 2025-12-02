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

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;

/**
 * A read-only implementation of ObjectPermissionSet which uses a backing Set
 * of Permissions to determine which permissions are present.
 */
public class SimpleObjectPermissionSet implements ObjectPermissionSet {

    /**
     * The set of all permissions currently granted.
     */
    private Set<ObjectPermission> permissions = Collections.emptySet();

    /**
     * Creates a new empty SimpleObjectPermissionSet. If you are not extending
     * SimpleObjectPermissionSet and only need an immutable, empty
     * ObjectPermissionSet, consider using {@link ObjectPermissionSet#EMPTY_SET}
     * instead.
     */
    public SimpleObjectPermissionSet() {
    }

    /**
     * Creates a new set of ObjectPermissions for each possible combination of
     * the given identifiers and permission types.
     *
     * @param identifiers
     *     The identifiers which should have one ObjectPermission for each of
     *     the given permission types.
     *
     * @param types
     *     The permissions which should be granted for each of the given
     *     identifiers.
     *
     * @return
     *     A new set of ObjectPermissions containing one ObjectPermission for
     *     each possible combination of the given identifiers and permission
     *     types.
     */
    private static Set<ObjectPermission> createPermissions(Collection<String> identifiers,
            Collection<ObjectPermission.Type> types) {

        // Add a permission of each type to the set for each identifier given
        Set<ObjectPermission> permissions = new HashSet<>(identifiers.size());
        types.forEach(type -> {
            identifiers.forEach(identifier -> permissions.add(new ObjectPermission(type, identifier)));
        });

        return permissions;

    }

    /**
     * Creates a new SimpleObjectPermissionSet which contains permissions for
     * all possible unique combinations of the given identifiers and permission
     * types.
     *
     * @param identifiers
     *     The identifiers which should be associated permissions having each
     *     of the given permission types.
     *
     * @param types
     *     The types of permissions which should be granted for each of the
     *     given identifiers.
     */
    public SimpleObjectPermissionSet(Collection<String> identifiers,
            Collection<ObjectPermission.Type> types) {
        this(createPermissions(identifiers, types));
    }

    /**
     * Creates a new SimpleObjectPermissionSet which contains only READ
     * permissions for each of the given identifiers.
     *
     * @param identifiers
     *     The identifiers which should each be associated with READ
     *     permission.
     */
    public SimpleObjectPermissionSet(Collection<String> identifiers) {
        this(identifiers, Collections.singletonList(ObjectPermission.Type.READ));
    }

    /**
     * Creates a new SimpleObjectPermissionSet which contains the permissions
     * within the given Set.
     *
     * @param permissions 
     *     The Set of permissions this SimpleObjectPermissionSet should
     *     contain.
     */
    public SimpleObjectPermissionSet(Set<ObjectPermission> permissions) {
        this.permissions = permissions;
    }

    /**
     * Sets the Set which backs this SimpleObjectPermissionSet. Future function
     * calls on this SimpleObjectPermissionSet will use the provided Set.
     *
     * @param permissions 
     *     The Set of permissions this SimpleObjectPermissionSet should
     *     contain.
     */
    protected void setPermissions(Set<ObjectPermission> permissions) {
        this.permissions = permissions;
    }

    @Override
    public Set<ObjectPermission> getPermissions() {
        return permissions;
    }

    @Override
    public boolean hasPermission(ObjectPermission.Type permission,
            String identifier) throws GuacamoleException {

        ObjectPermission objectPermission =
                new ObjectPermission(permission, identifier);
        
        return permissions.contains(objectPermission);

    }

    @Override
    public void addPermission(ObjectPermission.Type permission,
            String identifier) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public void removePermission(ObjectPermission.Type permission,
            String identifier) throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public Collection<String> getAccessibleObjects(
            Collection<ObjectPermission.Type> permissionTypes,
            Collection<String> identifiers) throws GuacamoleException {

        Collection<String> accessibleObjects = new ArrayList<String>(permissions.size());

        // For each identifier/permission combination
        for (String identifier : identifiers) {
            for (ObjectPermission.Type permissionType : permissionTypes) {

                // Add identifier if at least one requested permission is granted
                ObjectPermission permission = new ObjectPermission(permissionType, identifier);
                if (permissions.contains(permission)) {
                    accessibleObjects.add(identifier);
                    break;
                }

            }
        }

        return accessibleObjects;
        
    }

    @Override
    public void addPermissions(Set<ObjectPermission> permissions)
            throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public void removePermissions(Set<ObjectPermission> permissions)
            throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

}
