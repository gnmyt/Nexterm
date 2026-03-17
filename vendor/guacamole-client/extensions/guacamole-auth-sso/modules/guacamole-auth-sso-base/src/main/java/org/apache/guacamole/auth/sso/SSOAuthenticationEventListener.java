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

import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.credentials.GuacamoleInsufficientCredentialsException;
import org.apache.guacamole.net.event.AuthenticationFailureEvent;
import org.apache.guacamole.net.event.AuthenticationRequestReceivedEvent;
import org.apache.guacamole.net.event.CredentialEvent;
import org.apache.guacamole.net.event.listener.Listener;

/**
 * A Listener that will reactivate or invalidate SSO auth sessions depending on
 * overall auth success or failure.
 */
public abstract class SSOAuthenticationEventListener implements Listener {

    @Override
    public void handleEvent(Object event) throws GuacamoleException {

        // If the authentication attempt is incomplete or credentials cannot be
        // extracted, there's nothing to do
        if (event instanceof AuthenticationRequestReceivedEvent
                || !(event instanceof CredentialEvent))
            return;

        // Look for a session identifier associated with these credentials
        String sessionIdentifier = getSessionIdentifier(
                ((CredentialEvent) event).getCredentials());

        // If no session is associated with these credentials, there's
        // nothing to do
        if (sessionIdentifier == null)
            return;

        // If the SSO auth succeeded, but other auth providers failed to
        // authenticate the user associated with the credentials in this
        // failure event, they may wish to make another login attempt. To
        // avoid an infinite login attempt loop, re-enable the session
        // associated with these credentials, allowing the auth attempt to be
        // resumed without requiring another round trip to the SSO service.
        if (event instanceof AuthenticationFailureEvent) {
            Throwable failure = ((AuthenticationFailureEvent) event).getFailure();

            // If and only if the failure was associated with missing or
            // credentials, or a non-security related request issue,
            // reactivate the session
            if (failure instanceof GuacamoleInsufficientCredentialsException
                    || ((failure instanceof GuacamoleClientException)
                    && !(failure instanceof GuacamoleSecurityException))) {

                reactivateSession(sessionIdentifier);
                return;

            }

        }

        // Invalidate the session in all other cases
        invalidateSession(sessionIdentifier);

    }

    /**
     * Get the session identifier associated with the provided credentials,
     * if any. If no session is associated with the credentials, null will
     * be returned.
     *
     * @param credentials
     *     The credentials assoociated with the deferred SSO authentication
     *     session to reactivate.
     *
     * @return
     *     The session identifier associated with the provided credentials,
     *     or null if no session is found.
     */
    protected abstract String getSessionIdentifier(Credentials credentials);

    /**
     * Reactivate the session identified by the provided identifier, if any.
     *
     * @param sessionIdentifier
     *     The identifier of the session to reactivate.
     */
    protected abstract void reactivateSession(String sessionIdentifier);

    /**
     * Invalidate the session identified by the provided identifier, if any.
     *
     * @param sessionIdentifier
     *     The identifier of the session to invalidate.
     */
    protected abstract void invalidateSession(String sessionIdentifier);

}
