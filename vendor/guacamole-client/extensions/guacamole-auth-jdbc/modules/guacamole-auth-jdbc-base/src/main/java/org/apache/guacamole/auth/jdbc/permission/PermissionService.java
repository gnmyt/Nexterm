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

import java.util.Collection;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.base.EntityModel;
import org.apache.guacamole.auth.jdbc.base.ModeledPermissions;
import org.apache.guacamole.net.auth.permission.Permission;
import org.apache.guacamole.net.auth.permission.PermissionSet;
import org.apache.guacamole.properties.CaseSensitivity;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * deleting permissions, and for obtaining the permission sets that contain
 * these permissions. This service will automatically enforce the permissions
 * of the current user.
 *
 * @param <PermissionSetType>
 *     The type of permission sets this service provides access to.
 *
 * @param <PermissionType>
 *     The type of permission this service provides access to.
 */
public interface PermissionService<PermissionSetType extends PermissionSet<PermissionType>,
        PermissionType extends Permission> {

    /**
     * Return the current case sensitivity setting, allowing the system to
     * determine if usernames and/or group names should be treated as case-
     * sensitive.
     * 
     * @return
     *     The current case sensitivity configuration.
     * 
     * @throws GuacamoleException 
     *     If an error occurs retrieving configuration information related to
     *     case sensitivity.
     */
    default CaseSensitivity getCaseSensitivity() throws GuacamoleException {
        
        // By default identifiers are case-sensitive.
        return CaseSensitivity.ENABLED;
    }
    
    /**
     * Returns a permission set that can be used to retrieve and manipulate the
     * permissions of the given entity.
     *
     * @param user
     *     The user who will be retrieving or manipulating permissions through
     *     the returned permission set.
     *
     * @param targetEntity
     *     The entity to whom the permissions in the returned permission set are
     *     granted.
     *
     * @param effectiveGroups
     *     The identifiers of all groups that should be taken into account
     *     when determining the permissions effectively granted to the entity.
     *     If no groups are given, only permissions directly granted to the
     *     entity will be used.
     *
     * @return
     *     A permission set that contains all permissions associated with the
     *     given entity, and can be used to manipulate that entity's
     *     permissions.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the permissions of the given
     *     entity, or if permission to retrieve the permissions of the given
     *     entity is denied.
     */
    PermissionSetType getPermissionSet(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Set<String> effectiveGroups) throws GuacamoleException;

    /**
     * Retrieves all permissions associated with the given entity.
     *
     * @param user
     *     The user retrieving the permissions.
     *
     * @param targetEntity
     *     The entity associated with the permissions to be retrieved.
     *
     * @param effectiveGroups
     *     The identifiers of all groups that should be taken into account
     *     when determining the permissions effectively granted to the entity.
     *     If no groups are given, only permissions directly granted to the
     *     entity will be used.
     *
     * @return
     *     The permissions associated with the given entity.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the requested permissions.
     */
    Set<PermissionType> retrievePermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Set<String> effectiveGroups) throws GuacamoleException;

    /**
     * Creates the given permissions within the database. If any permissions
     * already exist, they will be ignored.
     *
     * @param user
     *     The user creating the permissions.
     *
     * @param targetEntity
     *     The entity associated with the permissions to be created.
     *
     * @param permissions 
     *     The permissions to create.
     *
     * @throws GuacamoleException
     *     If the user lacks permission to create the permissions, or an error
     *     occurs while creating the permissions.
     */
    void createPermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<PermissionType> permissions)
            throws GuacamoleException;

    /**
     * Deletes the given permissions. If any permissions do not exist, they
     * will be ignored.
     *
     * @param user
     *     The user deleting the permissions.
     *
     * @param targetEntity
     *     The entity associated with the permissions to be deleted.
     *
     * @param permissions
     *     The permissions to delete.
     *
     * @throws GuacamoleException
     *     If the user lacks permission to delete the permissions, or an error
     *     occurs while deleting the permissions.
     */
    void deletePermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<PermissionType> permissions)
            throws GuacamoleException;

}
