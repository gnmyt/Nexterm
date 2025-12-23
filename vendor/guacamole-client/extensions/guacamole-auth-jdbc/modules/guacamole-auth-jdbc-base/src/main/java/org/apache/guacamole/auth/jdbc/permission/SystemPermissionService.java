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

import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.Collection;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.auth.jdbc.base.EntityModel;
import org.apache.guacamole.auth.jdbc.base.ModeledPermissions;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.properties.CaseSensitivity;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * deleting system permissions. This service will automatically enforce
 * the permissions of the current user.
 */
public class SystemPermissionService
    extends ModeledPermissionService<SystemPermissionSet, SystemPermission, SystemPermissionModel> {

    /**
     * Mapper for system-level permissions.
     */
    @Inject
    private SystemPermissionMapper systemPermissionMapper;

    /**
     * Provider for creating system permission sets.
     */
    @Inject
    private Provider<SystemPermissionSet> systemPermissionSetProvider;

    @Override
    protected SystemPermissionMapper getPermissionMapper() {
        return systemPermissionMapper;
    }
    
    @Override
    protected SystemPermission getPermissionInstance(SystemPermissionModel model) {
        return new SystemPermission(model.getType());
    }

    @Override
    protected SystemPermissionModel getModelInstance(
            final ModeledPermissions<? extends EntityModel> targetEntity,
            final SystemPermission permission) {

        SystemPermissionModel model = new SystemPermissionModel();

        // Populate model object with data from entity and permission
        model.setEntityID(targetEntity.getModel().getEntityID());
        model.setType(permission.getType());

        return model;
        
    }

    @Override
    public SystemPermissionSet getPermissionSet(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Set<String> effectiveGroups) throws GuacamoleException {

        // Create permission set for requested entity
        SystemPermissionSet permissionSet = systemPermissionSetProvider.get();
        permissionSet.init(user, targetEntity, effectiveGroups);

        return permissionSet;
        
    }
    
    @Override
    public void createPermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<SystemPermission> permissions) throws GuacamoleException {

        // Only privileged users (such as system administrators) can create
        // system permissions
        if (user.isPrivileged()) {

            // Pull identifier case sensitivity
            CaseSensitivity caseSensitivity = getCaseSensitivity();
            
            batchPermissionUpdates(permissions, permissionSubset -> {
                Collection<SystemPermissionModel> models = getModelInstances(
                        targetEntity, permissionSubset);
                systemPermissionMapper.insert(models, caseSensitivity);
            });

            return;
        }

        // User lacks permission to create system permissions
        throw new GuacamoleSecurityException("Permission denied.");
        
    }

    @Override
    public void deletePermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<SystemPermission> permissions) throws GuacamoleException {

        // Only privileged users (such as system administrators) can delete
        // system permissions
        if (user.isPrivileged()) {

            // Do not allow users to remove their own admin powers
            if (user.getUser().getIdentifier().equals(targetEntity.getIdentifier()))
                throw new GuacamoleUnsupportedException("Removing your own administrative permissions is not allowed.");

            // Pull case sensitivity
            CaseSensitivity caseSensitivity = getCaseSensitivity();
            
            batchPermissionUpdates(permissions, permissionSubset -> {
                Collection<SystemPermissionModel> models = getModelInstances(
                        targetEntity, permissionSubset);
                systemPermissionMapper.delete(models, caseSensitivity);
            });

            return;
        }

        // User lacks permission to delete system permissions
        throw new GuacamoleSecurityException("Permission denied.");
        
    }

    /**
     * Retrieves whether the permission of the given type has been granted to
     * the given entity. Permission inheritance through group membership is
     * taken into account.
     *
     * @param user
     *     The user retrieving the permission.
     *
     * @param targetEntity
     *     The entity associated with the permission to be retrieved.
     * 
     * @param type
     *     The type of permission to retrieve.
     *
     * @param effectiveGroups
     *     The identifiers of all groups that should be taken into account
     *     when determining the permissions effectively granted to the entity.
     *     If no groups are given, only permissions directly granted to the
     *     entity will be used.
     *
     * @return
     *     true if permission of the given type has been granted to the given
     *     entity, false otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the requested permission.
     */
    public boolean hasPermission(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            SystemPermission.Type type, Set<String> effectiveGroups)
            throws GuacamoleException {

        // Retrieve permissions only if allowed
        if (canReadPermissions(user, targetEntity))
            return getPermissionMapper().selectOne(targetEntity.getModel(), type, effectiveGroups, getCaseSensitivity()) != null;

        // User cannot read this entity's permissions
        throw new GuacamoleSecurityException("Permission denied.");
        
    }

}
