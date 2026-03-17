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

package org.apache.guacamole.auth.jdbc.base;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.net.auth.Identifiable;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating objects that can be children of other objects. This service will
 * automatically enforce the permissions of the current user.
 *
 * @param <InternalType>
 *     The specific internal implementation of the type of object this service
 *     provides access to.
 *
 * @param <ExternalType>
 *     The external interface or implementation of the type of object this
 *     service provides access to, as defined by the guacamole-ext API.
 *
 * @param <ModelType>
 *     The underlying model object used to represent InternalType in the
 *     database.
 */
public abstract class ModeledChildDirectoryObjectService<InternalType extends ModeledChildDirectoryObject<ModelType>,
        ExternalType extends Identifiable, ModelType extends ChildObjectModel>
        extends ModeledDirectoryObjectService<InternalType, ExternalType, ModelType> {

    /**
     * Returns the permission set associated with the given user and related
     * to the type of objects which can be parents of the child objects handled
     * by this directory object service, taking into account permission
     * inheritance via user groups.
     *
     * @param user
     *     The user whose permissions are being retrieved.
     *
     * @return
     *     A permission set which contains the permissions associated with the
     *     given user and related to the type of objects which can be parents
     *     of the child objects handled by this directory object service.
     *
     * @throws GuacamoleException
     *     If permission to read the user's permissions is denied.
     */
    protected abstract ObjectPermissionSet getParentEffectivePermissionSet(
            ModeledAuthenticatedUser user) throws GuacamoleException;

    /**
     * Returns the set of parent objects that are modified by the given model
     * object (by virtue of the object changing parents). If the model is not
     * changing parents, the resulting collection will be empty.
     *
     * @param user
     *     The user making the given changes to the model.
     *
     * @param identifier
     *     The identifier of the object that has been modified, if it exists.
     *     If the object is being created, this will be null.
     *
     * @param model
     *     The model that has been modified, if any. If the object is being
     *     deleted, this will be null.
     *
     * @return
     *     A collection of the identifiers of all parents that will be affected
     *     (updated) by the change.
     *
     * @throws GuacamoleException
     *     If an error occurs while determining which parents are affected.
     */
    protected Collection<String> getModifiedParents(ModeledAuthenticatedUser user,
            String identifier, ModelType model) throws GuacamoleException {

        // Get old parent identifier
        String oldParentIdentifier = null;
        if (identifier != null) {
            ModelType current = retrieveObject(user, identifier).getModel();
            oldParentIdentifier = current.getParentIdentifier();
        }

        // Get new parent identifier
        String parentIdentifier = null;
        if (model != null) {

            parentIdentifier = model.getParentIdentifier();

            // If both parents have the same identifier, nothing has changed
            if (parentIdentifier != null && parentIdentifier.equals(oldParentIdentifier))
                return Collections.<String>emptyList();

        }

        // Return collection of all non-root parents involved
        Collection<String> parents = new ArrayList<String>(2);
        if (oldParentIdentifier != null) parents.add(oldParentIdentifier);
        if (parentIdentifier    != null) parents.add(parentIdentifier);
        return parents;

    }

    /**
     * Returns whether the given user has permission to modify the parents
     * affected by the modifications made to the given model object.
     *
     * @param user
     *     The user who changed the model object.
     *
     * @param identifier
     *     The identifier of the object that has been modified, if it exists.
     *     If the object is being created, this will be null.
     *
     * @param model
     *     The model that has been modified, if any. If the object is being
     *     deleted, this will be null.
     *
     * @return
     *     true if the user has update permission for all modified parents,
     *     false otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while determining which parents are affected.
     */
    protected boolean canUpdateModifiedParents(ModeledAuthenticatedUser user,
            String identifier, ModelType model) throws GuacamoleException {

        // If user is privileged, no need to check
        if (user.isPrivileged())
            return true;
        
        // Verify that we have permission to modify any modified parents
        Collection<String> modifiedParents = getModifiedParents(user, identifier, model);
        if (!modifiedParents.isEmpty()) {

            ObjectPermissionSet permissionSet = getParentEffectivePermissionSet(user);
            Collection<String> updateableParents = permissionSet.getAccessibleObjects(
                Collections.singleton(ObjectPermission.Type.UPDATE),
                modifiedParents
            );

            return updateableParents.size() == modifiedParents.size();
            
        }

        return true;

    }

    @Override
    protected void beforeCreate(ModeledAuthenticatedUser user,
            ExternalType object, ModelType model) throws GuacamoleException {

        super.beforeCreate(user, object, model);
        
        // Validate that we can update all applicable parents
        if (!canUpdateModifiedParents(user, null, model))
            throw new GuacamoleSecurityException("Permission denied.");
        
    }

    @Override
    protected void beforeUpdate(ModeledAuthenticatedUser user,
            InternalType object, ModelType model) throws GuacamoleException {

        super.beforeUpdate(user, object, model);

        // Validate that we can update all applicable parents
        if (!canUpdateModifiedParents(user, model.getIdentifier(), model))
            throw new GuacamoleSecurityException("Permission denied.");
        
    }

    @Override
    protected void beforeDelete(ModeledAuthenticatedUser user,
            String identifier) throws GuacamoleException {

        super.beforeDelete(user, identifier);

        // Validate that we can update all applicable parents
        if (!canUpdateModifiedParents(user, identifier, null))
            throw new GuacamoleSecurityException("Permission denied.");
        
    }

}
