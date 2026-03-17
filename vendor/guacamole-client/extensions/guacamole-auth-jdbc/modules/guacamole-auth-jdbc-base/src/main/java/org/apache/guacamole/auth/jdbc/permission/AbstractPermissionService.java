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

package org.apache.guacamole.auth.jdbc.permission;

import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.base.EntityModel;
import org.apache.guacamole.auth.jdbc.base.ModeledPermissions;
import org.apache.guacamole.auth.jdbc.user.ModeledUser;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.Permission;
import org.apache.guacamole.net.auth.permission.PermissionSet;

/**
 * Abstract PermissionService implementation which provides additional
 * convenience methods for enforcing the permission model.
 *
 * @param <PermissionSetType>
 *     The type of permission sets this service provides access to.
 *
 * @param <PermissionType>
 *     The type of permission this service provides access to.
 */
public abstract class AbstractPermissionService<PermissionSetType extends PermissionSet<PermissionType>,
        PermissionType extends Permission>
    implements PermissionService<PermissionSetType, PermissionType> {

    /**
     * Returns the ObjectPermissionSet related to the type of the given entity.
     * If the given entity represents a user, then the ObjectPermissionSet
     * containing user permissions is returned. If the given entity represents
     * a user group, then the ObjectPermissionSet containing user group
     * permissions is returned.
     *
     * @param user
     *     The user to retrieve the ObjectPermissionSet from.
     *
     * @param targetEntity
     *     The entity whose type dictates the ObjectPermissionSet returned.
     *
     * @return
     *     The ObjectPermissionSet related to the type of the given entity.
     *
     * @throws GuacamoleException
     *     If the relevant ObjectPermissionSet cannot be retrieved.
     */
    protected ObjectPermissionSet getRelevantPermissionSet(ModeledUser user,
            ModeledPermissions<? extends EntityModel> targetEntity)
            throws GuacamoleException {

        if (targetEntity.isUser())
            return user.getUserPermissions();

        if (targetEntity.isUserGroup())
            return user.getUserGroupPermissions();

        // Entities should be only users or groups
        throw new UnsupportedOperationException("Unexpected entity type.");
        
    }

    /**
     * Determines whether the given user can read the permissions currently
     * granted to the given target entity. If the reading user and the target
     * entity are not the same, then explicit READ or SYSTEM_ADMINISTER access
     * is required. Permission inheritance via user groups is taken into account.
     *
     * @param user
     *     The user attempting to read permissions.
     *
     * @param targetEntity
     *     The entity whose permissions are being read.
     *
     * @return
     *     true if permission is granted, false otherwise.
     *
     * @throws GuacamoleException 
     *     If an error occurs while checking permission status, or if
     *     permission is denied to read the current user's permissions.
     */
    protected boolean canReadPermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity)
            throws GuacamoleException {

        // A user can always read their own permissions
        if (targetEntity.isUser(user.getUser().getIdentifier()))
            return true;
        
        // Privileged users (such as system administrators) may do anything
        if (user.isPrivileged())
            return true;

        // Can read permissions on target entity if explicit READ is granted
        ObjectPermissionSet permissionSet = getRelevantPermissionSet(user.getUser(), targetEntity);
        return permissionSet.hasPermission(ObjectPermission.Type.READ, targetEntity.getIdentifier());

    }

}
