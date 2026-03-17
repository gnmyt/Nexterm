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

package org.apache.guacamole.auth.jdbc.connection;

import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordSearchTerm;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordSortPredicate;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.auth.jdbc.base.ModeledChildDirectoryObjectService;
import org.apache.guacamole.auth.jdbc.base.ModeledDirectoryObjectMapper;
import org.apache.guacamole.auth.jdbc.permission.ConnectionPermissionMapper;
import org.apache.guacamole.auth.jdbc.permission.ObjectPermissionMapper;
import org.apache.guacamole.auth.jdbc.tunnel.GuacamoleTunnelService;
import org.apache.guacamole.language.TranslatableGuacamoleClientOverrunException;
import org.apache.guacamole.language.TranslatableMessage;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionRecord;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating connections.
 */
public class ConnectionService extends ModeledChildDirectoryObjectService<ModeledConnection, Connection, ConnectionModel> {

    /**
     * Mapper for accessing connections.
     */
    @Inject
    private ConnectionMapper connectionMapper;

    /**
     * Mapper for manipulating connection permissions.
     */
    @Inject
    private ConnectionPermissionMapper connectionPermissionMapper;
    
    /**
     * Mapper for accessing connection parameters.
     */
    @Inject
    private ConnectionParameterMapper parameterMapper;

    /**
     * Mapper for accessing connection history.
     */
    @Inject
    private ConnectionRecordMapper connectionRecordMapper;

    /**
     * Provider for creating connections.
     */
    @Inject
    private Provider<ModeledConnection> connectionProvider;
    
    /**
     * The server environment for retrieving configuration.
     */
    @Inject
    private JDBCEnvironment environment;

    /**
     * Service for creating and tracking tunnels.
     */
    @Inject
    private GuacamoleTunnelService tunnelService;

    /**
     * Known limit for the size of the connection parameter values.
     */
    private static final int CONNECTION_PARAMETER_VALUE_LIMIT = 4096;
    
    @Override
    protected ModeledDirectoryObjectMapper<ConnectionModel> getObjectMapper() {
        return connectionMapper;
    }

    @Override
    protected ObjectPermissionMapper getPermissionMapper() {
        return connectionPermissionMapper;
    }

    @Override
    protected ModeledConnection getObjectInstance(ModeledAuthenticatedUser currentUser,
            ConnectionModel model) {
        ModeledConnection connection = connectionProvider.get();
        connection.init(currentUser, model);
        return connection;
    }

    @Override
    protected ConnectionModel getModelInstance(ModeledAuthenticatedUser currentUser,
            final Connection object) {

        // Create new ModeledConnection backed by blank model
        ConnectionModel model = new ConnectionModel();
        ModeledConnection connection = getObjectInstance(currentUser, model);

        // Set model contents through ModeledConnection, copying the provided connection
        connection.setParentIdentifier(object.getParentIdentifier());
        connection.setName(object.getName());
        connection.setConfiguration(object.getConfiguration());
        connection.setAttributes(object.getAttributes());

        return model;
        
    }

    @Override
    protected boolean hasCreatePermission(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Return whether user has explicit connection creation permission
        SystemPermissionSet permissionSet = user.getUser().getEffectivePermissions().getSystemPermissions();
        return permissionSet.hasPermission(SystemPermission.Type.CREATE_CONNECTION);

    }

    @Override
    protected ObjectPermissionSet getEffectivePermissionSet(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Return permissions related to connections 
        return user.getUser().getEffectivePermissions().getConnectionPermissions();

    }

    @Override
    protected ObjectPermissionSet getParentEffectivePermissionSet(ModeledAuthenticatedUser user)
            throws GuacamoleException {

        // Connections are contained by connection groups
        return user.getUser().getEffectivePermissions().getConnectionGroupPermissions();

    }

    /**
     * Validates that all connection parameter values are within the expected size limit.
     *
     * @param parameters
     *     The map of connection parameter name/value pairs to validate.
     *
     * @throws GuacamoleClientException
     *     If any of the parameter values exceed the defined limit.
     */
    private void validateParameters(Map<String, String> parameters) throws GuacamoleClientException {
        // Iterate through each parameter to validate its size
        for (Map.Entry<String, String> parameter : parameters.entrySet()) {
            String value = parameter.getValue();

            // Check if parameter value exceeds size limit
            if (value != null && value.length() > CONNECTION_PARAMETER_VALUE_LIMIT) {
                
                Map<String, Object> vars = new HashMap<>();
                vars.put("MAX_SIZE", CONNECTION_PARAMETER_VALUE_LIMIT);
                vars.put("PARAMETER_NAME", parameter.getKey());
                
                // Create a translatable message with the error key and substitution variables
                TranslatableMessage translatableMessage = new TranslatableMessage(
                    "CONNECTION_PARAMETERS.DATABASE_PARAMETER_VALUE_TOO_LONG",
                    vars
                );
                
                throw new TranslatableGuacamoleClientOverrunException(
                    "The value provided for connection parameter \"" + parameter.getKey() +
                    "\" exceeds the maximum allowed length.",
                    translatableMessage
                );
            }
        }
    }

    @Override
    protected void beforeCreate(ModeledAuthenticatedUser user,
            Connection object, ConnectionModel model)
            throws GuacamoleException {

        // Validate parameters before saving
        validateParameters(object.getConfiguration().getParameters());

        super.beforeCreate(user, object, model);
        
        // Name must not be blank
        if (model.getName() == null || model.getName().trim().isEmpty())
            throw new GuacamoleClientException("Connection names must not be blank.");

        // Do not attempt to create duplicate connections
        ConnectionModel existing = connectionMapper.selectOneByName(model.getParentIdentifier(), model.getName());
        if (existing != null)
            throw new GuacamoleClientException("The connection \"" + model.getName() + "\" already exists.");

    }

    @Override
    protected void beforeUpdate(ModeledAuthenticatedUser user,
            ModeledConnection object, ConnectionModel model)
            throws GuacamoleException {

        // Validate parameters before saving
        validateParameters(object.getConfiguration().getParameters());

        super.beforeUpdate(user, object, model);

        // Name must not be blank
        if (model.getName() == null || model.getName().trim().isEmpty())
            throw new GuacamoleClientException("Connection names must not be blank.");
        
        // Check whether such a connection is already present
        ConnectionModel existing = connectionMapper.selectOneByName(model.getParentIdentifier(), model.getName());
        if (existing != null) {

            // If the specified name matches a DIFFERENT existing connection, the update cannot continue
            if (!existing.getObjectID().equals(model.getObjectID()))
                throw new GuacamoleClientException("The connection \"" + model.getName() + "\" already exists.");

        }

    }

    /**
     * Given an arbitrary Guacamole connection, produces a collection of
     * parameter model objects containing the name/value pairs of that
     * connection's parameters.
     *
     * @param connection
     *     The connection whose configuration should be used to produce the
     *     collection of parameter models.
     *
     * @return
     *     A collection of parameter models containing the name/value pairs
     *     of the given connection's parameters.
     */
    private Collection<ConnectionParameterModel> getParameterModels(ModeledConnection connection) {

        Map<String, String> parameters = connection.getConfiguration().getParameters();
        
        // Convert parameters to model objects
        Collection<ConnectionParameterModel> parameterModels = new ArrayList<>(parameters.size());
        for (Map.Entry<String, String> parameterEntry : parameters.entrySet()) {

            // Get parameter name and value
            String name = parameterEntry.getKey();
            String value = parameterEntry.getValue();

            // There is no need to insert empty parameters
            if (value == null || value.isEmpty())
                continue;
            
            // Produce model object from parameter
            ConnectionParameterModel model = new ConnectionParameterModel();
            model.setConnectionIdentifier(connection.getIdentifier());
            model.setName(name);
            model.setValue(value);

            // Add model to list
            parameterModels.add(model);
            
        }

        return parameterModels;

    }

    @Override
    public ModeledConnection createObject(ModeledAuthenticatedUser user, Connection object)
            throws GuacamoleException {

        // Create connection
        ModeledConnection connection = super.createObject(user, object);
        connection.setConfiguration(object.getConfiguration());

        // Insert new parameters, if any
        Collection<ConnectionParameterModel> parameterModels = getParameterModels(connection);
        if (!parameterModels.isEmpty())
            parameterMapper.insert(parameterModels);

        return connection;

    }
    
    @Override
    public void updateObject(ModeledAuthenticatedUser user, ModeledConnection object)
            throws GuacamoleException {

        // Update connection
        super.updateObject(user, object);

        // Replace existing parameters with new parameters, if any
        Collection<ConnectionParameterModel> parameterModels = getParameterModels(object);
        parameterMapper.delete(object.getIdentifier());
        if (!parameterModels.isEmpty())
            parameterMapper.insert(parameterModels);
        
    }

    /**
     * Returns the set of all identifiers for all connections within the
     * connection group having the given identifier. Only connections that the
     * user has read access to will be returned.
     * 
     * Permission to read the connection group having the given identifier is
     * NOT checked.
     *
     * @param user
     *     The user retrieving the identifiers.
     * 
     * @param identifier
     *     The identifier of the parent connection group, or null to check the
     *     root connection group.
     *
     * @return
     *     The set of all identifiers for all connections in the connection
     *     group having the given identifier that the user has read access to.
     *
     * @throws GuacamoleException
     *     If an error occurs while reading identifiers.
     */
    public Set<String> getIdentifiersWithin(ModeledAuthenticatedUser user,
            String identifier)
            throws GuacamoleException {

        // Bypass permission checks if the user is privileged
        if (user.isPrivileged())
            return connectionMapper.selectIdentifiersWithin(identifier);

        // Otherwise only return explicitly readable identifiers
        else
            return connectionMapper.selectReadableIdentifiersWithin(
                    user.getUser().getModel(), identifier,
                    user.getEffectiveUserGroups(),
                    getCaseSensitivity());

    }

    /**
     * Retrieves all parameters visible to the given user and associated with
     * the connection having the given identifier. If the given user has no
     * access to such parameters, or no such connection exists, the returned
     * map will be empty.
     *
     * @param user
     *     The user retrieving connection parameters.
     *
     * @param identifier
     *     The identifier of the connection whose parameters are being
     *     retrieved.
     *
     * @return
     *     A new map of all parameter name/value pairs that the given user has
     *     access to.
     */
    public Map<String, String> retrieveParameters(ModeledAuthenticatedUser user,
            String identifier) {

        Map<String, String> parameterMap = new HashMap<>();

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
            for (ConnectionParameterModel parameter : parameterMapper.select(identifier))
                parameterMap.put(parameter.getName(), parameter.getValue());
        }

        return parameterMap;

    }

    /**
     * Returns a connection records object which is backed by the given model.
     *
     * @param model
     *     The model object to use to back the returned connection record
     *     object.
     *
     * @return
     *     A connection record object which is backed by the given model.
     */
    protected ConnectionRecord getObjectInstance(ConnectionRecordModel model) {
        return new ModeledConnectionRecord(model);
    }

    /**
     * Returns a list of connection records objects which are backed by the
     * models in the given list.
     *
     * @param models
     *     The model objects to use to back the connection record objects
     *     within the returned list.
     *
     * @return
     *     A list of connection record objects which are backed by the models
     *     in the given list.
     */
    protected List<ConnectionRecord> getObjectInstances(List<ConnectionRecordModel> models) {

        // Create new list of records by manually converting each model
        List<ConnectionRecord> objects = new ArrayList<>(models.size());
        for (ConnectionRecordModel model : models)
            objects.add(getObjectInstance(model));

        return objects;
 
    }

    /**
     * Retrieves the connection history records matching the given criteria.
     * Retrieves up to <code>limit</code> connection history records matching
     * the given terms and sorted by the given predicates. Only history records
     * associated with data that the given user can read are returned.
     *
     * @param identifier
     *     The optional connection identifier for which history records should
     *     be retrieved, or null if all readable records should be retrieved.
     * 
     * @param user
     *     The user retrieving the connection history.
     *
     * @param recordIdentifier
     *     The identifier of the specific history record to retrieve, if not
     *     all matching records. Search terms, etc. will still be applied to
     *     the single record.
     *
     * @param requiredContents
     *     The search terms that must be contained somewhere within each of the
     *     returned records.
     *
     * @param sortPredicates
     *     A list of predicates to sort the returned records by, in order of
     *     priority.
     *
     * @param limit
     *     The maximum number of records that should be returned.
     *
     * @return
     *     The connection history of the given connection, including any
     *     active connections.
     *
     * @throws GuacamoleException
     *     If permission to read the connection history is denied.
     */
    public List<ConnectionRecord> retrieveHistory(String identifier,
            ModeledAuthenticatedUser user, String recordIdentifier,
            Collection<ActivityRecordSearchTerm> requiredContents,
            List<ActivityRecordSortPredicate> sortPredicates, int limit)
            throws GuacamoleException {

        List<ConnectionRecordModel> searchResults;

        // Bypass permission checks if the user is privileged or has System-level audit permissions
        if (user.isPrivileged() || user.getUser().getEffectivePermissions().getSystemPermissions().hasPermission(SystemPermission.Type.AUDIT))
            searchResults = connectionRecordMapper.search(identifier,
                    recordIdentifier, requiredContents, sortPredicates, limit,
                    getCaseSensitivity());

        // Otherwise only return explicitly readable history records
        else
            searchResults = connectionRecordMapper.searchReadable(identifier,
                    user.getUser().getModel(), recordIdentifier,
                    requiredContents, sortPredicates, limit,
                    user.getEffectiveUserGroups(),
                    getCaseSensitivity());

        return getObjectInstances(searchResults);

    }

    /**
     * Connects to the given connection as the given user, using the given
     * client information. If the user does not have permission to read the
     * connection, permission will be denied.
     *
     * @param user
     *     The user connecting to the connection.
     *
     * @param connection
     *     The connection being connected to.
     *
     * @param info
     *     Information associated with the connecting client.
     *
     * @param tokens
     *     A Map containing the token names and corresponding values to be
     *     applied as parameter tokens when establishing the connection.
     *
     * @return
     *     A connected GuacamoleTunnel associated with a newly-established
     *     connection.
     *
     * @throws GuacamoleException
     *     If permission to connect to this connection is denied.
     */
    public GuacamoleTunnel connect(ModeledAuthenticatedUser user,
            ModeledConnection connection, GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {

        // Connect only if READ permission is granted
        if (hasObjectPermission(user, connection.getIdentifier(), ObjectPermission.Type.READ))
            return tunnelService.getGuacamoleTunnel(user, connection, info, tokens);

        // The user does not have permission to connect
        throw new GuacamoleSecurityException("Permission denied.");

    }
    
}
