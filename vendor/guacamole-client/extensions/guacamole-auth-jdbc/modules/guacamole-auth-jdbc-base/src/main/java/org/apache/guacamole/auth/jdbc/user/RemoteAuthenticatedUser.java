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

import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;

/**
 * An AuthenticatedUser that has an associated remote host.
 */
public abstract class RemoteAuthenticatedUser implements AuthenticatedUser {

    /**
     * The credentials given when this user authenticated.
     */
    private final Credentials credentials;

    /**
     * The AuthenticationProvider that authenticated this user.
     */
    private final AuthenticationProvider authenticationProvider;

    /**
     * The host from which this user authenticated.
     */
    private final String remoteHost;

    /**
     * The identifiers of any groups of which this user is a member, including
     * groups inherited through membership in other groups.
     */
    private final Set<String> effectiveGroups;

    /**
     * Creates a new RemoteAuthenticatedUser, deriving the associated remote
     * host from the given credentials.
     *
     * @param authenticationProvider
     *     The AuthenticationProvider that has authenticated the given user.
     *
     * @param credentials
     *     The credentials given by the user when they authenticated.
     *
     * @param effectiveGroups
     *     The identifiers of any groups of which this user is a member,
     *     including groups inherited through membership in other groups.
     */
    public RemoteAuthenticatedUser(AuthenticationProvider authenticationProvider,
            Credentials credentials, Set<String> effectiveGroups) {
        this.authenticationProvider = authenticationProvider;
        this.credentials = credentials;
        this.remoteHost = credentials.getRemoteAddress();
        this.effectiveGroups = Collections.unmodifiableSet(effectiveGroups);
    }

    @Override
    public Credentials getCredentials() {
        return credentials;
    }

    /**
     * Returns the host from which this user authenticated.
     *
     * @return
     *     The host from which this user authenticated.
     */
    public String getRemoteHost() {
        return remoteHost;
    }

    @Override
    public Set<String> getEffectiveUserGroups() {
        return effectiveGroups;
    }

    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return authenticationProvider;
    }

    @Override
    public void invalidate() {
        // Nothing to invalidate
    }

}
