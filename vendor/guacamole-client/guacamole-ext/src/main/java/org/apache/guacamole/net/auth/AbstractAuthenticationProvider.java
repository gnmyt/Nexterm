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

package org.apache.guacamole.net.auth;

import org.apache.guacamole.GuacamoleException;

/**
 * Base implementation of AuthenticationProvider which provides default
 * implementations of most functions. Implementations must provide their
 * own {@link #getIdentifier()}, but otherwise need only override an implemented
 * function if they wish to actually implement the functionality defined for
 * that function by the AuthenticationProvider interface.
 */
public abstract class AbstractAuthenticationProvider implements AuthenticationProvider {

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns {@code null}. Implementations that
     * wish to expose REST resources which are not specific to a user's session
     * should override this function.
     */
    @Override
    public Object getResource() throws GuacamoleException {
        return null;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns the provided {@code credentials}
     * without performing any updates. Implementations that wish to perform
     * credential updates for in-progress authentication requests should
     * override this function.
     */
    @Override
    public Credentials updateCredentials(Credentials credentials)
            throws GuacamoleException {
        return credentials;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation performs no authentication whatsoever, ignoring
     * the provided {@code credentials} and simply returning {@code null}. Any
     * authentication attempt will thus fall through to other
     * {@link AuthenticationProvider} implementations, perhaps within other
     * installed extensions, with this {@code AuthenticationProvider} making no
     * claim regarding the user's identity nor whether the user should be
     * allowed or disallowed from accessing Guacamole. Implementations that wish
     * to authenticate users should override this function.
     */
    @Override
    public AuthenticatedUser authenticateUser(Credentials credentials)
            throws GuacamoleException {
        return null;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns the provided
     * {@code authenticatedUser} without modification. Implementations that
     * wish to update a user's {@link AuthenticatedUser} object with respect to
     * new {@link Credentials} received in requests which follow the initial,
     * successful authentication attempt should override this function.
     */
    @Override
    public AuthenticatedUser updateAuthenticatedUser(AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {
        return authenticatedUser;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns {@code null}, effectively allowing
     * authentication to continue but refusing to provide data for the given
     * user. Implementations that wish to veto the authentication results of
     * other {@link AuthenticationProvider} implementations or provide data for
     * authenticated users should override this function.
     */
    @Override
    public UserContext getUserContext(AuthenticatedUser authenticatedUser)
            throws GuacamoleException {
        return null;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns the provided {@code context}
     * without modification. Implementations that wish to update a user's
     * {@link UserContext} object with respect to newly-updated
     * {@link AuthenticatedUser} or {@link Credentials} (such as those received
     * in requests which follow the initial, successful authentication attempt)
     * should override this function.
     */
    @Override
    public UserContext updateUserContext(UserContext context,
            AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {
        return context;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply returns the provided {@code context}
     * without performing any decoration. Implementations that wish to augment
     * the functionality or data provided by other
     * {@link AuthenticationProvider} implementations should override this
     * function.
     */
    @Override
    public UserContext decorate(UserContext context,
            AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {
        return context;
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation simply invokes
     * {@link #decorate(UserContext,AuthenticatedUser,Credentials)} with the
     * provided {@code context}, {@code authenticatedUser}, and
     * {@code credentials}. Implementations which override
     * {@link #decorate(UserContext,AuthenticatedUser,Credentials)} and which
     * need to update their existing decorated object following possible
     * updates to the {@link UserContext} or {@link AuthenticatedUser} (rather
     * than generate an entirely new decorated object) should override this
     * function.
     */
    @Override
    public UserContext redecorate(UserContext decorated, UserContext context,
            AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleException {
        return decorate(context, authenticatedUser, credentials);
    }

    /**
     * {@inheritDoc}
     *
     * <p>This implementation does nothing. Implementations that wish to perform
     * cleanup tasks when the {@link AuthenticationProvider} is being unloaded
     * should override this function.
     */
    @Override
    public void shutdown() {
    }
    
}
