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

package org.apache.guacamole.auth.json.user;

import com.google.inject.Inject;
import org.apache.guacamole.net.auth.AbstractAuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * An implementation of AuthenticatedUser specific to the
 * JSONAuthenticationProvider, providing access to the decrypted contents of
 * the JSON provided during authentication.
 */
public class AuthenticatedUser extends AbstractAuthenticatedUser {

    /**
     * Logger for this class.
     */
    private static final Logger LOGGER = LoggerFactory.getLogger(AuthenticatedUser.class);
    
    /**
     * Reference to the authentication provider associated with this
     * authenticated user.
     */
    @Inject
    private AuthenticationProvider authProvider;

    /**
     * The credentials provided when this user was authenticated.
     */
    private Credentials credentials;

    /**
     * The UserData object derived from the data submitted when this user was
     * authenticated.
     */
    private UserData userData;

    /**
     * Initializes this AuthenticatedUser using the given credentials and
     * UserData object. The provided UserData object MUST have been derived
     * from the data submitted when the user authenticated.
     *
     * @param credentials
     *     The credentials provided when this user was authenticated.
     *
     * @param userData
     *     The UserData object derived from the data submitted when this user
     *     was authenticated.
     */
    public void init(Credentials credentials, UserData userData) {
        this.credentials = credentials;
        this.userData = userData;
        setIdentifier(userData.getUsername());
    }

    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return authProvider;
    }

    @Override
    public Credentials getCredentials() {
        return credentials;
    }

    /**
     * Returns the UserData object derived from the data submitted when this
     * user was authenticated.
     *
     * @return
     *     The UserData object derived from the data submitted when this user
     *     was authenticated.
     */
    public UserData getUserData() {
        return userData;
    }

}
