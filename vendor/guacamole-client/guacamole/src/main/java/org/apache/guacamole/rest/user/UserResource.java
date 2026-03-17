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

package org.apache.guacamole.rest.user;

import com.google.inject.assistedinject.Assisted;
import com.google.inject.assistedinject.AssistedInject;

import javax.servlet.http.HttpServletRequest;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.credentials.GuacamoleCredentialsException;
import org.apache.guacamole.net.auth.simple.SimpleActivityRecordSet;
import org.apache.guacamole.net.event.DirectoryEvent;
import org.apache.guacamole.rest.directory.DirectoryObjectResource;
import org.apache.guacamole.rest.directory.DirectoryObjectTranslator;
import org.apache.guacamole.rest.history.UserHistoryResource;
import org.apache.guacamole.rest.identifier.RelatedObjectSetResource;
import org.apache.guacamole.rest.permission.APIPermissionSet;
import org.apache.guacamole.rest.permission.PermissionSetResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A REST resource which abstracts the operations available on an existing
 * User.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserResource
        extends DirectoryObjectResource<User, APIUser> {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(UserResource.class);
    
    /**
     * Creates a new UserResource which exposes the operations and subresources
     * available for the given User.
     *
     * @param authenticatedUser
     *     The user that is accessing this resource.
     *
     * @param userContext
     *     The UserContext associated with the given Directory.
     *
     * @param directory
     *     The Directory which contains the given User.
     *
     * @param user
     *     The User that this UserResource should represent.
     *
     * @param translator
     *     A DirectoryObjectTranslator implementation which handles Users.
     */
    @AssistedInject
    public UserResource(@Assisted AuthenticatedUser authenticatedUser,
            @Assisted UserContext userContext,
            @Assisted Directory<User> directory,
            @Assisted User user,
            DirectoryObjectTranslator<User, APIUser> translator) {
        super(authenticatedUser, userContext, User.class, directory, user, translator);
    }

    /**
     * Retrieves the login (session) history of a single user.
     *
     * @return
     *     A list of activity records, describing the start and end times of
     *     this user's sessions.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the user history.
     */
    @SuppressWarnings("deprecation")
    @Path("history")
    public UserHistoryResource getUserHistory()
            throws GuacamoleException {

        User user = getInternalObject();

        // First try to retrieve history using the current getUserHistory() method.
        try {
            return new UserHistoryResource(user.getUserHistory());
        }
        catch (GuacamoleUnsupportedException e) {
            logger.debug("Call to getUserHistory() is unsupported, falling back to deprecated method getHistory().", e);
        }
        
        // Fall back to deprecated getHistory() method.
        try {
            return new UserHistoryResource(new SimpleActivityRecordSet<>(user.getHistory()));
        }
        catch (GuacamoleUnsupportedException e) {
            logger.debug("Call to getHistory() is unsupported, no user history records will be returned.", e);
        }
        
        // If both are unimplemented, return an empty history set.
        return new UserHistoryResource(new SimpleActivityRecordSet<>());

    }

    @Override
    public void updateObject(APIUser modifiedObject) throws GuacamoleException {

        // A user may not use this endpoint to update their password
        try {
            User currentUser = getUserContext().self();
            if (
                    currentUser.getIdentifier().equals(modifiedObject.getUsername())
                    && modifiedObject.getPassword() != null) {
                throw new GuacamoleSecurityException(
                        "Permission denied. The password update endpoint must"
                        + " be used to change the current user's password.");
            }
        }
        catch (GuacamoleException | RuntimeException | Error e) {
            fireDirectoryFailureEvent(DirectoryEvent.Operation.UPDATE, e);
            throw e;
        }

        super.updateObject(modifiedObject);

    }

    /**
     * Updates the password for an individual existing user.
     *
     * @param userPasswordUpdate
     *     The object containing the old password for the user, as well as the
     *     new password to set for that user.
     *
     * @param request
     *     The HttpServletRequest associated with the password update attempt.
     *
     * @throws GuacamoleException
     *     If an error occurs while updating the user's password.
     */
    @PUT
    @Path("password")
    public void updatePassword(APIUserPasswordUpdate userPasswordUpdate,
            @Context HttpServletRequest request) throws GuacamoleException {

        User user = getInternalObject();

        // Build credentials
        Credentials credentials = new Credentials(user.getIdentifier(),
                userPasswordUpdate.getOldPassword(), request);

        // Verify that the old password was correct
        try {
            AuthenticationProvider authProvider = getUserContext().getAuthenticationProvider();
            if (authProvider.authenticateUser(credentials) == null)
                throw new GuacamoleSecurityException("Permission denied.");
        }

        // Pass through any credentials exceptions as simple permission denied
        catch (GuacamoleCredentialsException e) {
            throw new GuacamoleSecurityException("Permission denied.");
        }

        // Set password to the newly provided one
        try {
            user.setPassword(userPasswordUpdate.getNewPassword());
            getDirectory().update(user);
            fireDirectorySuccessEvent(DirectoryEvent.Operation.UPDATE);
        }
        catch (GuacamoleException | RuntimeException | Error e) {
            fireDirectoryFailureEvent(DirectoryEvent.Operation.UPDATE, e);
            throw e;
        }

    }

    /**
     * Returns a resource which abstracts operations available on the overall
     * permissions granted directly to the User represented by this
     * UserResource.
     *
     * @return
     *     A resource which representing the permissions granted to the User
     *     represented by this UserResource.
     */
    @Path("permissions")
    public PermissionSetResource getPermissions() {
        return new PermissionSetResource(getInternalObject());
    }

    /**
     * Returns a read-only view of the permissions effectively granted to this
     * user, including permissions which may be inherited or implied.
     *
     * @return
     *     A read-only view of the permissions effectively granted to this
     *     user.
     *
     * @throws GuacamoleException
     *     If the effective permissions for this user cannot be retrieved.
     */
    @GET
    @Path("effectivePermissions")
    public APIPermissionSet getEffectivePermissions() throws GuacamoleException {
        return new APIPermissionSet(getInternalObject().getEffectivePermissions());
    }

    /**
     * Returns a resource which abstracts operations available on the set of
     * user groups of which the User represented by this UserResource is a
     * member.
     *
     * @return
     *     A resource which represents the set of user groups of which the
     *     User represented by this UserResource is a member.
     *
     * @throws GuacamoleException
     *     If the group membership for this user cannot be retrieved.
     */
    @Path("userGroups")
    public RelatedObjectSetResource getUserGroups() throws GuacamoleException {
        return new RelatedObjectSetResource(getInternalObject().getUserGroups());
    }

}
