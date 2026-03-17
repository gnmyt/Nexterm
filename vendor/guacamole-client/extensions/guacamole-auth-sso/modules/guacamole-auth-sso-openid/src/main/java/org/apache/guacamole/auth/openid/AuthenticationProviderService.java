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

package org.apache.guacamole.auth.openid;

import com.google.inject.Inject;
import com.google.inject.Provider;
import com.google.inject.Singleton;
import java.net.URI;
import java.util.Arrays;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import javax.ws.rs.core.UriBuilder;
import org.apache.guacamole.auth.openid.conf.ConfigurationService;
import org.apache.guacamole.auth.openid.token.TokenValidationService;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.sso.NonceService;
import org.apache.guacamole.auth.sso.SSOAuthenticationProviderService;
import org.apache.guacamole.auth.sso.user.SSOAuthenticatedUser;
import org.apache.guacamole.form.Field;
import org.apache.guacamole.form.RedirectField;
import org.apache.guacamole.language.TranslatableMessage;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;
import org.jose4j.jwt.JwtClaims;

/**
 * Service that authenticates Guacamole users by processing OpenID tokens.
 */
@Singleton
public class AuthenticationProviderService implements SSOAuthenticationProviderService {

    /**
     * The standard HTTP parameter which will be included within the URL by all
     * OpenID services upon successful authentication and redirect.
     */
    public static final String TOKEN_PARAMETER_NAME = "id_token";

    /**
     * Service for retrieving OpenID configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Service for validating and generating unique nonce values.
     */
    @Inject
    private NonceService nonceService;

    /**
     * Service for validating received ID tokens.
     */
    @Inject
    private TokenValidationService tokenService;

    /**
     * Provider for AuthenticatedUser objects.
     */
    @Inject
    private Provider<SSOAuthenticatedUser> authenticatedUserProvider;

    @Override
    public SSOAuthenticatedUser authenticateUser(Credentials credentials)
            throws GuacamoleException {

        String username = null;
        Set<String> groups = null;
        Map<String,String> tokens = Collections.emptyMap();

        // Validate OpenID token in request, if present, and derive username
        String token = credentials.getParameter(TOKEN_PARAMETER_NAME);
        if (token != null) {
            JwtClaims claims = tokenService.validateToken(token);
            if (claims != null) {
                username = tokenService.processUsername(claims);
                groups = tokenService.processGroups(claims);
                tokens = tokenService.processAttributes(claims);
            }
        }

        // If the username was successfully retrieved from the token, produce
        // authenticated user
        if (username != null) {

            // Create corresponding authenticated user
            SSOAuthenticatedUser authenticatedUser = authenticatedUserProvider.get();
            authenticatedUser.init(username, credentials, groups, tokens);
            return authenticatedUser;

        }

        // Request OpenID token (will automatically redirect the user to the
        // OpenID authorization page via JavaScript)
        throw new GuacamoleInvalidCredentialsException("Invalid login.",
            new CredentialsInfo(Arrays.asList(new Field[] {
                new RedirectField(TOKEN_PARAMETER_NAME, getLoginURI(),
                        new TranslatableMessage("LOGIN.INFO_IDP_REDIRECT_PENDING"))
            }))
        );

    }

    @Override
    public URI getLoginURI() throws GuacamoleException {
        return UriBuilder.fromUri(confService.getAuthorizationEndpoint())
                .queryParam("scope", confService.getScope())
                .queryParam("response_type", "id_token")
                .queryParam("client_id", confService.getClientID())
                .queryParam("redirect_uri", confService.getRedirectURI())
                .queryParam("nonce", nonceService.generate(confService.getMaxNonceValidity() * 60000L))
                .build();
    }

    @Override
    public void shutdown() {
        // Nothing to clean up
    }
    
}
