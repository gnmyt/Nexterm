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

package org.apache.guacamole.auth.sso.user;

import com.google.inject.Inject;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.net.auth.AbstractAuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;

/**
 * An AuthenticatedUser whose identity has been supplied by an arbitrary SSO
 * service. An SSOAuthenticatedUser may additionally be associated with a set
 * of user-specific parameter tokens to be injected into any connections used
 * by that user.
 */
public class SSOAuthenticatedUser extends AbstractAuthenticatedUser {
    
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
     * The groups that this user belongs to.
     */
    private Set<String> effectiveGroups;

    /**
     * Parameter tokens to be automatically injected for any connections used
     * by this user.
     */
    private Map<String, String> tokens;

    /**
     * Initializes this SSOAuthenticatedUser, associating it with the given
     * username, credentials, groups, and parameter tokens. The contents of the
     * given credentials are automatically updated to match the provided
     * username. This function must be invoked for every SSOAuthenticatedUser
     * created.
     *
     * @param username
     *     The username of the user that was authenticated.
     *
     * @param credentials
     *     The credentials provided when this user was authenticated. These
     *     credentials will be updated to match the provided username.
     *
     * @param effectiveGroups
     *     The groups that the authenticated user belongs to.
     *
     * @param tokens
     *     A map of all the name/value pairs that should be available
     *     as tokens when connections are established by this user.
     */
    public void init(String username, Credentials credentials,
            Set<String> effectiveGroups, Map<String, String> tokens) {

        this.credentials = credentials;
        this.effectiveGroups = Collections.unmodifiableSet(effectiveGroups);
        this.tokens = Collections.unmodifiableMap(tokens);
        setIdentifier(username);

        // Update credentials with username provided via SSO for sake of
        // ${GUAC_USERNAME} token
        credentials.setUsername(username);

    }

    /**
     * Returns a Map of the parameter tokens that should be automatically
     * injected into connections used by this user during their session. If
     * there are no parameter tokens applicable to the SSO implementation, this
     * may simply be an empty map.
     *
     * @return
     *     A map of the parameter token name/value pairs that should be
     *     automatically injected into connections used by this user.
     */
    public Map<String, String> getTokens() {
        return tokens;
    }

    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return authProvider;
    }

    @Override
    public Credentials getCredentials() {
        return credentials;
    }

    @Override
    public Set<String> getEffectiveUserGroups() {
        return effectiveGroups;
    }

}
