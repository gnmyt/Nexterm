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

package org.apache.guacamole.rest.connection;

import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;
import java.util.Map;
import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.rest.directory.DirectoryView;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;
import org.apache.guacamole.net.auth.simple.SimpleActivityRecordSet;
import org.apache.guacamole.protocol.GuacamoleConfiguration;
import org.apache.guacamole.rest.directory.DirectoryObjectResource;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;
import org.apache.guacamole.rest.directory.DirectoryResource;
import org.apache.guacamole.rest.directory.DirectoryResourceFactory;
import org.apache.guacamole.rest.history.ConnectionHistoryResource;
import org.apache.guacamole.rest.sharingprofile.APISharingProfile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A REST resource which abstracts the operations available on an existing
 * Connection.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ConnectionResource extends DirectoryObjectResource<Connection, APIConnection> {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ConnectionResource.class);

    /**
     * A factory which can be used to create instances of resources representing
     * SharingProfiles.
     */
    @Inject
    private DirectoryResourceFactory<SharingProfile, APISharingProfile>
            sharingProfileDirectoryResourceFactory;

    /**
     * Creates a new ConnectionResource which exposes the operations and
     * subresources available for the given Connection.
     *
     * @param authenticatedUser
     *     The user that is accessing this resource.
     *
     * @param userContext
     *     The UserContext associated with the given Directory.
     *
     * @param directory
     *     The Directory which contains the given Connection.
     *
     * @param connection
     *     The Connection that this ConnectionResource should represent.
     *
     * @param translator
     *     A DirectoryObjectTranslator implementation which handles the type of
     *     object given.
     */
    @AssistedInject
    public ConnectionResource(@Assisted AuthenticatedUser authenticatedUser,
            @Assisted UserContext userContext,
            @Assisted Directory<Connection> directory,
            @Assisted Connection connection,
            DirectoryObjectTranslator<Connection, APIConnection> translator) {
        super(authenticatedUser, userContext, Connection.class, directory, connection, translator);
    }

    /**
     * Retrieves the parameters associated with a single connection.
     * 
     * @return
     *     A map of parameter name/value pairs.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the connection parameters.
     */
    @GET
    @Path("parameters")
    public Map<String, String> getConnectionParameters()
            throws GuacamoleException {

        Connection connection = getInternalObject();

        // Pull effective permissions
        Permissions effective = getUserContext().self().getEffectivePermissions();

        // Retrieve permission sets
        SystemPermissionSet systemPermissions = effective.getSystemPermissions();
        ObjectPermissionSet connectionPermissions = effective.getConnectionPermissions();

        // Deny access if adminstrative or update permission is missing
        String identifier = connection.getIdentifier();
        if (!systemPermissions.hasPermission(SystemPermission.Type.ADMINISTER)
         && !connectionPermissions.hasPermission(ObjectPermission.Type.UPDATE, identifier))
            throw new GuacamoleSecurityException("Permission to read connection parameters denied.");

        // Retrieve connection configuration
        GuacamoleConfiguration config = connection.getConfiguration();

        // Return parameter map
        return config.getParameters();

    }

    /**
     * Retrieves the usage history of a single connection.
     * 
     * @return
     *     A list of connection records, describing the start and end times of
     *     various usages of this connection.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the connection history.
     */
    @SuppressWarnings("deprecation")
    @Path("history")
    public ConnectionHistoryResource getConnectionHistory()
            throws GuacamoleException {

        Connection connection = getInternalObject();

        // Try the current getConnectionHistory() method, first, for connection history.
        try {
            return new ConnectionHistoryResource(connection.getConnectionHistory()
                    .sort(ActivityRecordSet.SortableProperty.START_DATE, true));
        }
        catch (GuacamoleUnsupportedException e) {
            logger.debug("Call to getConnectionHistory() is unsupported, falling back to getHistory().", e);
        }
        
        // Fall back to the deprecated getHistory() method.
        try {
            return new ConnectionHistoryResource(new SimpleActivityRecordSet<>(connection.getHistory()));
        }
        catch (GuacamoleUnsupportedException e) {
            logger.debug("Call to getHistory() is unsupported, no connection history records will be returned.", e);
        }
        
        // If all fails, return an empty connection history set.
        return new ConnectionHistoryResource(new SimpleActivityRecordSet<>());

    }

    /**
     * Returns a resource which provides read-only access to the subset of
     * SharingProfiles that the current user can use to share this connection.
     *
     * @return
     *     A resource which provides read-only access to the subset of
     *     SharingProfiles that the current user can use to share this
     *     connection.
     *
     * @throws GuacamoleException
     *     If the SharingProfiles associated with this connection cannot be
     *     retrieved.
     */
    @Path("sharingProfiles")
    public DirectoryResource<SharingProfile, APISharingProfile>
            getSharingProfileDirectoryResource() throws GuacamoleException {

        UserContext userContext = getUserContext();
        Connection connection = getInternalObject();
                
        // Produce subset of all SharingProfiles, containing only those which
        // are associated with this connection
        Directory<SharingProfile> sharingProfiles = new DirectoryView<>(
            userContext.getSharingProfileDirectory(),
            connection.getSharingProfileIdentifiers()
        );

        // Return a new resource which provides access to only those SharingProfiles
        return sharingProfileDirectoryResourceFactory.create(getAuthenticatedUser(), userContext, sharingProfiles);

    }

}
