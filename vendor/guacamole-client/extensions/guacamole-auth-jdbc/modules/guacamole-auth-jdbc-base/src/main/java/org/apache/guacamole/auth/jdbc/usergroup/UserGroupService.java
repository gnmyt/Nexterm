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

package org.apache.guacamole.auth.jdbc.usergroup;

import com.google.inject.Inject;
import com.google.inject.Provider;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.base.ModeledDirectoryObjectMapper;
import org.apache.guacamole.auth.jdbc.base.ModeledDirectoryObjectService;
import org.apache.guacamole.auth.jdbc.base.EntityMapper;
import org.apache.guacamole.auth.jdbc.permission.ObjectPermissionMapper;
import org.apache.guacamole.auth.jdbc.permission.UserGroupPermissionMapper;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating user groups.
 */
public class UserGroupService extends ModeledDirectoryObjectService<ModeledUserGroup, UserGroup, UserGroupModel> {
    
    /**
     * Mapper for creating/deleting entities.
     */
    @Inject
    private EntityMapper entityMapper;
    
    /**
     * The Guacamole server configuration environment.
     */
    @Inject
    private JDBCEnvironment environment;

    /**
     * Mapper for accessing user groups.
     */
    @Inject
    private UserGroupMapper userGroupMapper;

    /**
     * Mapper for manipulating user group permissions.
     */
    @Inject
    private UserGroupPermissionMapper userGroupPermissionMapper;

    /**
     * Provider for creating user groups.
     */
    @Inject
    private Provider<ModeledUserGroup> userGroupProvider;
    
    @Override
    protected ModeledDirectoryObjectMapper<UserGroupModel> getObjectMapper() {
        return userGroupMapper;
    }

    @Override
    protected ObjectPermissionMapper getPermissionMapper() {
        return userGroupPermissionMapper;
    }

    @Override
    protected ModeledUserGroup getObjectInstance(ModeledAuthenticatedUser currentUser,
            UserGroupModel model) throws GuacamoleException {

        boolean exposeRestrictedAttributes;

        // Expose restricted attributes if the user group does not yet exist
        if (model.getObjectID() == null)
            exposeRestrictedAttributes = true;

        // Otherwise, expose restricted attributes only if the user has
        // ADMINISTER permission
        else
            exposeRestrictedAttributes = hasObjectPermission(currentUser,
                    model.getIdentifier(), ObjectPermission.Type.ADMINISTER);

        // Produce ModeledUserGroup exposing only those attributes for which the
        // current user has permission
        ModeledUserGroup group = userGroupProvider.get();
        group.init(currentUser, model, exposeRestrictedAttributes,
                environment.getCaseSensitivity().caseSensitiveGroupNames());
        return group;

    }

    @Override
    protected UserGroupModel getModelInstance(ModeledAuthenticatedUser currentUser,
            final UserGroup object) throws GuacamoleException {

        // Create new ModeledUserGroup backed by blank model
        UserGroupModel model = new UserGroupModel();
        ModeledUserGroup group = getObjectInstance(currentUser, model);

        // Set model contents through ModeledUser, copying the provided group
        group.setIdentifier(object.getIdentifier());
        group.setAttributes(object.getAttributes());

        return model;
        
    }

    @Override
    protected boolean hasCreatePermission(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Return whether user has explicit user group creation permission
        SystemPermissionSet permissionSet = user.getUser().getEffectivePermissions().getSystemPermissions();
        return permissionSet.hasPermission(SystemPermission.Type.CREATE_USER_GROUP);

    }

    @Override
    protected ObjectPermissionSet getEffectivePermissionSet(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Return permissions related to user groups
        return user.getUser().getEffectivePermissions().getUserGroupPermissions();

    }

    @Override
    protected void beforeCreate(ModeledAuthenticatedUser user, UserGroup object,
            UserGroupModel model) throws GuacamoleException {

        super.beforeCreate(user, object, model);
        
        // Group name must not be blank
        if (model.getIdentifier() == null || model.getIdentifier().trim().isEmpty())
            throw new GuacamoleClientException("The group name must not be blank.");
        
        // Do not create duplicate user groups
        UserGroupModel existing = userGroupMapper.selectOne(model.getIdentifier(),
                environment.getCaseSensitivity());
        if (existing != null)
            throw new GuacamoleClientException("Group \"" + model.getIdentifier() + "\" already exists.");

        // Create base entity object, implicitly populating underlying entity ID
        entityMapper.insert(model);

    }

    @Override
    protected void beforeUpdate(ModeledAuthenticatedUser user,
            ModeledUserGroup object, UserGroupModel model) throws GuacamoleException {

        super.beforeUpdate(user, object, model);
        
        // Group names must not be blank
        if (model.getIdentifier() == null || model.getIdentifier().trim().isEmpty())
            throw new GuacamoleClientException("The group name must not be blank.");
        
        // Do not allow groups to be renamed if the name collides with that of
        // another, existing group
        UserGroupModel existing = userGroupMapper.selectOne(model.getIdentifier(),
                environment.getCaseSensitivity());
        if (existing != null && !existing.getObjectID().equals(model.getObjectID()))
            throw new GuacamoleClientException("Group \"" + model.getIdentifier() + "\" already exists.");

    }

    @Override
    protected boolean isValidIdentifier(String identifier) {

        // All strings are valid group identifiers
        return true;

    }

}
