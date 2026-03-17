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
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.base.EntityModel;
import org.apache.guacamole.auth.jdbc.base.ModeledPermissions;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.properties.CaseSensitivity;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * deleting object permissions within a backend database model. This service
 * will automatically enforce the permissions of the current user.
 */
public abstract class ModeledObjectPermissionService
    extends ModeledPermissionService<ObjectPermissionSet, ObjectPermission, ObjectPermissionModel>
    implements ObjectPermissionService {

    @Override
    protected abstract ObjectPermissionMapper getPermissionMapper();

    @Override
    protected ObjectPermission getPermissionInstance(ObjectPermissionModel model) {
        return new ObjectPermission(model.getType(), model.getObjectIdentifier());
    }

    @Override
    protected ObjectPermissionModel getModelInstance(
            ModeledPermissions<? extends EntityModel> targetEntity,
            ObjectPermission permission) {

        ObjectPermissionModel model = new ObjectPermissionModel();

        // Populate model object with data from entity and permission
        model.setEntityID(targetEntity.getModel().getEntityID());
        model.setType(permission.getType());
        model.setObjectIdentifier(permission.getObjectIdentifier());

        return model;
        
    }

    /**
     * Determines whether the current user has permission to update the given
     * target entity, adding or removing the given permissions. Such permission
     * depends on whether the current user is a system administrator, whether
     * they have explicit UPDATE permission on the target entity, and whether
     * they have explicit ADMINISTER permission on all affected objects.
     * Permission inheritance via user groups is taken into account.
     *
     * @param user
     *     The user who is changing permissions.
     *
     * @param targetEntity
     *     The entity whose permissions are being changed.
     *
     * @param permissions
     *     The permissions that are being added or removed from the target
     *     entity.
     *
     * @return
     *     true if the user has permission to change the target entity's
     *     permissions as specified, false otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while checking permission status, or if
     *     permission is denied to read the current user's permissions.
     */
    protected boolean canAlterPermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<ObjectPermission> permissions)
            throws GuacamoleException {

        // Privileged users (such as system administrators) may do anything
        if (user.isPrivileged())
            return true;
        
        // Verify user has update permission on the target entity
        ObjectPermissionSet permissionSet = getRelevantPermissionSet(user.getUser(), targetEntity);
        if (!permissionSet.hasPermission(ObjectPermission.Type.UPDATE, targetEntity.getIdentifier()))
            return false;

        // Produce collection of affected identifiers
        Collection<String> affectedIdentifiers = new HashSet<String>(permissions.size());
        for (ObjectPermission permission : permissions)
            affectedIdentifiers.add(permission.getObjectIdentifier());

        // Determine subset of affected identifiers that we have admin access to
        ObjectPermissionSet affectedPermissionSet = getPermissionSet(user, user.getUser(), user.getEffectiveUserGroups());
        Collection<String> allowedSubset = affectedPermissionSet.getAccessibleObjects(
            Collections.singleton(ObjectPermission.Type.ADMINISTER),
            affectedIdentifiers
        );

        // The permissions can be altered if and only if the set of objects we
        // are allowed to administer is equal to the set of objects we will be
        // affecting.

        return affectedIdentifiers.size() == allowedSubset.size();
        
    }
    
    @Override
    public void createPermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<ObjectPermission> permissions)
            throws GuacamoleException {

        // Create permissions only if user has permission to do so
        if (canAlterPermissions(user, targetEntity, permissions)) {

            CaseSensitivity caseSensitivity = getCaseSensitivity();
            
            batchPermissionUpdates(permissions, permissionSubset -> {
                Collection<ObjectPermissionModel> models = getModelInstances(
                        targetEntity, permissionSubset);
                getPermissionMapper().insert(models, caseSensitivity);
            });

            return;
        }

        // User lacks permission to create object permissions
        throw new GuacamoleSecurityException("Permission denied.");

    }

    @Override
    public void deletePermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<ObjectPermission> permissions)
            throws GuacamoleException {

        // Delete permissions only if user has permission to do so
        if (canAlterPermissions(user, targetEntity, permissions)) {

            CaseSensitivity caseSensitivity = getCaseSensitivity();
            
            batchPermissionUpdates(permissions, permissionSubset -> {
                Collection<ObjectPermissionModel> models = getModelInstances(
                        targetEntity, permissionSubset);
                getPermissionMapper().delete(models, caseSensitivity);
            });

            return;
        }
        
        // User lacks permission to delete object permissions
        throw new GuacamoleSecurityException("Permission denied.");

    }

    @Override
    public boolean hasPermission(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            ObjectPermission.Type type, String identifier,
            Set<String> effectiveGroups) throws GuacamoleException {

        // Retrieve permissions only if allowed
        if (canReadPermissions(user, targetEntity))
            return getPermissionMapper().selectOne(targetEntity.getModel(),
                    type, identifier, effectiveGroups, getCaseSensitivity()) != null;

        // User cannot read this entity's permissions
        throw new GuacamoleSecurityException("Permission denied.");
        
    }

    @Override
    public Collection<String> retrieveAccessibleIdentifiers(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<ObjectPermission.Type> permissions,
            Collection<String> identifiers, Set<String> effectiveGroups)
            throws GuacamoleException {

        // Nothing is always accessible
        if (identifiers.isEmpty())
            return identifiers;
        
        // Privileged users (such as system administrators) may access everything
        if (user.isPrivileged())
            return identifiers;

        // Otherwise, return explicitly-retrievable identifiers only if allowed
        if (canReadPermissions(user, targetEntity))
            return getPermissionMapper().selectAccessibleIdentifiers(
                    targetEntity.getModel(), permissions, identifiers,
                    effectiveGroups, getCaseSensitivity());

        // User cannot read this entity's permissions
        throw new GuacamoleSecurityException("Permission denied.");

    }

}
