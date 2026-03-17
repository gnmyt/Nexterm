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

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Consumer;

import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.base.EntityModel;
import org.apache.guacamole.auth.jdbc.base.ModeledPermissions;
import org.apache.guacamole.net.auth.permission.Permission;
import org.apache.guacamole.net.auth.permission.PermissionSet;

import com.google.common.collect.Iterables;
import com.google.inject.Inject;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * deleting permissions within a backend database model, and for obtaining the
 * permission sets that contain these permissions. This service will
 * automatically enforce the permissions of the current user.
 *
 * @param <PermissionSetType>
 *     The type of permission sets this service provides access to.
 *
 * @param <PermissionType>
 *     The type of permission this service provides access to.
 *
 * @param <ModelType>
 *     The underlying model object used to represent PermissionType in the
 *     database.
 */
public abstract class ModeledPermissionService<PermissionSetType extends PermissionSet<PermissionType>,
        PermissionType extends Permission, ModelType>
    extends AbstractPermissionService<PermissionSetType, PermissionType> {

    /**
     * The environment of the Guacamole server.
     */
    @Inject
    private JDBCEnvironment environment;

    /**
     * Returns an instance of a mapper for the type of permission used by this
     * service.
     *
     * @return
     *     A mapper which provides access to the model objects associated with
     *     the permissions used by this service.
     */
    protected abstract PermissionMapper<ModelType> getPermissionMapper();

    /**
     * Returns an instance of a permission which is based on the given model
     * object.
     *
     * @param model
     *     The model object to use to produce the returned permission.
     *
     * @return
     *     A permission which is based on the given model object.
     */
    protected abstract PermissionType getPermissionInstance(ModelType model);

    /**
     * Returns a collection of permissions which are based on the models in
     * the given collection.
     *
     * @param models
     *     The model objects to use to produce the permissions within the
     *     returned set.
     *
     * @return
     *     A set of permissions which are based on the models in the given
     *     collection.
     */
    protected Set<PermissionType> getPermissionInstances(Collection<ModelType> models) {

        // Create new collection of permissions by manually converting each model
        Set<PermissionType> permissions = new HashSet<PermissionType>(models.size());
        for (ModelType model : models)
            permissions.add(getPermissionInstance(model));

        return permissions;

    }

    /**
     * Returns an instance of a model object which is based on the given
     * permission and target entity.
     *
     * @param targetEntity
     *     The entity to whom this permission is granted.
     *
     * @param permission
     *     The permission to use to produce the returned model object.
     *
     * @return
     *     A model object which is based on the given permission and target
     *     entity.
     */
    protected abstract ModelType getModelInstance(
            ModeledPermissions<? extends EntityModel> targetEntity,
            PermissionType permission);

    /**
     * Returns a collection of model objects which are based on the given
     * permissions and target entity.
     *
     * @param targetEntity
     *     The entity to whom this permission is granted.
     *
     * @param permissions
     *     The permissions to use to produce the returned model objects.
     *
     * @return
     *     A collection of model objects which are based on the given
     *     permissions and target entity.
     */
    protected Collection<ModelType> getModelInstances(
            ModeledPermissions<? extends EntityModel> targetEntity,
            Collection<PermissionType> permissions) {

        // Create new collection of models by manually converting each permission
        Collection<ModelType> models = new ArrayList<ModelType>(permissions.size());
        for (PermissionType permission : permissions)
            models.add(getModelInstance(targetEntity, permission));

        return models;

    }

    /**
     * Runs the provided consumer function on subsets of the original collection
     * of objects, with each subset being no larger than the maximum batch size
     * configured for the JDBC environment. Any permission update that involves
     * passing potentially-large lists of models to a mapper should use this
     * method to perform the update to ensure that the maximum number of
     * parameters for an individual query is not exceeded.
     *
     * @param <T>
     *     The type of object stored in the provided objects list, and consumed
     *     by the provided consumer.
     *
     * @param objects
     *     A collection of objects to be partitioned.
     *
     * @param consumer
     *     A function that will consume subsets of the objects from the provided
     *     collection of objects, performing any update as needed.
     *
     * @throws GuacamoleException
     *     If the batch size cannot be determined for the JDBC environment.
     */
    protected <T> void batchPermissionUpdates(
            Collection<T> objects, Consumer<Collection<T>> consumer)
            throws GuacamoleException {

        // Split the original collection into views, each no larger than the
        // configured batch size, and call the collector function with each
        Iterables.partition(objects, environment.getBatchSize())
                .forEach(batch -> consumer.accept(batch));
    }

    @Override
    public Set<PermissionType> retrievePermissions(ModeledAuthenticatedUser user,
            ModeledPermissions<? extends EntityModel> targetEntity,
            Set<String> effectiveGroups) throws GuacamoleException {

        // Retrieve permissions only if allowed
        if (canReadPermissions(user, targetEntity))
            return getPermissionInstances(getPermissionMapper().select(
                    targetEntity.getModel(),
                    effectiveGroups,
                    getCaseSensitivity()));

        // User cannot read this entity's permissions
        throw new GuacamoleSecurityException("Permission denied.");

    }

}
