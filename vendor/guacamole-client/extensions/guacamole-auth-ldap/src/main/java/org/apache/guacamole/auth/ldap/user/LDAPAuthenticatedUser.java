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

package org.apache.guacamole.auth.ldap.user;

import com.google.inject.Inject;
import java.util.Collections;
import java.util.Map;
import java.util.Set;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.ldap.ConnectedLDAPConfiguration;
import org.apache.guacamole.net.auth.AbstractAuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;

/**
 * An LDAP-specific implementation of AuthenticatedUser, associating a
 * particular set of credentials with the LDAP authentication provider.
 */
public class LDAPAuthenticatedUser extends AbstractAuthenticatedUser {

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
     * Name/value pairs to be applied as parameter tokens when connections
     * are established using this AuthenticatedUser.
     */
    private Map<String, String> tokens;

    /**
     * The unique identifiers of all user groups which affect the permissions
     * available to this user.
     */
    private Set<String> effectiveGroups;
    
    /**
     * The LDAP DN used to bind this user.
     */
    private Dn bindDn;

    /**
     * The configuration of the LDAP server that should be used for all queries
     * related to this AuthenticatedUser.
     */
    private ConnectedLDAPConfiguration config;
    
    /**
     * Initializes this AuthenticatedUser with the given credentials,
     * connection parameter tokens, and set of effective user groups.
     *
     * @param config
     *     The configuration of the LDAP server that should be used for all
     *     queries related to this AuthenticatedUser.
     *
     * @param credentials
     *     The credentials provided when this user was authenticated.
     *
     * @param tokens
     *     A Map of all name/value pairs that should be applied as parameter
     *     tokens when connections are established using the AuthenticatedUser.
     *
     * @param effectiveGroups
     *     The unique identifiers of all user groups which affect the
     *     permissions available to this user.
     */
    public void init(UserLDAPConfiguration config, Credentials credentials,
            Map<String, String> tokens, Set<String> effectiveGroups) {
        this.config = config;
        this.credentials = credentials;
        this.tokens = Collections.unmodifiableMap(tokens);
        this.effectiveGroups = effectiveGroups;
        this.bindDn = config.getBindDN();
        setIdentifier(config.getGuacamoleUsername());
    }
    
    /**
     * Returns a Map of all name/value pairs that should be applied as
     * parameter tokens when connections are established using this
     * AuthenticatedUser.
     *
     * @return
     *     A Map of all name/value pairs that should be applied as parameter
     *     tokens when connections are established using this
     *     AuthenticatedUser.
     */
    public Map<String, String> getTokens() {
        return tokens;
    }

    /**
     * Returns the LDAP DN used to bind this user.
     * 
     * @return 
     *     The LDAP DN used to bind this user.
     */
    public Dn getBindDn() {
        return bindDn;
    }

    /**
     * Returns the configuration of the LDAP server that should be used for all
     * queries related to this AuthenticatedUser.
     *
     * @return
     *     The configuration of the LDAP server related to this
     *     AuthenticatedUser.
     */
    public ConnectedLDAPConfiguration getLDAPConfiguration() {
        return config;
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

    @Override
    public void invalidate() {
        config.close();
    }

}
