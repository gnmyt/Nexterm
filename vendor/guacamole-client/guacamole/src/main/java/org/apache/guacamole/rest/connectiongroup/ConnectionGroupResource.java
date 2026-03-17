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

package org.apache.guacamole.rest.connectiongroup;

import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;
import java.util.List;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.rest.directory.DirectoryObjectResource;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;

/**
 * A REST resource which abstracts the operations available on an existing
 * ConnectionGroup.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class ConnectionGroupResource
        extends DirectoryObjectResource<ConnectionGroup, APIConnectionGroup> {

    /**
     * Creates a new ConnectionGroupResource which exposes the operations and
     * subresources available for the given ConnectionGroup.
     *
     * @param authenticatedUser
     *     The user that is accessing this resource.
     *
     * @param userContext
     *     The UserContext associated with the given Directory.
     *
     * @param directory
     *     The Directory which contains the given ConnectionGroup.
     *
     * @param connectionGroup
     *     The ConnectionGroup that this ConnectionGroupResource should
     *     represent.
     *
     * @param translator
     *     A DirectoryObjectTranslator implementation which handles the type of
     *     object given.
     */
    @AssistedInject
    public ConnectionGroupResource(
            @Assisted AuthenticatedUser authenticatedUser,
            @Assisted UserContext userContext,
            @Assisted Directory<ConnectionGroup> directory,
            @Assisted ConnectionGroup connectionGroup,
            DirectoryObjectTranslator<ConnectionGroup, APIConnectionGroup> translator) {
        super(authenticatedUser, userContext, ConnectionGroup.class, directory, connectionGroup, translator);
    }

    /**
     * Returns the current connection group along with all descendants.
     *
     * @param permissions
     *     If specified and non-empty, limit the returned list to only those
     *     connections for which the current user has any of the given
     *     permissions. Otherwise, all visible connections are returned.
     *     ConnectionGroups are unaffected by this parameter.
     *
     * @return
     *     The current connection group, including all descendants.
     *
     * @throws GuacamoleException
     *     If a problem is encountered while retrieving the connection group or
     *     its descendants.
     */
    @GET
    @Path("tree")
    public APIConnectionGroup getConnectionGroupTree(
            @QueryParam("permission") List<ObjectPermission.Type> permissions)
            throws GuacamoleException {

        // Retrieve the requested tree, filtering by the given permissions
        ConnectionGroupTree tree = new ConnectionGroupTree(getUserContext(),
                getInternalObject(), permissions);

        // Return tree as a connection group
        return tree.getRootAPIConnectionGroup();

    }

}
