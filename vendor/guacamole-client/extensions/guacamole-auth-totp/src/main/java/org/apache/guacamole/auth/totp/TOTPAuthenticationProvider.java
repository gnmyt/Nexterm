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

package org.apache.guacamole.auth.totp;

import org.apache.guacamole.auth.totp.user.UserVerificationService;
import com.google.inject.Guice;
import com.google.inject.Injector;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.totp.user.CodeUsageTrackingService;
import org.apache.guacamole.auth.totp.user.TOTPUserContext;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;

/**
 * AuthenticationProvider implementation which uses TOTP as an additional
 * authentication factor for users which have already been authenticated by
 * some other AuthenticationProvider.
 */
public class TOTPAuthenticationProvider extends AbstractAuthenticationProvider {

    /**
     * Injector which will manage the object graph of this authentication
     * provider.
     */
    private final Injector injector;

    /**
     * Creates a new TOTPAuthenticationProvider that verifies users using TOTP.
     *
     * @throws GuacamoleException
     *     If a required property is missing, or an error occurs while parsing
     *     a property.
     */
    public TOTPAuthenticationProvider() throws GuacamoleException {

        // Set up Guice injector.
        injector = Guice.createInjector(
            new TOTPAuthenticationProviderModule(this)
        );

    }

    @Override
    public String getIdentifier() {
        return "totp";
    }

    @Override
    public UserContext decorate(UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {

        UserVerificationService verificationService =
                injector.getInstance(UserVerificationService.class);

        // Verify identity of user
        verificationService.verifyIdentity(context, authenticatedUser);

        // User has been verified, and authentication should be allowed to
        // continue
        return new TOTPUserContext(context);

    }

    @Override
    public UserContext redecorate(UserContext decorated, UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {
        return new TOTPUserContext(context);
    }

    @Override
    public void shutdown() {
        injector.getInstance(CodeUsageTrackingService.class).shutdown();
    }

}
