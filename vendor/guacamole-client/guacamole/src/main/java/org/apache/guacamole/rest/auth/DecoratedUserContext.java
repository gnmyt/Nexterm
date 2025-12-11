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

package org.apache.guacamole.rest.auth;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.DelegatingUserContext;
import org.apache.guacamole.net.auth.UserContext;

/**
 * A UserContext which has been decorated by an AuthenticationProvider through
 * invoking decorate() or redecorate().
 */
public class DecoratedUserContext extends DelegatingUserContext {

    /**
     * The original, undecorated UserContext.
     */
    private final UserContext undecoratedUserContext;

    /**
     * The AuthenticationProvider which applied this layer of decoration.
     */
    private final AuthenticationProvider decoratingAuthenticationProvider;

    /**
     * The DecoratedUserContext which applies the layer of decoration
     * immediately beneath this DecoratedUserContext. If no further decoration
     * has been applied, this will be null.
     */
    private final DecoratedUserContext decoratedUserContext;

    /**
     * Decorates a newly-created UserContext (as would be returned by
     * getUserContext()), invoking the decorate() function of the given
     * AuthenticationProvider to apply an additional layer of decoration. If the
     * AuthenticationProvider originated the given UserContext, this function
     * has no effect.
     *
     * @param authProvider
     *     The AuthenticationProvider which should be used to decorate the
     *     given UserContext.
     *
     * @param userContext
     *     The UserContext to decorate.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser identifying the user associated with the given
     *     UserContext.
     *
     * @param credentials
     *     The credentials associated with the request which produced the given
     *     UserContext.
     *
     * @return
     *     A UserContext instance which has been decorated (wrapped) by the
     *     given AuthenticationProvider, or the original UserContext if the
     *     given AuthenticationProvider originated the UserContext.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If the given AuthenticationProvider fails while decorating the
     *     UserContext.
     */
    private static UserContext decorate(AuthenticationProvider authProvider,
            UserContext userContext, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        // Skip the AuthenticationProvider which produced the UserContext
        // being decorated
        if (authProvider != userContext.getAuthenticationProvider()) {

            // Apply layer of wrapping around UserContext
            UserContext decorated;
            try {
                decorated = authProvider.decorate(userContext,
                        authenticatedUser, credentials);
            }
            catch (GuacamoleException | RuntimeException | Error e) {
                throw new GuacamoleAuthenticationProcessException("User "
                        + "authentication aborted by decorating UserContext.",
                        authProvider, e);
            }

            // Do not allow misbehaving extensions to wipe out the
            // UserContext entirely
            if (decorated != null)
                return decorated;

        }

        return userContext;

    }

    /**
     * Redecorates an updated UserContext (as would be returned by
     * updateUserContext()), invoking the redecorate() function of the given
     * AuthenticationProvider to apply an additional layer of decoration. If the
     * AuthenticationProvider originated the given UserContext, this function
     * has no effect.
     *
     * @param decorated
     *     The DecoratedUserContext associated with an older version of the
     *     given UserContext.
     *
     * @param userContext
     *     The new version of the UserContext which should be decorated.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser identifying the user associated with the given
     *     UserContext.
     *
     * @param credentials
     *     The credentials associated with the request which produced the given
     *     UserContext.
     *
     * @return
     *     A UserContext instance which has been decorated (wrapped) by the
     *     given AuthenticationProvider, or the original UserContext if the
     *     given AuthenticationProvider originated the UserContext.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If the given AuthenticationProvider fails while decorating the
     *     UserContext.
     */
    private static UserContext redecorate(DecoratedUserContext decorated,
            UserContext userContext, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        AuthenticationProvider authProvider = decorated.getDecoratingAuthenticationProvider();

        // Skip the AuthenticationProvider which produced the UserContext
        // being decorated
        if (authProvider != userContext.getAuthenticationProvider()) {

            // Apply next layer of wrapping around UserContext
            UserContext redecorated;
            try {
                redecorated = authProvider.redecorate(decorated.getDelegateUserContext(),
                        userContext, authenticatedUser, credentials);
            }
            catch (GuacamoleException | RuntimeException | Error e) {
                throw new GuacamoleAuthenticationProcessException("User "
                        + "authentication aborted by redecorating UserContext.",
                        authProvider, e);
            }

            // Do not allow misbehaving extensions to wipe out the
            // UserContext entirely
            if (redecorated != null)
                return redecorated;

        }

        return userContext;

    }

    /**
     * Creates a new DecoratedUserContext, invoking the decorate() function of
     * the given AuthenticationProvider to decorate the provided, undecorated
     * UserContext. If the AuthenticationProvider originated the given
     * UserContext, then the given UserContext is wrapped without any
     * decoration.
     *
     * @param authProvider
     *     The AuthenticationProvider which should be used to decorate the
     *     given UserContext.
     *
     * @param userContext
     *     The undecorated UserContext to decorate.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser identifying the user associated with the given
     *     UserContext.
     *
     * @param credentials
     *     The credentials associated with the request which produced the given
     *     UserContext.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If any of the given AuthenticationProviders fails while decorating
     *     the UserContext.
     */
    public DecoratedUserContext(AuthenticationProvider authProvider,
            UserContext userContext, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        // Wrap the result of invoking decorate() on the given AuthenticationProvider
        super(decorate(authProvider, userContext, authenticatedUser, credentials));
        this.decoratingAuthenticationProvider = authProvider;

        // The wrapped UserContext is undecorated
        this.undecoratedUserContext = userContext;
        this.decoratedUserContext = null;

    }

    /**
     * Creates a new DecoratedUserContext, invoking the decorate() function
     * of the given AuthenticationProvider to apply an additional layer of
     * decoration to a DecoratedUserContext. If the AuthenticationProvider
     * originated the given UserContext, then the given UserContext is wrapped
     * without any decoration.
     *
     * @param authProvider
     *     The AuthenticationProvider which should be used to decorate the
     *     given UserContext.
     *
     * @param userContext
     *     The DecoratedUserContext to decorate.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser identifying the user associated with the given
     *     UserContext.
     *
     * @param credentials
     *     The credentials associated with the request which produced the given
     *     UserContext.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If any of the given AuthenticationProviders fails while decorating
     *     the UserContext.
     */
    public DecoratedUserContext(AuthenticationProvider authProvider,
            DecoratedUserContext userContext, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        // Wrap the result of invoking decorate() on the given AuthenticationProvider
        super(decorate(authProvider, userContext, authenticatedUser, credentials));
        this.decoratingAuthenticationProvider = authProvider;

        // The wrapped UserContext has at least one layer of decoration
        this.undecoratedUserContext = userContext.getUndecoratedUserContext();
        this.decoratedUserContext = userContext;

    }

    /**
     * Creates a new DecoratedUserContext, invoking the redecorate() function
     * of the given AuthenticationProvider to reapply decoration to the provided,
     * undecorated UserContext, which has been updated relative to a past version
     * which was decorated. If the AuthenticationProvider originated the given
     * UserContext, then the given UserContext is wrapped without any decoration.
     *
     * @param decorated
     *     The DecoratedUserContext associated with the older version of the
     *     given UserContext.
     *
     * @param userContext
     *     The undecorated UserContext to decorate.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser identifying the user associated with the given
     *     UserContext.
     *
     * @param credentials
     *     The credentials associated with the request which produced the given
     *     UserContext.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If any of the given AuthenticationProviders fails while decorating
     *     the UserContext.
     */
    public DecoratedUserContext(DecoratedUserContext decorated,
            UserContext userContext, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        // Wrap the result of invoking redecorate() on the given AuthenticationProvider
        super(redecorate(decorated, userContext, authenticatedUser, credentials));
        this.decoratingAuthenticationProvider = decorated.getDecoratingAuthenticationProvider();

        // The wrapped UserContext is undecorated
        this.undecoratedUserContext = userContext;
        this.decoratedUserContext = null;

    }

    /**
     * Creates a new DecoratedUserContext, invoking the redecorate() function
     * of the given AuthenticationProvider to reapply decoration to a
     * DecoratedUserContext which already has at least one layer of decoration
     * applied, and which is associated with a UserContext which was updated
     * relative to a past version which was decorated. If the
     * AuthenticationProvider originated the given UserContext, then the given
     * UserContext is wrapped without any decoration.
     *
     * @param decorated
     *     The DecoratedUserContext associated with the older version of the
     *     UserContext wrapped within one or more layers of decoration.
     *
     * @param userContext
     *     The DecoratedUserContext to decorate.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser identifying the user associated with the given
     *     UserContext.
     *
     * @param credentials
     *     The credentials associated with the request which produced the given
     *     UserContext.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If any of the given AuthenticationProviders fails while decorating
     *     the UserContext.
     */
    public DecoratedUserContext(DecoratedUserContext decorated,
            DecoratedUserContext userContext, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        // Wrap the result of invoking redecorate() on the given AuthenticationProvider
        super(redecorate(decorated, userContext, authenticatedUser, credentials));
        this.decoratingAuthenticationProvider = decorated.getDecoratingAuthenticationProvider();

        // The wrapped UserContext has at least one layer of decoration
        this.undecoratedUserContext = userContext.getUndecoratedUserContext();
        this.decoratedUserContext = userContext;

    }

    /**
     * Returns the original UserContext with absolutely no layers of decoration
     * applied.
     *
     * @return
     *     The original, undecorated UserContext.
     */
    public UserContext getUndecoratedUserContext() {
        return undecoratedUserContext;
    }

    /**
     * Returns the AuthenticationProvider which applied the layer of decoration
     * represented by this DecoratedUserContext.
     *
     * @return
     *     The AuthenticationProvider which applied this layer of decoration.
     */
    public AuthenticationProvider getDecoratingAuthenticationProvider() {
        return decoratingAuthenticationProvider;
    }

    /**
     * Returns the DecoratedUserContext representing the next layer of
     * decoration, itself decorated by this DecoratedUserContext. If no further
     * layers of decoration exist, this will be null.
     *
     * @return
     *     The DecoratedUserContext which applies the layer of decoration
     *     immediately beneath this DecoratedUserContext, or null if no further
     *     decoration has been applied.
     */
    public DecoratedUserContext getDecoratedUserContext() {
        return decoratedUserContext;
    }

}
