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

package org.apache.guacamole.net.auth.simple;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AbstractAuthenticatedUser;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.protocol.GuacamoleConfiguration;

/**
 * Provides means of retrieving a set of named GuacamoleConfigurations for a
 * given Credentials object. This is a simple AuthenticationProvider
 * implementation intended to be easily extended. It is useful for simple
 * authentication situations where access to web-based administration and
 * complex users and permissions are not required.
 *
 * The interface provided by SimpleAuthenticationProvider is similar to that of
 * the AuthenticationProvider interface of older Guacamole releases.
 */
public abstract class SimpleAuthenticationProvider
    extends AbstractAuthenticationProvider {

    /**
     * Given an arbitrary credentials object, returns a Map containing all
     * configurations authorized by those credentials. The keys of this Map
     * are Strings which uniquely identify each configuration.
     *
     * @param credentials The credentials to use to retrieve authorized
     *                    configurations.
     * @return A Map of all configurations authorized by the given credentials,
     *         or null if the credentials given are not authorized.
     * @throws GuacamoleException If an error occurs while retrieving
     *                            configurations.
     */
    public abstract Map<String, GuacamoleConfiguration>
            getAuthorizedConfigurations(Credentials credentials)
            throws GuacamoleException;

    /**
     * AuthenticatedUser which contains its own predefined set of authorized
     * configurations.
     */
    private class SimpleAuthenticatedUser extends AbstractAuthenticatedUser {

        /**
         * The credentials provided when this AuthenticatedUser was
         * authenticated.
         */
        private final Credentials credentials;

        /**
         * The GuacamoleConfigurations that this AuthenticatedUser is
         * authorized to use.
         */
        private final Map<String, GuacamoleConfiguration> configs;

        /**
         * Creates a new SimpleAuthenticatedUser associated with the given
         * credentials and having access to the given Map of
         * GuacamoleConfigurations.
         *
         * @param credentials
         *     The credentials provided by the user when they authenticated.
         *
         * @param configs
         *     A Map of all GuacamoleConfigurations for which this user has
         *     access. The keys of this Map are Strings which uniquely identify
         *     each configuration.
         */
        public SimpleAuthenticatedUser(Credentials credentials, Map<String, GuacamoleConfiguration> configs) {

            // Store credentials and configurations
            this.credentials = credentials;
            this.configs = configs;

            // Pull username from credentials if it exists
            String username = credentials.getUsername();
            if (username != null && !username.isEmpty())
                setIdentifier(username);

            // Otherwise generate a random username
            else
                setIdentifier(UUID.randomUUID().toString());

        }

        /**
         * Returns a Map containing all GuacamoleConfigurations that this user
         * is authorized to use. The keys of this Map are Strings which
         * uniquely identify each configuration.
         *
         * @return
         *     A Map of all configurations for which this user is authorized.
         */
        public Map<String, GuacamoleConfiguration> getAuthorizedConfigurations() {
            return configs;
        }

        @Override
        public AuthenticationProvider getAuthenticationProvider() {
            return SimpleAuthenticationProvider.this;
        }

        @Override
        public Credentials getCredentials() {
            return credentials;
        }

        @Override
        public Set<String> getEffectiveUserGroups() {
            return Collections.<String>emptySet();
        }

    }

    @Override
    public AuthenticatedUser authenticateUser(final Credentials credentials)
            throws GuacamoleException {

        // Get configurations
        Map<String, GuacamoleConfiguration> configs =
                getAuthorizedConfigurations(credentials);

        // Return as unauthorized if not authorized to retrieve configs
        if (configs == null)
            return null;

        return new SimpleAuthenticatedUser(credentials, configs);

    }

    @Override
    public UserContext getUserContext(AuthenticatedUser authenticatedUser)
            throws GuacamoleException {

        // Get configurations
        Map<String, GuacamoleConfiguration> configs =
                getAuthorizedConfigurations(authenticatedUser.getCredentials());

        // Return as unauthorized if not authorized to retrieve configs
        if (configs == null)
            return null;

        // Return user context restricted to authorized configs
        return new SimpleUserContext(this, authenticatedUser.getIdentifier(), configs, true);

    }

}
