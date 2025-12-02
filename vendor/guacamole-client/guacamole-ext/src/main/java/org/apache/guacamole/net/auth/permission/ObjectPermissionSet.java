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

import java.util.Collection;
import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;


/**
 * A set of permissions which affect arbitrary objects, where each object has
 * an associated unique identifier.
 */
public interface ObjectPermissionSet extends PermissionSet<ObjectPermission> {

    /**
     * Tests whether the permission of the given type is granted for the
     * object having the given identifier.
     *
     * @param permission
     *     The permission to check.
     *
     * @param identifier
     *     The identifier of the object affected by the permission being
     *     checked.
     *
     * @return
     *     true if the permission is granted, false otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while checking permissions, or if permissions
     *     cannot be checked due to lack of permissions to do so.
     */
    boolean hasPermission(ObjectPermission.Type permission,
            String identifier) throws GuacamoleException;

    /**
     * Adds the specified permission for the object having the given
     * identifier.
     *
     * @param permission
     *     The permission to add.
     *
     * @param identifier
     *     The identifier of the object affected by the permission being
     *     added.
     *
     * @throws GuacamoleException
     *     If an error occurs while adding the permission, or if permission to
     *     add permissions is denied.
     */
    void addPermission(ObjectPermission.Type permission,
            String identifier) throws GuacamoleException;

    /**
     * Removes the specified permission for the object having the given
     * identifier.
     *
     * @param permission
     *     The permission to remove.
     *
     * @param identifier
     *     The identifier of the object affected by the permission being
     *     added.
     *
     * @throws GuacamoleException
     *     If an error occurs while removing the permission, or if permission
     *     to remove permissions is denied.
     */
    void removePermission(ObjectPermission.Type permission,
            String identifier) throws GuacamoleException;

    /**
     * Tests whether this user has the specified permissions for the objects
     * having the given identifiers. The identifier of an object is returned
     * in a new collection if at least one of the specified permissions is
     * granted for that object.
     *
     * @param permissions
     *     The permissions to check. An identifier will be included in the
     *     resulting collection if at least one of these permissions is granted
     *     for the associated object
     *
     * @param identifiers
     *     The identifiers of the objects affected by the permissions being
     *     checked.
     *
     * @return
     *     A collection containing the subset of identifiers for which at least
     *     one of the specified permissions is granted.
     *
     * @throws GuacamoleException
     *     If an error occurs while checking permissions, or if permissions
     *     cannot be checked due to lack of permissions to do so.
     */
    Collection<String> getAccessibleObjects(
            Collection<ObjectPermission.Type> permissions,
            Collection<String> identifiers) throws GuacamoleException;

    @Override
    Set<ObjectPermission> getPermissions()
            throws GuacamoleException;

    @Override
    void addPermissions(Set<ObjectPermission> permissions)
            throws GuacamoleException;

    @Override
    void removePermissions(Set<ObjectPermission> permissions)
            throws GuacamoleException;

    /**
     * An immutable instance of ObjectPermissionSet which contains no
     * permissions.
     */
    static final ObjectPermissionSet EMPTY_SET = new ObjectPermissionSet() {

        @Override
        public boolean hasPermission(ObjectPermission.Type permission,
                String identifier) throws GuacamoleException {
            return false;
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
        public Collection<String> getAccessibleObjects(Collection<ObjectPermission.Type> permissions,
                Collection<String> identifiers) throws GuacamoleException {
            return Collections.emptySet();
        }

        @Override
        public Set<ObjectPermission> getPermissions()
                throws GuacamoleException {
            return Collections.emptySet();
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

    };

}
