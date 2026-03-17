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

package org.apache.guacamole.auth.ssl;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import java.net.URI;
import java.util.Arrays;
import java.util.Collections;
import org.apache.guacamole.auth.ssl.conf.ConfigurationService;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleResourceNotFoundException;
import org.apache.guacamole.auth.sso.SSOAuthenticationProviderService;
import org.apache.guacamole.auth.sso.user.SSOAuthenticatedUser;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.form.RedirectField;
import org.apache.guacamole.language.TranslatableMessage;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;

/**
 * Service that authenticates Guacamole users using SSL/TLS authentication
 * provided by an external SSL termination service.
 */
@Singleton
public class AuthenticationProviderService implements SSOAuthenticationProviderService {

    /**
     * Service for retrieving configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Session manager for generating and maintaining unique tokens to
     * represent the authentication flow of a user who has only partially
     * authenticated. Here, these tokens represent a user that has been
     * validated by SSL termination and allow the Guacamole instance that
     * doesn't require SSL/TLS authentication to retrieve the user's identity
     * and complete the authentication process.
     */
    @Inject
    private SSLAuthenticationSessionManager sessionManager;

    /**
     * Provider for AuthenticatedUser objects.
     */
    @Inject
    private Provider<SSOAuthenticatedUser> authenticatedUserProvider;

    /**
     * The name of the query parameter containing the temporary session token
     * representing the current state of an in-progress authentication attempt.
     */
    private static final String AUTH_SESSION_PARAMETER_NAME = "state";

    /**
     * Return the value of the session identifier associated with the given
     * credentials, or null if no session identifier is found in the credentials.
     *
     * @param credentials
     *      The credentials from which to extract the session identifier.
     *
     * @return
     *      The session identifier associated with the given credentials, or
     *      null if no identifier is found.
     */
    public static String getSessionIdentifier(Credentials credentials) {

        // Return the session identifier from the request params, if set, or
        // null otherwise
        return credentials != null ? credentials.getParameter(AUTH_SESSION_PARAMETER_NAME) : null;
    }

    /**
     * Processes the given credentials, returning the identity represented by
     * the auth session token present in that request associated with the 
     * credentials. If no such token is present, or the token does not represent
     * a valid identity, null is returned.
     *
     * @param credentials
     *     The credentials to extract the auth session token from.
     *
     * @return
     *     The identity represented by the auth session token in the request,
     *     or null if there is no such token or the token does not represent a
     *     valid identity.
     */
    private SSOAuthenticatedUser processIdentity(Credentials credentials) {

        String state = getSessionIdentifier(credentials);
        String username = sessionManager.getIdentity(state);
        if (username == null)
            return null;

        SSOAuthenticatedUser authenticatedUser = authenticatedUserProvider.get();
        authenticatedUser.init(username, credentials,
                Collections.emptySet(), Collections.emptyMap());
        return authenticatedUser;

    }

    @Override
    public SSOAuthenticatedUser authenticateUser(Credentials credentials)
            throws GuacamoleException {

        //
        // Overall flow:
        //
        // 1) An unauthenticated user makes a GET request to
        //    ".../api/ext/ssl/identity". After a series of redirects
        //    intended to prevent that identity from being inadvertently
        //    cached and inherited by future authentication attempts on the
        //    same client machine, an external SSL termination service requests
        //    and validates the user's certificate, those details are passed
        //    back to Guacamole via HTTP headers, and Guacamole produces a JSON
        //    response containing an opaque state value.
        //
        // 2) The user (still unauthenticated) resubmits the opaque state
        //    value from the received JSON as the "state" parameter of a
        //    standard Guacamole authentication request (".../api/tokens").
        //
        // 3) If the certificate received was valid, the user is authenticated
        //    according to the identity asserted by that certificate. If not,
        //    authentication is refused.
        //
        // NOTE: All SSL termination endpoints in front of Guacamole MUST
        // be configured to drop these headers from any inbound requests
        // or users may be able to assert arbitrary identities, since this
        // extension does not validate anything but the certificate timestamps.
        // It relies purely on SSL termination to validate that the certificate
        // was signed by the expected CA.
        //

        // We MUST have the domain associated with the request to ensure we
        // always get fresh SSL sessions when validating client certificates
        String host = credentials.getHeader("Host");
        if (host == null)
            return null;

        //
        // Handle only auth session tokens at the primary URI, using the
        // pre-verified information from those tokens to determine user
        // identity.
        //

        if (confService.isPrimaryHostname(host))
            return processIdentity(credentials);

        // All other requests are not allowed - redirect to proper hostname
        throw new GuacamoleInvalidCredentialsException("Authentication is "
                + "only allowed against the primary URL of this Guacamole "
                + "instance.",
            new CredentialsInfo(Arrays.asList(new Field[] {
                new RedirectField("primaryURI", confService.getPrimaryURI(),
                        new TranslatableMessage("LOGIN.INFO_REDIRECT_PENDING"))
            }))
        );

    }

    @Override
    public URI getLoginURI() throws GuacamoleException {
        throw new GuacamoleResourceNotFoundException("No such resource.");
    }

    @Override
    public void shutdown() {
        sessionManager.shutdown();
    }

}
