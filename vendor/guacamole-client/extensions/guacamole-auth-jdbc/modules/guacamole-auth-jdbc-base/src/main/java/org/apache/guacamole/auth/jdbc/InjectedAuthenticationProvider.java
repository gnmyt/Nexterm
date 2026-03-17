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

import com.google.inject.Injector;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.AuthenticatedUser;

/**
 * Provides a base implementation of an AuthenticationProvider which delegates
 * the various function calls to an underlying AuthenticationProviderService
 * implementation. As such a service is injectable by Guice, this provides a
 * means for Guice to (effectively) apply dependency injection to an
 * AuthenticationProvider, even though it is the AuthenticationProvider that
 * serves as the entry point.
 */
public abstract class InjectedAuthenticationProvider extends AbstractAuthenticationProvider {

    /**
     * The AuthenticationProviderService to which all AuthenticationProvider
     * calls will be delegated.
     */
    private final AuthenticationProviderService authProviderService;

    /**
     * Creates a new AuthenticationProvider that delegates all calls to an
     * underlying AuthenticationProviderService. The behavior of the
     * AuthenticationProvider is defined by the given
     * AuthenticationProviderService implementation, which will be injected by
     * the Guice Injector provided by the given JDBCInjectorProvider.
     *
     * @param injectorProvider
     *     A JDBCInjectorProvider instance which provides singleton instances
     *     of a Guice Injector, pre-configured to set up all injections and
     *     access to the underlying database via MyBatis.
     *
     * @param authProviderServiceClass
     *    The AuthenticationProviderService implementation which defines the
     *    behavior of this AuthenticationProvider.
     *
     * @throws GuacamoleException
     *     If the Injector cannot be created due to an error.
     */
    public InjectedAuthenticationProvider(JDBCInjectorProvider injectorProvider,
            Class<? extends AuthenticationProviderService> authProviderServiceClass)
        throws GuacamoleException {

        Injector injector = injectorProvider.get();
        authProviderService = injector.getInstance(authProviderServiceClass);

    }

    @Override
    public AuthenticatedUser authenticateUser(Credentials credentials)
            throws GuacamoleException {
        return authProviderService.authenticateUser(this, credentials);
    }

    @Override
    public UserContext getUserContext(AuthenticatedUser authenticatedUser)
            throws GuacamoleException {
        return authProviderService.getUserContext(this, authenticatedUser);
    }

    @Override
    public UserContext updateUserContext(UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {
        return authProviderService.updateUserContext(this, context,
                authenticatedUser, credentials);
    }

    @Override
    public UserContext decorate(UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {
        return authProviderService.decorateUserContext(this, context,
                authenticatedUser, credentials);
    }

}
