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

package org.apache.guacamole.auth.jdbc;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;

/**
 * Service which authenticates users based on credentials and provides for
 * the creation of corresponding, new UserContext objects for authenticated
 * users.
 */
public interface AuthenticationProviderService  {

    /**
     * Authenticates the user having the given credentials, returning a new
     * AuthenticatedUser instance only if the credentials are valid. If the
     * credentials are invalid or expired, an appropriate GuacamoleException
     * will be thrown.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider on behalf of which the user is being
     *     authenticated.
     *
     * @param credentials
     *     The credentials to use to produce the AuthenticatedUser.
     *
     * @return
     *     A new AuthenticatedUser instance for the user identified by the
     *     given credentials.
     *
     * @throws GuacamoleException
     *     If an error occurs during authentication, or if the given
     *     credentials are invalid or expired.
     */
    public AuthenticatedUser authenticateUser(AuthenticationProvider authenticationProvider,
            Credentials credentials) throws GuacamoleException;

    /**
     * Returning a new UserContext instance for the given already-authenticated
     * user.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider on behalf of which the UserContext is
     *     being produced.
     *
     * @param authenticatedUser
     *     The credentials to use to produce the UserContext.
     *
     * @return
     *     A new UserContext instance for the user identified by the given
     *     credentials, or null if no such user exists within the database.
     *
     * @throws GuacamoleException
     *     If an error occurs during authentication, or if the given
     *     credentials are invalid or expired.
     */
    public UserContext getUserContext(AuthenticationProvider authenticationProvider,
            AuthenticatedUser authenticatedUser) throws GuacamoleException;

    /**
     * Returns an updated UserContext instance for the given
     * already-authenticated user. If no changes need be made to the
     * UserContext, the original UserContext will be returned.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider on behalf of which the UserContext is
     *     being updated.
     *
     * @param context
     *     The UserContext to update.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser associated with the UserContext being updated.
     *
     * @param credentials
     *     The credentials most recently submitted by the user. These
     *     credentials are not guaranteed to be the same as the credentials
     *     already associated with the AuthenticatedUser.
     *
     * @return
     *     A new UserContext instance for the user identified by the given
     *     credentials.
     *
     * @throws GuacamoleException
     *     If an error occurs during authentication, or if the given
     *     credentials are invalid or expired.
     */
    public UserContext updateUserContext(AuthenticationProvider authenticationProvider,
            UserContext context, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException;

    /**
     * Decorates a UserContext instance for the given already-authenticated user.
     * If no decoration is required, the original UserContext will be returned.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider on behalf of which the UserContext is
     *     being decorated.
     *
     * @param context
     *     The UserContext to decorate.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser associated with the UserContext being decorated.
     *
     * @param credentials
     *     The credentials most recently submitted by the user. These
     *     credentials are not guaranteed to be the same as the credentials
     *     already associated with the AuthenticatedUser.
     *
     * @return
     *     A decorated UserContext instance for the user identified by the given
     *     credentials, or the original user context if no decoration is required.
     *
     * @throws GuacamoleException
     *     If the an error occurs during decoration of the UserContext.
     */
    public UserContext decorateUserContext(AuthenticationProvider authenticationProvider,
            UserContext context, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException;

}
