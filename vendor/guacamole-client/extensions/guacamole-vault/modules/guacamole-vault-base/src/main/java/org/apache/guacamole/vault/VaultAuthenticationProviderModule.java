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

import com.google.inject.AbstractModule;
import com.google.inject.assistedinject.FactoryModuleBuilder;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.environment.LocalEnvironment;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.vault.user.VaultUserContext;
import org.apache.guacamole.vault.user.VaultUserContextFactory;

/**
 * Guice module which configures injections specific to the base support for
 * key vaults. When adding support for a key vault provider, a subclass
 * specific to that vault implementation will need to be created.
 *
 * @see KsmAuthenticationProviderModule
 */
public abstract class VaultAuthenticationProviderModule extends AbstractModule {

    /**
     * Guacamole server environment.
     */
    private final Environment environment;

    /**
     * Creates a new VaultAuthenticationProviderModule which configures
     * dependency injection for the authentication provider of a vault
     * implementation.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the Guacamole server
     *     environment.
     */
    public VaultAuthenticationProviderModule() throws GuacamoleException {
        this.environment = LocalEnvironment.getInstance();
    }

    /**
     * Configures injections for interfaces which are implementation-specific
     * to the vault service in use. Subclasses MUST provide a version of this
     * function which binds concrete implementations to the following
     * interfaces:
     *
     *     - VaultConfigurationService
     *     - VaultSecretService
     *
     * @see KsmAuthenticationProviderModule
     */
    protected abstract void configureVault();

    /**
     * Returns the instance of the Guacamole server environment which will be
     * exposed to other classes via dependency injection.
     *
     * @return
     *     The instance of the Guacamole server environment which will be
     *     exposed via dependency injection.
     */
    protected Environment getEnvironment() {
        return environment;
    }

    @Override
    protected void configure() {

        // Bind Guacamole server environment
        bind(Environment.class).toInstance(environment);

        // Bind factory for creating UserContexts
        install(new FactoryModuleBuilder()
                .implement(UserContext.class, VaultUserContext.class)
                .build(VaultUserContextFactory.class));

        // Bind all other implementation-specific interfaces
        configureVault();

    }

}
