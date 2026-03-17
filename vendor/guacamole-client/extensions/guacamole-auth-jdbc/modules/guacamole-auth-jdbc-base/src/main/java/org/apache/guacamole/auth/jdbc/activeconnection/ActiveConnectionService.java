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

package org.apache.guacamole.auth.jdbc.activeconnection;

import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.auth.jdbc.user.ModeledAuthenticatedUser;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.auth.jdbc.base.DirectoryObjectService;
import org.apache.guacamole.auth.jdbc.tunnel.ActiveConnectionRecord;
import org.apache.guacamole.auth.jdbc.tunnel.GuacamoleTunnelService;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;

/**
 * Service which provides convenience methods for creating, retrieving, and
 * manipulating active connections.
 */
public class ActiveConnectionService
    implements DirectoryObjectService<TrackedActiveConnection, ActiveConnection> { 

    /**
     * Service for creating and tracking tunnels.
     */
    @Inject
    private GuacamoleTunnelService tunnelService;

    /**
     * Provider for active connections.
     */
    @Inject
    private Provider<TrackedActiveConnection> trackedActiveConnectionProvider;
    
    @Override
    public TrackedActiveConnection retrieveObject(ModeledAuthenticatedUser user,
            String identifier) throws GuacamoleException {

        // Pull objects having given identifier
        Collection<TrackedActiveConnection> objects = retrieveObjects(user, Collections.singleton(identifier));

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
    public Collection<TrackedActiveConnection> retrieveObjects(ModeledAuthenticatedUser user,
            Collection<String> identifiers) throws GuacamoleException {

        String username = user.getIdentifier();
        boolean isPrivileged = user.isPrivileged();
        Set<String> identifierSet = new HashSet<String>(identifiers);

        // Retrieve all visible connections (permissions enforced by tunnel service)
        Collection<ActiveConnectionRecord> records = tunnelService.getActiveConnections(user);

        // Restrict to subset of records which match given identifiers
        Collection<TrackedActiveConnection> activeConnections = new ArrayList<TrackedActiveConnection>(identifiers.size());
        for (ActiveConnectionRecord record : records) {

            // The current user should have access to sensitive information and
            // be able to connect to (join) the active connection if they are
            // the user that started the connection OR the user is an admin
            boolean hasPrivilegedAccess =
                    isPrivileged || username.equals(record.getUsername());

            // Add connection if within requested identifiers
            if (identifierSet.contains(record.getUUID().toString())) {
                TrackedActiveConnection activeConnection = trackedActiveConnectionProvider.get();
                activeConnection.init(user, record, hasPrivilegedAccess, hasPrivilegedAccess);
                activeConnections.add(activeConnection);
            }

        }

        return activeConnections;
        
    }

    @Override
    public void deleteObject(ModeledAuthenticatedUser user, String identifier)
        throws GuacamoleException {

        // Close connection, if it exists and we have permission
        ActiveConnection activeConnection = retrieveObject(user, identifier);
        if (activeConnection == null)
            return;
        
        if (hasObjectPermissions(user, identifier, ObjectPermission.Type.DELETE)) {

            // Close connection if not already closed
            GuacamoleTunnel tunnel = activeConnection.getTunnel();
            if (tunnel != null && tunnel.isOpen())
                tunnel.close();

        }
        else
            throw new GuacamoleSecurityException("Permission denied.");
        
    }

    @Override
    public Set<String> getIdentifiers(ModeledAuthenticatedUser user)
        throws GuacamoleException {

        // Retrieve all visible connections (permissions enforced by tunnel service)
        Collection<ActiveConnectionRecord> records = tunnelService.getActiveConnections(user);

        // Build list of identifiers
        Set<String> identifiers = new HashSet<String>(records.size());
        for (ActiveConnectionRecord record : records)
            identifiers.add(record.getUUID().toString());

        return identifiers;
        
    }

    @Override
    public TrackedActiveConnection createObject(ModeledAuthenticatedUser user,
            ActiveConnection object) throws GuacamoleException {

        // Updating active connections is not implemented
        throw new GuacamoleSecurityException("Permission denied.");

    }

    @Override
    public void updateObject(ModeledAuthenticatedUser user, TrackedActiveConnection object)
            throws GuacamoleException {

        // Updating active connections is not implemented
        throw new GuacamoleSecurityException("Permission denied.");

    }

    /**
     * Retrieve the permission set for the specified user that relates
     * to access to active connections.
     * 
     * @param user
     *     The user for which to retrieve the permission set.
     * 
     * @return
     *     A permission set associated with the given user that specifies
     *     the permissions available for active connection objects.
     * 
     * @throws GuacamoleException
     *     If permission to read permissions for the user is denied.
     */
    private ObjectPermissionSet getPermissionSet(ModeledAuthenticatedUser user) 
            throws GuacamoleException {
        return user.getUser().getActiveConnectionPermissions();
    }

    /**
     * Return a boolean value representing whether or not a user has the given
     * permission available to them on the active connection with the given
     * identifier.
     * 
     * @param user
     *     The user for which the permissions are being queried.
     * 
     * @param identifier
     *     The identifier of the active connection we are wondering about.
     * 
     * @param type
     *     The type of permission being requested.
     * 
     * @return
     *     True if the user has the necessary permission; otherwise false.
     * 
     * @throws GuacamoleException 
     *     If the user does not have access to read permissions.
     */
    private boolean hasObjectPermissions(ModeledAuthenticatedUser user,
            String identifier, ObjectPermission.Type type)
            throws GuacamoleException {
        
        ObjectPermissionSet permissionSet = getPermissionSet(user);
        
        return user.isPrivileged()
                || permissionSet.hasPermission(type, identifier);
        
    }

}
