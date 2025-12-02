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

package org.apache.guacamole.rest.session;

import org.apache.guacamole.rest.directory.DirectoryResource;
import org.apache.guacamole.rest.directory.DirectoryResourceFactory;
import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;
import javax.inject.Inject;
import javax.ws.rs.Consumes;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.rest.activeconnection.APIActiveConnection;
import org.apache.guacamole.rest.connection.APIConnection;
import org.apache.guacamole.rest.connectiongroup.APIConnectionGroup;
import org.apache.guacamole.rest.directory.DirectoryObjectResource;
import org.apache.guacamole.rest.directory.DirectoryObjectResourceFactory;
import org.apache.guacamole.rest.history.HistoryResource;
import org.apache.guacamole.rest.schema.SchemaResource;
import org.apache.guacamole.rest.sharingprofile.APISharingProfile;
import org.apache.guacamole.rest.user.APIUser;
import org.apache.guacamole.rest.usergroup.APIUserGroup;

/**
 * A REST resource which exposes the contents of a particular UserContext.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserContextResource {

    /**
     * The UserContext being exposed through this resource.
     */
    private final UserContext userContext;

    /**
     * The user that is accessing this resource.
     */
    private final AuthenticatedUser authenticatedUser;

    /**
     * Factory for creating DirectoryObjectResources which expose a given User.
     */
    @Inject
    private DirectoryObjectResourceFactory<User, APIUser> userResourceFactory;

    /**
     * Factory for creating DirectoryResources which expose a given
     * ActiveConnection Directory.
     */
    @Inject
    private DirectoryResourceFactory<ActiveConnection, APIActiveConnection>
            activeConnectionDirectoryResourceFactory;

    /**
     * Factory for creating DirectoryResources which expose a given
     * Connection Directory.
     */
    @Inject
    private DirectoryResourceFactory<Connection, APIConnection>
            connectionDirectoryResourceFactory;

    /**
     * Factory for creating DirectoryResources which expose a given
     * ConnectionGroup Directory.
     */
    @Inject
    private DirectoryResourceFactory<ConnectionGroup, APIConnectionGroup>
            connectionGroupDirectoryResourceFactory;

    /**
     * Factory for creating DirectoryResources which expose a given
     * SharingProfile Directory.
     */
    @Inject
    private DirectoryResourceFactory<SharingProfile, APISharingProfile>
            sharingProfileDirectoryResourceFactory;

    /**
     * Factory for creating DirectoryResources which expose a given
     * User Directory.
     */
    @Inject
    private DirectoryResourceFactory<User, APIUser> userDirectoryResourceFactory;

    /**
     * Factory for creating DirectoryResources which expose a given
     * UserGroup Directory.
     */
    @Inject
    private DirectoryResourceFactory<UserGroup, APIUserGroup> userGroupDirectoryResourceFactory;

    /**
     * Creates a new UserContextResource which exposes the data within the
     * given UserContext.
     *
     * @param authenticatedUser
     *     The user that is accessing this resource.
     *
     * @param userContext
     *     The UserContext which should be exposed through this
     *     UserContextResource.
     */
    @AssistedInject
    public UserContextResource(@Assisted AuthenticatedUser authenticatedUser,
            @Assisted UserContext userContext) {
        this.authenticatedUser = authenticatedUser;
        this.userContext = userContext;
    }

    /**
     * Returns a new resource which represents the User whose access rights
     * control the operations of the UserContext exposed by this
     * UserContextResource.
     *
     * @return
     *     A new resource which represents the User whose access rights
     *     control the operations of the UserContext exposed by this
     *     UserContextResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the User.
     */
    @Path("self")
    public DirectoryObjectResource<User, APIUser> getSelfResource()
            throws GuacamoleException {
        return userResourceFactory.create(authenticatedUser, userContext,
                userContext.getUserDirectory(), userContext.self());
    }

    /**
     * Returns a new resource which represents the ActiveConnection Directory
     * contained within the UserContext exposed by this UserContextResource.
     *
     * @return
     *     A new resource which represents the ActiveConnection Directory
     *     contained within the UserContext exposed by this UserContextResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the ActiveConnection Directory.
     */
    @Path("activeConnections")
    public DirectoryResource<ActiveConnection, APIActiveConnection>
        getActiveConnectionDirectoryResource() throws GuacamoleException {
        return activeConnectionDirectoryResourceFactory.create(authenticatedUser,
                userContext, userContext.getActiveConnectionDirectory());
    }

    /**
     * Returns a new resource which represents the Connection Directory
     * contained within the UserContext exposed by this UserContextResource.
     *
     * @return
     *     A new resource which represents the Connection Directory contained
     *     within the UserContext exposed by this UserContextResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the Connection Directory.
     */
    @Path("connections")
    public DirectoryResource<Connection, APIConnection> getConnectionDirectoryResource()
            throws GuacamoleException {
        return connectionDirectoryResourceFactory.create(authenticatedUser,
                userContext, userContext.getConnectionDirectory());
    }

    /**
     * Returns a new resource which represents the ConnectionGroup Directory
     * contained within the UserContext exposed by this UserContextResource.
     *
     * @return
     *     A new resource which represents the ConnectionGroup Directory
     *     contained within the UserContext exposed by this UserContextResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the ConnectionGroup Directory.
     */
    @Path("connectionGroups")
    public DirectoryResource<ConnectionGroup, APIConnectionGroup> getConnectionGroupDirectoryResource()
            throws GuacamoleException {
        return connectionGroupDirectoryResourceFactory.create(authenticatedUser,
                userContext, userContext.getConnectionGroupDirectory());
    }

    /**
     * Returns a new resource which represents the SharingProfile Directory
     * contained within the UserContext exposed by this UserContextResource.
     *
     * @return
     *     A new resource which represents the SharingProfile Directory
     *     contained within the UserContext exposed by this UserContextResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the SharingProfile Directory.
     */
    @Path("sharingProfiles")
    public DirectoryResource<SharingProfile, APISharingProfile>
        getSharingProfileDirectoryResource() throws GuacamoleException {
        return sharingProfileDirectoryResourceFactory.create(authenticatedUser,
                userContext, userContext.getSharingProfileDirectory());
    }

    /**
     * Returns a new resource which represents the User Directory contained
     * within the UserContext exposed by this UserContextResource.
     *
     * @return
     *     A new resource which represents the User Directory contained within
     *     the UserContext exposed by this UserContextResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the User Directory.
     */
    @Path("users")
    public DirectoryResource<User, APIUser> getUserDirectoryResource()
            throws GuacamoleException {
        return userDirectoryResourceFactory.create(authenticatedUser,
                userContext, userContext.getUserDirectory());
    }

    /**
     * Returns a new resource which represents the UserGroup Directory contained
     * within the UserContext exposed by this UserContextResource.
     *
     * @return
     *     A new resource which represents the UserGroup Directory contained
     *     within the UserContext exposed by this UserContextResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the UserGroup Directory.
     */
    @Path("userGroups")
    public DirectoryResource<UserGroup, APIUserGroup> getUserGroupDirectoryResource()
            throws GuacamoleException {
        return userGroupDirectoryResourceFactory.create(authenticatedUser,
                userContext, userContext.getUserGroupDirectory());
    }

    /**
     * Returns a new resource which represents historical data contained
     * within the UserContext exposed by this UserContextResource.
     *
     * @return
     *     A new resource which represents the historical data contained within
     *     the UserContext exposed by this UserContextResource.
     */
    @Path("history")
    public HistoryResource getHistoryResource() {
        return new HistoryResource(userContext);
    }

    /**
     * Returns a new resource which represents meta information describing the
     * kind of data which within the UserContext exposed by this
     * UserContextResource.
     *
     * @return
     *     A new resource which represents the meta information describing the
     *     kind of data within the UserContext exposed by this
     *     UserContextResource.
     */
    @Path("schema")
    public SchemaResource getSchemaResource() {
        return new SchemaResource(userContext);
    }

}
