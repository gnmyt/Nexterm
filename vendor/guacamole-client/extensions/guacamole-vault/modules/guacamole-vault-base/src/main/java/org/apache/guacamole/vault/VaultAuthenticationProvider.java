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

package org.apache.guacamole.vault;

import com.google.inject.Guice;
import com.google.inject.Injector;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.vault.conf.VaultConfigurationService;
import org.apache.guacamole.vault.user.VaultUserContextFactory;

/**
 * AuthenticationProvider implementation which automatically injects tokens
 * containing the values of secrets retrieved from a vault.
 */
public abstract class VaultAuthenticationProvider
        extends AbstractAuthenticationProvider {

    /**
     * Factory for creating instances of the relevant vault-specific
     * UserContext implementation.
     */
    private final VaultUserContextFactory userContextFactory;

    /**
     * Creates a new VaultAuthenticationProvider which uses the given module to
     * configure dependency injection.
     *
     * @param module
     *     The module to use to configure dependency injection.
     *
     * @throws GuacamoleException
     *     If the properties file containing vault-mapped Guacamole
     *     configuration properties exists but cannot be read.
     */
    protected VaultAuthenticationProvider(VaultAuthenticationProviderModule module)
            throws GuacamoleException {

        Injector injector = Guice.createInjector(module);
        this.userContextFactory = injector.getInstance(VaultUserContextFactory.class);

        // Automatically pull properties from vault
        Environment environment = injector.getInstance(Environment.class);
        VaultConfigurationService confService = injector.getInstance(VaultConfigurationService.class);
        environment.addGuacamoleProperties(confService.getProperties());
        
    }

    @Override
    public UserContext decorate(UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {
        return userContextFactory.create(context);
    }

}
