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

import java.util.Iterator;
import java.util.List;
import javax.inject.Inject;

import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;

/**
 * A service for applying or reapplying layers of decoration to UserContexts.
 * The semantics of UserContext decoration/redecoration is defined by the
 * AuthenticationProvider interface.
 */
public class DecorationService {

    /**
     * All configured authentication providers which can be used to
     * authenticate users or retrieve data associated with authenticated users.
     */
    @Inject
    private List<AuthenticationProvider> authProviders;

    /**
     * Creates a new DecoratedUserContext, invoking the decorate() function
     * of all AuthenticationProviders to decorate the provided UserContext.
     * Decoration by each AuthenticationProvider will occur in the order that
     * the AuthenticationProviders were loaded. Only AuthenticationProviders
     * which did not originate the given UserContext will be used.
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
     *     A new DecoratedUserContext which has been decorated by all
     *     AuthenticationProviders.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If any AuthenticationProvider fails while decorating the UserContext.
     */
    public DecoratedUserContext decorate(UserContext userContext,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleAuthenticationProcessException {

        // Get first AuthenticationProvider in list
        Iterator<AuthenticationProvider> current = authProviders.iterator();
        if (!current.hasNext())
            return null;

        // Use first AuthenticationProvider to produce the root-level
        // decorated UserContext
        DecoratedUserContext decorated = new DecoratedUserContext(current.next(),
                userContext, authenticatedUser, credentials);

        // Repeatedly wrap the decorated UserContext with additional layers of
        // decoration for each remaining AuthenticationProvider
        while (current.hasNext()) {
            decorated = new DecoratedUserContext(current.next(), decorated,
                    authenticatedUser, credentials);
        }

        return decorated;

    }

    /**
     * Creates a new DecoratedUserContext, invoking the redecorate() function
     * of all AuthenticationProviders to reapply decoration. Decoration by each
     * AuthenticationProvider will occur in the order that the AuthenticationProviders
     * were loaded. Only AuthenticationProviders which did not originate the given
     * UserContext will be used.
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
     *     A new DecoratedUserContext which has been decorated by all
     *     AuthenticationProviders.
     *
     * @throws GuacamoleAuthenticationProcessException
     *     If any AuthenticationProvider fails while decorating the UserContext.
     */
    public DecoratedUserContext redecorate(DecoratedUserContext decorated,
            UserContext userContext, AuthenticatedUser authenticatedUser,
            Credentials credentials) throws GuacamoleAuthenticationProcessException {

        // If the given DecoratedUserContext contains further decorated layers,
        // redecorate those first
        DecoratedUserContext next = decorated.getDecoratedUserContext();
        if (next != null) {
            return new DecoratedUserContext(decorated,
                    redecorate(next, userContext, authenticatedUser, credentials),
                    authenticatedUser, credentials);
        }

        // If only one layer of decoration is present, simply redecorate that
        // layer
        return new DecoratedUserContext(decorated, userContext,
                authenticatedUser, credentials);

    }

}
