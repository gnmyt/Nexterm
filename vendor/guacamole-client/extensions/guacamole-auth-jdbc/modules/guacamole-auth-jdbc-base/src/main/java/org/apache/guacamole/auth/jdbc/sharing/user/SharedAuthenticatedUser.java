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

package org.apache.guacamole.auth.jdbc.sharing.user;

import java.util.Collections;
import org.apache.guacamole.auth.jdbc.user.RemoteAuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;

/**
 * Associates a user with the credentials they used to authenticate, including
 * any provided share key.
 */
public class SharedAuthenticatedUser extends RemoteAuthenticatedUser {

    /**
     * The username of this user.
     */
    private final String identifier;

    /**
     * The share key which was provided by this user when they authenticated. If
     * there is no such share key, this will be null.
     */
    private final String shareKey;

    /**
     * Creates a new SharedAuthenticatedUser which copies the details of the
     * given AuthenticatedUser, including that user's identifier (username).
     * The new SharedAuthenticatedUser will not have any associated share key.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser to copy.
     */
    public SharedAuthenticatedUser(AuthenticatedUser authenticatedUser) {
        super(authenticatedUser.getAuthenticationProvider(),
                authenticatedUser.getCredentials(), Collections.<String>emptySet());
        this.shareKey = null;
        this.identifier = authenticatedUser.getIdentifier();
    }

    /**
     * Creates a new SharedAuthenticatedUser associating the given user with
     * their corresponding credentials and share key. The identifier (username)
     * of the user will be the standard identifier for anonymous users as
     * defined by the Guacamole extension API.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider that has authenticated the given user.
     *
     * @param credentials
     *     The credentials given by the user when they authenticated.
     *
     * @param shareKey
     *     The share key which was provided by this user when they
     *     authenticated, or null if no share key was provided.
     */
    public SharedAuthenticatedUser(AuthenticationProvider authenticationProvider,
            Credentials credentials, String shareKey) {
        super(authenticationProvider, credentials, Collections.<String>emptySet());
        this.shareKey = shareKey;
        this.identifier = AuthenticatedUser.ANONYMOUS_IDENTIFIER;
    }

    /**
     * Returns the share key which was provided by this user when they
     * authenticated. If there is no such share key, null is returned.
     *
     * @return
     *     The share key which was provided by this user when they
     *     authenticated, or null if no share key was provided.
     */
    public String getShareKey() {
        return shareKey;
    }

    @Override
    public String getIdentifier() {
        return identifier;
    }

    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("Users authenticated via share keys are immutable.");
    }

}
