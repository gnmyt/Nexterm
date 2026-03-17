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

package org.apache.guacamole.auth.jdbc.user;

import com.google.common.collect.Sets;
import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;

/**
 * Associates a user with the credentials they used to authenticate, their
 * corresponding ModeledUser, and the AuthenticationProvider which produced
 * that ModeledUser.
 */
public class ModeledAuthenticatedUser extends RemoteAuthenticatedUser {

    /**
     * The ModeledUser object which is backed by the data associated with this
     * user in the database.
     */
    private final ModeledUser user;

    /**
     * The AuthenticationProvider that is associated with this user's
     * corresponding ModeledUser.
     */
    private final AuthenticationProvider modelAuthenticationProvider;

    /**
     * The connections which have been committed for use by this user in the
     * context of a balancing connection group. Balancing connection groups
     * will preferentially choose connections within this set, unless those
     * connections are not children of the group in question. If a group DOES
     * have at least one child connection within this set, no connections that
     * are not in this set will be used.
     */
    private final Set<String> preferredConnections =
            Collections.newSetFromMap(new ConcurrentHashMap<String, Boolean>());

    /**
     * Creates a copy of the given AuthenticatedUser which is associated with
     * the data stored in the provided ModeledUser. The AuthenticatedUser need
     * not have come from the same AuthenticationProvider which produced the
     * given ModeledUser.
     *
     * @param authenticatedUser
     *     An existing AuthenticatedUser representing the user that
     *     authenticated.
     *
     * @param modelAuthenticationProvider
     *     The AuthenticationProvider that is associated with the given user's
     *     corresponding ModeledUser.
     *
     * @param user
     *     A ModeledUser object which is backed by the data associated with
     *     this user in the database.
     */
    public ModeledAuthenticatedUser(AuthenticatedUser authenticatedUser,
            AuthenticationProvider modelAuthenticationProvider, ModeledUser user) {
        super(authenticatedUser.getAuthenticationProvider(), authenticatedUser.getCredentials(), authenticatedUser.getEffectiveUserGroups());
        this.modelAuthenticationProvider = modelAuthenticationProvider;
        this.user = user;
    }

    /**
     * Creates a new AuthenticatedUser associating the given user with their
     * corresponding credentials.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider that has authenticated the given user
     *     and which produced the given ModeledUser.
     *
     * @param user
     *     A ModeledUser object which is backed by the data associated with
     *     this user in the database.
     *
     * @param credentials
     *     The credentials given by the user when they authenticated.
     */
    public ModeledAuthenticatedUser(AuthenticationProvider authenticationProvider,
            ModeledUser user, Credentials credentials) {
        super(authenticationProvider, credentials, user.getEffectiveUserGroups());
        this.modelAuthenticationProvider = authenticationProvider;
        this.user = user;
    }

    /**
     * Returns a ModeledUser object which is backed by the data associated with
     * this user within the database.
     *
     * @return
     *     A ModeledUser object which is backed by the data associated with
     *     this user in the database.
     */
    public ModeledUser getUser() {
        return user;
    }

    /**
     * Returns the AuthenticationProvider which produced the ModeledUser
     * retrievable via getUser(). This is not necessarily the same as the
     * AuthenticationProvider which authenticated that user, which can be
     * retrieved with getAuthenticationProvider().
     *
     * @return
     *     The AuthenticationProvider which produced the ModeledUser
     *     retrievable via getUser().
     */
    public AuthenticationProvider getModelAuthenticationProvider() {
        return modelAuthenticationProvider;
    }

    /**
     * Returns whether the connection having the given identifier has been
     * marked as preferred for this user's current Guacamole session. A
     * preferred connection is always chosen in favor of other connections when
     * it is a child of a balancing connection group.
     *
     * @param identifier
     *     The identifier of the connection to test.
     *
     * @return
     *     true if the connection having the given identifier has been marked
     *     as preferred, false otherwise.
     */
    public boolean isPreferredConnection(String identifier) {
        return preferredConnections.contains(identifier);
    }

    /**
     * Marks the connection having the given identifier as preferred for this
     * user's current Guacamole session. A preferred connection is always chosen
     * in favor of other connections when it is a child of a balancing
     * connection group.
     *
     * @param identifier
     *     The identifier of the connection to prefer.
     */
    public void preferConnection(String identifier) {
        preferredConnections.add(identifier);
    }

    @Override
    public String getIdentifier() {
        return user.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        user.setIdentifier(identifier);
    }
    
    @Override
    public Set<String> getEffectiveUserGroups() {
        return Sets.union(user.getEffectiveUserGroups(),
                super.getEffectiveUserGroups());
    }

    /**
     * Returns whether this user is effectively unrestricted by permissions,
     * such as a system administrator or an internal user operating via a
     * privileged UserContext. Permission inheritance via user groups is taken
     * into account.
     *
     * @return
     *     true if this user should be unrestricted by permissions, false
     *     otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while determining whether permission restrictions
     *     apply to the user.
     */
    public boolean isPrivileged() throws GuacamoleException {
        return getUser().isPrivileged();
    }
    
}
