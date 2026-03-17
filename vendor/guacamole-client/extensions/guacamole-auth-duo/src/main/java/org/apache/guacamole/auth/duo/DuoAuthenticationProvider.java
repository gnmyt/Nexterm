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

package org.apache.guacamole.auth.duo;

import com.google.inject.Guice;
import com.google.inject.Injector;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;

/**
 * AuthenticationProvider implementation which uses Duo as an additional
 * authentication factor for users which have already been authenticated by
 * some other AuthenticationProvider.
 */
public class DuoAuthenticationProvider extends AbstractAuthenticationProvider {

    /**
     * The unique identifier for this authentication provider. This is used in
     * various parts of the Guacamole client to distinguish this provider from
     * others, particularly when multiple authentication providers are used.
     */
    public static String PROVIDER_IDENTIFER = "duo";

    /**
     * Service for verifying the identity of users that Guacamole has otherwise
     * already authenticated.
     */
    private final UserVerificationService verificationService;

    /**
     * Session manager for storing/retrieving the state of a user's
     * authentication attempt while they are redirected to the Duo service.
     */
    private final DuoAuthenticationSessionManager sessionManager;

    /**
     * Creates a new DuoAuthenticationProvider that verifies users
     * using the Duo authentication service
     *
     * @throws GuacamoleException
     *     If a required property is missing, or an error occurs while parsing
     *     a property.
     */
    public DuoAuthenticationProvider() throws GuacamoleException {

        // Set up Guice injector.
        Injector injector = Guice.createInjector(
            new DuoAuthenticationProviderModule(this)
        );

        sessionManager = injector.getInstance(DuoAuthenticationSessionManager.class);
        verificationService = injector.getInstance(UserVerificationService.class);

    }

    @Override
    public String getIdentifier() {
        return PROVIDER_IDENTIFER;
    }

    @Override
    public Credentials updateCredentials(Credentials credentials)
            throws GuacamoleException {

        // Ignore requests with no corresponding authentication session ID, as
        // there are no credentials to reconstitute if the user has not yet
        // attempted to authenticate
        String duoState = credentials.getParameter(UserVerificationService.DUO_STATE_PARAMETER_NAME);
        if (duoState == null)
            return credentials;

        // Ignore requests with invalid/expired authentication session IDs
        DuoAuthenticationSession session = sessionManager.resume(duoState);
        if (session == null)
            return credentials;

        // Reconstitute the originally-provided credentials from the users
        // authentication attempt prior to being redirected to Duo
        Credentials previousCredentials = session.getCredentials();
        previousCredentials.setRequestDetails(credentials.getRequestDetails());
        return previousCredentials;

    }

    @Override
    public UserContext getUserContext(AuthenticatedUser authenticatedUser)
            throws GuacamoleException {

        // Verify user against Duo service
        verificationService.verifyAuthenticatedUser(authenticatedUser);

        // User has been verified, and authentication should be allowed to
        // continue
        return null;

    }

    @Override
    public void shutdown() {
        sessionManager.shutdown();
    }

}
