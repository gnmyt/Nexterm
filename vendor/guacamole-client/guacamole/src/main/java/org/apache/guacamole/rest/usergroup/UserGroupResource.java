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

package org.apache.guacamole.rest.usergroup;

import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;
import javax.ws.rs.Consumes;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.rest.directory.DirectoryObjectResource;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;
import org.apache.guacamole.rest.identifier.RelatedObjectSetResource;
import org.apache.guacamole.rest.permission.PermissionSetResource;

/**
 * A REST resource which abstracts the operations available on an existing
 * UserGroup.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserGroupResource
        extends DirectoryObjectResource<UserGroup, APIUserGroup> {

    /**
     * Creates a new UserGroupResource which exposes the operations and
     * subresources available for the given UserGroup.
     *
     * @param authenticatedUser
     *     The user that is accessing this resource.
     *
     * @param userContext
     *     The UserContext associated with the given Directory.
     *
     * @param directory
     *     The Directory which contains the given UserGroup.
     *
     * @param userGroup
     *     The UserGroup that this UserGroupResource should represent.
     *
     * @param translator
     *     A DirectoryObjectTranslator implementation which handles Users.
     */
    @AssistedInject
    public UserGroupResource(@Assisted AuthenticatedUser authenticatedUser,
            @Assisted UserContext userContext,
            @Assisted Directory<UserGroup> directory,
            @Assisted UserGroup userGroup,
            DirectoryObjectTranslator<UserGroup, APIUserGroup> translator) {
        super(authenticatedUser, userContext, UserGroup.class, directory, userGroup, translator);
    }

    /**
     * Returns a resource which abstracts operations available on the set of
     * user groups of which the UserGroup represented by this UserGroupResource
     * is a member.
     *
     * @return
     *     A resource which represents the set of user groups of which the
     *     UserGroup represented by this UserGroupResource is a member.
     *
     * @throws GuacamoleException
     *     If the group membership for this user group cannot be retrieved.
     */
    @Path("userGroups")
    public RelatedObjectSetResource getUserGroups() throws GuacamoleException {
        return new RelatedObjectSetResource(getInternalObject().getUserGroups());
    }

    /**
     * Returns a resource which abstracts operations available on the set of
     * users which are members of the UserGroup represented by this
     * UserGroupResource.
     *
     * @return
     *     A resource which represents the set of users which are members of
     *     the UserGroup represented by this UserGroupResource.
     *
     * @throws GuacamoleException
     *     If the members of this user group cannot be retrieved.
     */
    @Path("memberUsers")
    public RelatedObjectSetResource getMemberUsers() throws GuacamoleException {
        return new RelatedObjectSetResource(getInternalObject().getMemberUsers());
    }

    /**
     * Returns a resource which abstracts operations available on the set of
     * user groups which are members of the UserGroup represented by this
     * UserGroupResource.
     *
     * @return
     *     A resource which represents the set of user groups which are
     *     members of the UserGroup represented by this UserGroupResource.
     *
     * @throws GuacamoleException
     *     If the members of this user group cannot be retrieved.
     */
    @Path("memberUserGroups")
    public RelatedObjectSetResource getMemberUserGroups() throws GuacamoleException {
        return new RelatedObjectSetResource(getInternalObject().getMemberUserGroups());
    }

    /**
     * Returns a resource which abstracts operations available on the overall
     * permissions granted directly to the UserGroup represented by this
     * UserGroupResource.
     *
     * @return
     *     A resource which represents the permissions granted to the
     *     UserGroup represented by this UserGroupResource.
     */
    @Path("permissions")
    public PermissionSetResource getPermissions() {
        return new PermissionSetResource(getInternalObject());
    }

}
