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

package org.apache.guacamole.rest.activeconnection;

import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;
import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.PathParam;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.rest.connection.APIConnection;
import org.apache.guacamole.rest.directory.DirectoryObjectResource;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;
import org.apache.guacamole.rest.directory.DirectoryResourceFactory;

/**
 * A REST resource which abstracts the operations available on an existing
 * ActiveConnection.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ActiveConnectionResource
        extends DirectoryObjectResource<ActiveConnection, APIActiveConnection> {

    /**
     * A factory which can be used to create instances of resources representing
     * Connection.
     */
    @Inject
    private DirectoryResourceFactory<Connection, APIConnection>
            connectionDirectoryResourceFactory;

    /**
     * Creates a new ActiveConnectionResource which exposes the operations and
     * subresources available for the given ActiveConnection.
     *
     * @param authenticatedUser
     *     The user that is accessing this resource.
     *
     * @param userContext
     *     The UserContext associated with the given Directory.
     *
     * @param directory
     *     The Directory which contains the given ActiveConnection.
     *
     * @param activeConnection
     *     The ActiveConnection that this ActiveConnectionResource should
     *     represent.
     *
     * @param translator
     *     A DirectoryObjectTranslator implementation which handles
     *     ActiveConnections.
     */
    @AssistedInject
    public ActiveConnectionResource(@Assisted AuthenticatedUser authenticatedUser,
            @Assisted UserContext userContext,
            @Assisted Directory<ActiveConnection> directory,
            @Assisted ActiveConnection activeConnection,
            DirectoryObjectTranslator<ActiveConnection, APIActiveConnection> translator) {
        super(authenticatedUser, userContext, ActiveConnection.class, directory, activeConnection, translator);
    }

    /**
     * Retrieves a resource representing the Connection object that is being
     * actively used.
     *
     * @return
     *     A resource representing the Connection object that is being actively
     *     used.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the Connection.
     */
    @Path("connection")
    public DirectoryObjectResource<Connection, APIConnection> getConnection()
            throws GuacamoleException {

        UserContext userContext = getUserContext();
        ActiveConnection activeConnection = getInternalObject();
        
        // Return the underlying connection as a resource
        return connectionDirectoryResourceFactory
                .create(getAuthenticatedUser(), userContext, userContext.getConnectionDirectory())
                .getObjectResource(activeConnection.getConnectionIdentifier());

    }

    /**
     * Retrieves a set of credentials which can be POSTed by another user to the
     * "/api/tokens" endpoint to obtain access strictly to this connection. The
     * retrieved credentials may be purpose-generated and temporary.
     *
     * @param sharingProfileIdentifier The identifier of the sharing connection
     * defining the semantics of the shared session.
     *
     * @return The set of credentials which should be used to access strictly
     * this connection.
     *
     * @throws GuacamoleException If an error occurs while retrieving the
     * sharing credentials for this connection.
     */
    @GET
    @Path("sharingCredentials/{sharingProfile}")
    public APIUserCredentials getSharingCredentials(
            @PathParam("sharingProfile") String sharingProfileIdentifier)
            throws GuacamoleException {

        // Generate and return sharing credentials for the active connection
        return new APIUserCredentials(getInternalObject().getSharingCredentials(sharingProfileIdentifier));

    }

}
