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

package org.apache.guacamole.auth.jdbc.sharingprofile;

import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.base.ModeledDirectoryObjectMapper;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.base.ModeledChildDirectoryObjectService;
import org.apache.guacamole.auth.jdbc.permission.SharingProfilePermissionMapper;
import org.apache.guacamole.auth.jdbc.permission.ObjectPermissionMapper;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating sharing profiles.
 */
public class SharingProfileService
        extends ModeledChildDirectoryObjectService<ModeledSharingProfile,
            SharingProfile, SharingProfileModel> {

    /**
     * Mapper for accessing sharing profiles.
     */
    @Inject
    private SharingProfileMapper sharingProfileMapper;

    /**
     * Mapper for manipulating sharing profile permissions.
     */
    @Inject
    private SharingProfilePermissionMapper sharingProfilePermissionMapper;
    
    /**
     * Mapper for accessing sharing profile parameters.
     */
    @Inject
    private SharingProfileParameterMapper parameterMapper;

    /**
     * Provider for creating sharing profiles.
     */
    @Inject
    private Provider<ModeledSharingProfile> sharingProfileProvider;

    @Override
    protected ModeledDirectoryObjectMapper<SharingProfileModel> getObjectMapper() {
        return sharingProfileMapper;
    }

    @Override
    protected ObjectPermissionMapper getPermissionMapper() {
        return sharingProfilePermissionMapper;
    }

    @Override
    protected ModeledSharingProfile getObjectInstance(ModeledAuthenticatedUser currentUser,
            SharingProfileModel model) {
        ModeledSharingProfile sharingProfile = sharingProfileProvider.get();
        sharingProfile.init(currentUser, model);
        return sharingProfile;
    }

    @Override
    protected SharingProfileModel getModelInstance(ModeledAuthenticatedUser currentUser,
            final SharingProfile object) {

        // Create new ModeledSharingProfile backed by blank model
        SharingProfileModel model = new SharingProfileModel();
        ModeledSharingProfile sharingProfile = getObjectInstance(currentUser, model);

        // Set model contents through ModeledSharingProfile, copying the
        // provided sharing profile
        sharingProfile.setPrimaryConnectionIdentifier(object.getPrimaryConnectionIdentifier());
        sharingProfile.setName(object.getName());
        sharingProfile.setParameters(object.getParameters());
        sharingProfile.setAttributes(object.getAttributes());

        return model;
        
    }

    @Override
    protected boolean hasCreatePermission(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Return whether user has explicit sharing profile creation permission
        SystemPermissionSet permissionSet = user.getUser().getEffectivePermissions().getSystemPermissions();
        return permissionSet.hasPermission(SystemPermission.Type.CREATE_SHARING_PROFILE);

    }

    @Override
    protected ObjectPermissionSet getEffectivePermissionSet(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Return permissions related to sharing profiles
        return user.getUser().getEffectivePermissions().getSharingProfilePermissions();

    }

    @Override
    protected ObjectPermissionSet getParentEffectivePermissionSet(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Sharing profiles are children of connections
        return user.getUser().getEffectivePermissions().getConnectionPermissions();

    }

    @Override
    protected void beforeCreate(ModeledAuthenticatedUser user,
            SharingProfile object, SharingProfileModel model)
            throws GuacamoleException {

        super.beforeCreate(user, object, model);
        
        // Name must not be blank
        if (model.getName() == null || model.getName().trim().isEmpty())
            throw new GuacamoleClientException("Sharing profile names must not be blank.");

        // Do not attempt to create duplicate sharing profiles
        SharingProfileModel existing = sharingProfileMapper.selectOneByName(model.getParentIdentifier(), model.getName());
        if (existing != null)
            throw new GuacamoleClientException("The sharing profile \"" + model.getName() + "\" already exists.");

    }

    @Override
    protected void beforeUpdate(ModeledAuthenticatedUser user,
            ModeledSharingProfile object, SharingProfileModel model)
            throws GuacamoleException {

        super.beforeUpdate(user, object, model);
        
        // Name must not be blank
        if (model.getName() == null || model.getName().trim().isEmpty())
            throw new GuacamoleClientException("Sharing profile names must not be blank.");
        
        // Check whether such a sharing profile is already present
        SharingProfileModel existing = sharingProfileMapper.selectOneByName(model.getParentIdentifier(), model.getName());
        if (existing != null) {

            // If the specified name matches a DIFFERENT existing sharing profile, the update cannot continue
            if (!existing.getObjectID().equals(model.getObjectID()))
                throw new GuacamoleClientException("The sharing profile \"" + model.getName() + "\" already exists.");

        }

    }

    /**
     * Given an arbitrary Guacamole sharing profile, produces a collection of
     * parameter model objects containing the name/value pairs of that
     * sharing profile's parameters.
     *
     * @param sharingProfile
     *     The sharing profile whose configuration should be used to produce the
     *     collection of parameter models.
     *
     * @return
     *     A collection of parameter models containing the name/value pairs
     *     of the given sharing profile's parameters.
     */
    private Collection<SharingProfileParameterModel> getParameterModels(ModeledSharingProfile sharingProfile) {

        Map<String, String> parameters = sharingProfile.getParameters();
        
        // Convert parameters to model objects
        Collection<SharingProfileParameterModel> parameterModels = new ArrayList<SharingProfileParameterModel>(parameters.size());
        for (Map.Entry<String, String> parameterEntry : parameters.entrySet()) {

            // Get parameter name and value
            String name = parameterEntry.getKey();
            String value = parameterEntry.getValue();

            // There is no need to insert empty parameters
            if (value == null || value.isEmpty())
                continue;
            
            // Produce model object from parameter
            SharingProfileParameterModel model = new SharingProfileParameterModel();
            model.setSharingProfileIdentifier(sharingProfile.getIdentifier());
            model.setName(name);
            model.setValue(value);

            // Add model to list
            parameterModels.add(model);
            
        }

        return parameterModels;

    }

    @Override
    public ModeledSharingProfile createObject(ModeledAuthenticatedUser user, SharingProfile object)
            throws GuacamoleException {

        // Create sharing profile
        ModeledSharingProfile sharingProfile = super.createObject(user, object);
        sharingProfile.setParameters(object.getParameters());

        // Insert new parameters, if any
        Collection<SharingProfileParameterModel> parameterModels = getParameterModels(sharingProfile);
        if (!parameterModels.isEmpty())
            parameterMapper.insert(parameterModels);

        return sharingProfile;

    }
    
    @Override
    public void updateObject(ModeledAuthenticatedUser user, ModeledSharingProfile object)
            throws GuacamoleException {

        // Update sharing profile
        super.updateObject(user, object);

        // Replace existing parameters with new parameters, if any
        Collection<SharingProfileParameterModel> parameterModels = getParameterModels(object);
        parameterMapper.delete(object.getIdentifier());
        if (!parameterModels.isEmpty())
            parameterMapper.insert(parameterModels);
        
    }

    /**
     * Retrieves all parameters visible to the given user and associated with
     * the sharing profile having the given identifier. If the given user has no
     * access to such parameters, or no such sharing profile exists, the
     * returned map will be empty.
     *
     * @param user
     *     The user retrieving sharing profile parameters.
     *
     * @param identifier
     *     The identifier of the sharing profile whose parameters are being
     *     retrieved.
     *
     * @return
     *     A new map of all parameter name/value pairs that the given user has
     *     access to.
     */
    public Map<String, String> retrieveParameters(ModeledAuthenticatedUser user,
            String identifier) {

        Map<String, String> parameterMap = new HashMap<String, String>();

        // Determine whether we have permission to read parameters
        boolean canRetrieveParameters;
        try {
            canRetrieveParameters = hasObjectPermission(user, identifier,
                    ObjectPermission.Type.UPDATE);
        }

        // Provide empty (but mutable) map if unable to check permissions
        catch (GuacamoleException e) {
            return parameterMap;
        }

        // Populate parameter map if we have permission to do so
        if (canRetrieveParameters) {
            for (SharingProfileParameterModel parameter : parameterMapper.select(identifier))
                parameterMap.put(parameter.getName(), parameter.getValue());
        }

        return parameterMap;

    }

}
