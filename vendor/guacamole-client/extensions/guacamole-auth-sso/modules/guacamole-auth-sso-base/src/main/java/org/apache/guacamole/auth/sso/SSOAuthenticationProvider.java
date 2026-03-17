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

package org.apache.guacamole.auth.sso;

import com.google.common.collect.Iterables;
import com.google.inject.AbstractModule;
import com.google.inject.Guice;
import com.google.inject.Injector;
import com.google.inject.Module;
import com.google.inject.binder.LinkedBindingBuilder;
import java.util.Arrays;
import java.util.Collections;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.sso.user.SSOAuthenticatedUser;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.TokenInjectingUserContext;
import org.apache.guacamole.net.auth.UserContext;

/**
 * An AuthenticationProvider which authenticates users against an arbitrary
 * SSO system. Guice dependency injection is automatically configured via
 * modules provided by the implementation. Implementations will typically
 * provide no storage for connections, instead relying on other installed
 * extensions.
 */
public abstract class SSOAuthenticationProvider extends AbstractAuthenticationProvider {

    /**
     * The Guice injector.
     */
    private final Injector injector;

    /**
     * Creates a new SSOAuthenticationProvider that authenticates users against
     * an arbitrary SSO system. Guice dependency injection is automatically
     * configured, with the resulting injector available to implementations via
     * {@link #getInjector()}. Core authentication functions are provided by
     * the given SSOAuthenticationProviderService implementation, and
     * additional implementation-specific services, providers, etc. may be
     * bound by specifying additional Guice modules.
     *
     * @param authService
     *     The SSOAuthenticationProviderService implementation that should be
     *     used for core authentication functions.
     *
     * @param ssoResource
     *     The SSOResource that should be used to manually redirect the user to
     *     the IdP, as well as to provide any implementation-specific REST
     *     endpoints.
     *
     * @param modules
     *     Any additional modules that should be used when creating the Guice
     *     injector.
     */
    public SSOAuthenticationProvider(
            Class<? extends SSOAuthenticationProviderService> authService,
            Class<? extends SSOResource> ssoResource,
            Module... modules) {
        this(authService, ssoResource, Arrays.asList(modules));
    }

    /**
     * Creates a new SSOAuthenticationProvider that authenticates users against
     * an arbitrary SSO system. Guice dependency injection is automatically
     * configured, with the resulting injector available to implementations via
     * {@link #getInjector()}. Core authentication functions are provided by
     * the given SSOAuthenticationProviderService implementation, and
     * additional may be provided by specifying additional Guice modules.
     *
     * @param authService
     *     The SSOAuthenticationProviderService implementation that should be
     *     used for core authentication functions.
     *
     * @param ssoResource
     *     The SSOResource that should be used to manually redirect the user to
     *     the IdP, as well as to provide any implementation-specific REST
     *     endpoints.
     *
     * @param modules
     *     Any additional modules that should be used when creating the Guice
     *     injector.
     */
    public SSOAuthenticationProvider(
            Class<? extends SSOAuthenticationProviderService> authService,
            Class<? extends SSOResource> ssoResource,
            Iterable<? extends Module> modules) {
        injector = Guice.createInjector(Iterables.concat(Collections.singletonList(new AbstractModule() {

            @Override
            protected void configure() {

                bind(AuthenticationProvider.class).toInstance(SSOAuthenticationProvider.this);
                bind(SSOAuthenticationProviderService.class).to(authService);

                // Bind custom SSOResource implementation if different from
                // core implementation (explicitly binding SSOResource as
                // SSOResource results in a runtime error from Guice otherwise)
                LinkedBindingBuilder<SSOResource> resourceBinding = bind(SSOResource.class);
                if (ssoResource != SSOResource.class)
                    resourceBinding.to(ssoResource);

            }

        }), modules));
    }

    /**
     * Returns the Guice injector available for use by this implementation of
     * SSOAuthenticationProvider. The returned injector has already been
     * configured with all modules supplied at the time this
     * SSOAuthenticationProvider was created.
     *
     * @return
     *     The Guice injector available for use by this implementation of
     *     SSOAuthenticationProvider.
     */
    protected final Injector getInjector() {
        return injector;
    }

    @Override
    public AuthenticatedUser authenticateUser(Credentials credentials)
            throws GuacamoleException {

        // Attempt to authenticate user with given credentials
        SSOAuthenticationProviderService authProviderService =
                injector.getInstance(SSOAuthenticationProviderService.class);

        return authProviderService.authenticateUser(credentials);

    }

    @Override
    public UserContext decorate(UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {

        // Only inject tokens for users authenticated by this extension
        if (authenticatedUser.getAuthenticationProvider() != this)
            return context;

        return new TokenInjectingUserContext(context,
                ((SSOAuthenticatedUser) authenticatedUser).getTokens());

    }

    @Override
    public SSOResource getResource() {
        return getInjector().getInstance(SSOResource.class);
    }

    @Override
    public void shutdown() {
        injector.getInstance(SSOAuthenticationProviderService.class).shutdown();
    }

}
