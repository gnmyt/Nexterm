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

import com.google.common.collect.Lists;
import com.google.inject.Inject;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.permission.ObjectPermissionMapper;
import org.apache.guacamole.auth.jdbc.permission.ObjectPermissionModel;
import org.apache.guacamole.auth.jdbc.user.UserModel;
import org.apache.guacamole.net.auth.Identifiable;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.properties.CaseSensitivity;
import org.mybatis.guice.transactional.Transactional;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating objects within directories. This service will automatically
 * enforce the permissions of the current user.
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
public abstract class ModeledDirectoryObjectService<InternalType extends ModeledDirectoryObject<ModelType>,
        ExternalType extends Identifiable, ModelType extends ObjectModel>
    implements DirectoryObjectService<InternalType, ExternalType> {

    /**
     * All object permissions which are implicitly granted upon creation to the
     * creator of the object.
     */
    private static final ObjectPermission.Type[] IMPLICIT_OBJECT_PERMISSIONS = {
        ObjectPermission.Type.READ,
        ObjectPermission.Type.UPDATE,
        ObjectPermission.Type.DELETE,
        ObjectPermission.Type.ADMINISTER
    };
    
    /**
     * The environment of the Guacamole server.
     */
    @Inject
    private JDBCEnvironment environment;
    
    /**
     * Returns an instance of a mapper for the type of object used by this
     * service.
     *
     * @return
     *     A mapper which provides access to the model objects associated with
     *     the objects used by this service.
     */
    protected abstract ModeledDirectoryObjectMapper<ModelType> getObjectMapper();

    /**
     * Returns an instance of a mapper for the type of permissions that affect
     * the type of object used by this service.
     *
     * @return
     *     A mapper which provides access to the model objects associated with
     *     the permissions that affect the objects used by this service.
     */
    protected abstract ObjectPermissionMapper getPermissionMapper();

    /**
     * Returns an instance of an object which is backed by the given model
     * object.
     *
     * @param currentUser
     *     The user for whom this object is being created.
     *
     * @param model
     *     The model object to use to back the returned object.
     *
     * @return
     *     An object which is backed by the given model object.
     *
     * @throws GuacamoleException
     *     If the object instance cannot be created.
     */
    protected abstract InternalType getObjectInstance(ModeledAuthenticatedUser currentUser,
            ModelType model) throws GuacamoleException;
    
    /**
     * Returns the case sensitivity configuration for this service, which will
     * be used to determine whether usernames and/or group names will be treated
     * as case-sensitive.
     * 
     * @return
     *     The case sensitivity configuration for this service.
     * 
     * @throws GuacamoleException 
     *     If an error occurs retrieving relevant configuration information.
     */
    protected CaseSensitivity getCaseSensitivity() throws GuacamoleException {
        
        // Retrieve the Guacamole setting.
        return environment.getCaseSensitivity();
        
    }
    
    /**
     * Returns an instance of a model object which is based on the given
     * object.
     *
     * @param currentUser
     *     The user for whom this model object is being created.
     *
     * @param object 
     *     The object to use to produce the returned model object.
     *
     * @return
     *     A model object which is based on the given object.
     *
     * @throws GuacamoleException
     *     If the model object instance cannot be created.
     */
    protected abstract ModelType getModelInstance(ModeledAuthenticatedUser currentUser,
            ExternalType object) throws GuacamoleException;

    /**
     * Returns whether the given user has permission to create the type of
     * objects that this directory object service manages, taking into account
     * permission inheritance through user groups.
     *
     * @param user
     *     The user being checked.
     *
     * @return
     *     true if the user has object creation permission relevant to this
     *     directory object service, false otherwise.
     * 
     * @throws GuacamoleException
     *     If permission to read the user's permissions is denied.
     */
    protected abstract boolean hasCreatePermission(ModeledAuthenticatedUser user)
            throws GuacamoleException;

    /**
     * Returns whether the given user has permission to perform a certain
     * action on a specific object managed by this directory object service,
     * taking into account permission inheritance through user groups.
     *
     * @param user
     *     The user being checked.
     *
     * @param identifier
     *     The identifier of the object to check.
     *
     * @param type
     *     The type of action that will be performed.
     *
     * @return
     *     true if the user has object permission relevant described, false
     *     otherwise.
     * 
     * @throws GuacamoleException
     *     If permission to read the user's permissions is denied.
     */
    protected boolean hasObjectPermission(ModeledAuthenticatedUser user,
            String identifier, ObjectPermission.Type type)
            throws GuacamoleException {

        // Get object permissions
        ObjectPermissionSet permissionSet = getEffectivePermissionSet(user);
        
        // Return whether permission is granted
        return user.isPrivileged()
            || permissionSet.hasPermission(type, identifier);

    }
 
    /**
     * Returns the permission set associated with the given user and related
     * to the type of objects handled by this directory object service, taking
     * into account permission inheritance via user groups.
     *
     * @param user
     *     The user whose permissions are being retrieved.
     *
     * @return
     *     A permission set which contains the permissions associated with the
     *     given user and related to the type of objects handled by this
     *     directory object service.
     * 
     * @throws GuacamoleException
     *     If permission to read the user's permissions is denied.
     */
    protected abstract ObjectPermissionSet getEffectivePermissionSet(ModeledAuthenticatedUser user)
            throws GuacamoleException;

    /**
     * Returns a collection of objects which are backed by the models in the
     * given collection.
     *
     * @param currentUser
     *     The user for whom these objects are being created.
     *
     * @param models
     *     The model objects to use to back the objects within the returned
     *     collection.
     *
     * @return
     *     A collection of objects which are backed by the models in the given
     *     collection.
     *
     * @throws GuacamoleException
     *     If any of the object instances cannot be created.
     */
    protected Collection<InternalType> getObjectInstances(ModeledAuthenticatedUser currentUser,
            Collection<ModelType> models) throws GuacamoleException {

        // Create new collection of objects by manually converting each model
        Collection<InternalType> objects = new ArrayList<>(models.size());
        for (ModelType model : models)
            objects.add(getObjectInstance(currentUser, model));

        return objects;
        
    }

    /**
     * Called before any object is created through this directory object
     * service. This function serves as a final point of validation before
     * the create operation occurs. In its default implementation,
     * beforeCreate() performs basic permissions checks.
     *
     * @param user
     *     The user creating the object.
     *
     * @param object
     *     The object being created.
     *
     * @param model
     *     The model of the object being created.
     *
     * @throws GuacamoleException
     *     If the object is invalid, or an error prevents validating the given
     *     object.
     */
    protected void beforeCreate(ModeledAuthenticatedUser user,
            ExternalType object, ModelType model) throws GuacamoleException {

        // Verify permission to create objects
        if (!user.isPrivileged() && !hasCreatePermission(user))
            throw new GuacamoleSecurityException("Permission denied.");

    }

    /**
     * Called before any object is updated through this directory object
     * service. This function serves as a final point of validation before
     * the update operation occurs. In its default implementation,
     * beforeUpdate() performs basic permissions checks.
     *
     * @param user
     *     The user updating the existing object.
     *
     * @param object
     *     The object being updated.
     *
     * @param model
     *     The model of the object being updated.
     *
     * @throws GuacamoleException
     *     If the object is invalid, or an error prevents validating the given
     *     object.
     */
    protected void beforeUpdate(ModeledAuthenticatedUser user,
            InternalType object, ModelType model) throws GuacamoleException {

        // By default, do nothing.
        if (!hasObjectPermission(user, model.getIdentifier(), ObjectPermission.Type.UPDATE))
            throw new GuacamoleSecurityException("Permission denied.");

    }

    /**
     * Called before any object is deleted through this directory object
     * service. This function serves as a final point of validation before
     * the delete operation occurs. In its default implementation,
     * beforeDelete() performs basic permissions checks.
     *
     * @param user
     *     The user deleting the existing object.
     *
     * @param identifier
     *     The identifier of the object being deleted.
     *
     * @throws GuacamoleException
     *     If the object is invalid, or an error prevents validating the given
     *     object.
     */
    protected void beforeDelete(ModeledAuthenticatedUser user,
            String identifier) throws GuacamoleException {

        // Verify permission to delete objects
        if (!hasObjectPermission(user, identifier, ObjectPermission.Type.DELETE))
            throw new GuacamoleSecurityException("Permission denied.");

    }

    /**
     * Returns whether the given string is a valid identifier within the JDBC
     * authentication extension. Invalid identifiers may result in SQL errors
     * from the underlying database when used in queries.
     *
     * @param identifier
     *     The string to check for validity.
     *
     * @return
     *     true if the given string is a valid identifier, false otherwise.
     */
    protected boolean isValidIdentifier(String identifier) {

        // Empty identifiers are invalid
        if (identifier.isEmpty())
            return false;

        // Identifier is invalid if any non-numeric characters are present
        for (int i = 0; i < identifier.length(); i++) {
            if (!Character.isDigit(identifier.charAt(i)))
                return false;
        }

        // Identifier is valid - contains only numeric characters
        return true;

    }

    /**
     * Filters the given collection of strings, returning a new collection
     * containing only those strings which are valid identifiers. If no strings
     * within the collection are valid identifiers, the returned collection will
     * simply be empty.
     *
     * @param identifiers
     *     The collection of strings to filter.
     *
     * @return
     *     A new collection containing only the strings within the provided
     *     collection which are valid identifiers.
     */
    protected List<String> filterIdentifiers(Collection<String> identifiers) {

        // Obtain enough space for a full copy of the given identifiers
        List<String> validIdentifiers = new ArrayList<>(identifiers.size());

        // Add only valid identifiers to the copy
        for (String identifier : identifiers) {
            if (isValidIdentifier(identifier))
                validIdentifiers.add(identifier);
        }

        return validIdentifiers;

    }

    @Override
    public InternalType retrieveObject(ModeledAuthenticatedUser user,
            String identifier) throws GuacamoleException {

        // Pull objects having given identifier
        Collection<InternalType> objects = retrieveObjects(user, Collections.singleton(identifier));

        // If no such object, return null
        if (objects.isEmpty())
            return null;

        // The object collection will have exactly one element unless the
        // database has seriously lost integrity
        assert(objects.size() == 1);

        // Return first and only object 
        return objects.iterator().next();

    }

    @Override
    public Collection<InternalType> retrieveObjects(ModeledAuthenticatedUser user,
            Collection<String> identifiers) throws GuacamoleException {

        // Ignore invalid identifiers
        List<String> filteredIdentifiers = filterIdentifiers(identifiers);

        // Do not query if no identifiers given
        if (filteredIdentifiers.isEmpty())
            return Collections.<InternalType>emptyList();

        int batchSize = environment.getBatchSize();

        boolean userIsPrivileged = user.isPrivileged();
        
        CaseSensitivity caseSensitivity = getCaseSensitivity();

        // Process the filteredIdentifiers in batches using Lists.partition() and flatMap
        Collection<ModelType> allObjects = Lists.partition(filteredIdentifiers, batchSize).stream()
                .flatMap(chunk -> {
                    Collection<ModelType> objects;

                    // Bypass permission checks if the user is privileged
                    if (userIsPrivileged)
                        objects = getObjectMapper().select(chunk, caseSensitivity);

                    // Otherwise only return explicitly readable identifiers
                    else
                        objects = getObjectMapper().selectReadable(user.getUser().getModel(),
                                chunk, user.getEffectiveUserGroups(), caseSensitivity);

                    return objects.stream();
                })
                .collect(Collectors.toList());

        // Return collection of requested objects
        return getObjectInstances(user, allObjects);
    }

    /**
     * Returns an immutable collection of permissions that should be granted due
     * to the creation of the given object. These permissions need not be
     * granted solely to the user creating the object.
     * 
     * @param user
     *     The user creating the object.
     * 
     * @param model
     *     The object being created.
     * 
     * @return
     *     The collection of implicit permissions that should be granted due to
     *     the creation of the given object.
     */
    protected Collection<ObjectPermissionModel> getImplicitPermissions(ModeledAuthenticatedUser user,
            ModelType model) {
        
        // Check to see if the user granting permissions is a skeleton user,
        // thus lacking database backing.
        if (user.getUser().isSkeleton())
            return Collections.emptyList();
        
        // Build list of implicit permissions
        Collection<ObjectPermissionModel> implicitPermissions =
                new ArrayList<>(IMPLICIT_OBJECT_PERMISSIONS.length);

        
        UserModel userModel = user.getUser().getModel();
        for (ObjectPermission.Type permission : IMPLICIT_OBJECT_PERMISSIONS) {

            // Create model which grants this permission to the current user
            ObjectPermissionModel permissionModel = new ObjectPermissionModel();
            permissionModel.setEntityID(userModel.getEntityID());
            permissionModel.setType(permission);
            permissionModel.setObjectIdentifier(model.getIdentifier());

            // Add permission
            implicitPermissions.add(permissionModel);

        }
        
        return Collections.unmodifiableCollection(implicitPermissions);

    }

    @Override
    @Transactional
    public InternalType createObject(ModeledAuthenticatedUser user, ExternalType object)
        throws GuacamoleException {

        ModelType model = getModelInstance(user, object);
        beforeCreate(user, object, model);
        
        // Create object
        getObjectMapper().insert(model);

        // Set identifier on original object
        object.setIdentifier(model.getIdentifier());

        // Add implicit permissions
        Collection<ObjectPermissionModel> implicitPermissions = getImplicitPermissions(user, model);
        if (!implicitPermissions.isEmpty())
            getPermissionMapper().insert(implicitPermissions, getCaseSensitivity());

        // Add any arbitrary attributes
        if (model.hasArbitraryAttributes())
            getObjectMapper().insertAttributes(model);

        return getObjectInstance(user, model);

    }

    @Override
    public void deleteObject(ModeledAuthenticatedUser user, String identifier)
        throws GuacamoleException {

        beforeDelete(user, identifier);
        
        // Delete object
        getObjectMapper().delete(identifier, getCaseSensitivity());

    }

    @Override
    @Transactional
    public void updateObject(ModeledAuthenticatedUser user, InternalType object)
        throws GuacamoleException {

        ModelType model = object.getModel();
        beforeUpdate(user, object, model);
        
        // Update object
        getObjectMapper().update(model);

        // Replace any existing arbitrary attributes
        getObjectMapper().deleteAttributes(model);
        if (model.hasArbitraryAttributes())
            getObjectMapper().insertAttributes(model);

    }

    @Override
    public Set<String> getIdentifiers(ModeledAuthenticatedUser user)
        throws GuacamoleException {

        // Bypass permission checks if the user is privileged
        if (user.isPrivileged())
            return getObjectMapper().selectIdentifiers();

        // Otherwise only return explicitly readable identifiers
        else
            return getObjectMapper().selectReadableIdentifiers(
                    user.getUser().getModel(),
                    user.getEffectiveUserGroups(),
                    getCaseSensitivity()
            );

    }

}
