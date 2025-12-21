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

package org.apache.guacamole.net.event;

import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.event.listener.Listener;

/**
 * An event which is triggered whenever a user's credentials fail to be
 * authenticated. The credentials that failed to be authenticated are included
 * within this event, and can be retrieved using getCredentials().
 */
public class AuthenticationFailureEvent implements AuthenticationProviderEvent,
        CredentialEvent, FailureEvent {

    /**
     * The credentials which failed authentication.
     */
    private final Credentials credentials;

    /**
     * The AuthenticationProvider that encountered the failure. This may be
     * null if the AuthenticationProvider is not known, such as if the failure
     * is caused by every AuthenticationProvider passively refusing to
     * authenticate the user but without explicitly rejecting the user
     * (returning null for calls to {@link AuthenticationProvider#authenticateUser(org.apache.guacamole.net.auth.Credentials)}),
     * or if the failure is external to any installed AuthenticationProvider
     * (such as within a {@link Listener}.
     */
    private final AuthenticationProvider authProvider;

    /**
     * The Throwable that was thrown resulting in the failure, if any. This
     * may be null if authentication failed without a known error, such as if
     * the failure is caused by every AuthenticationProvider passively refusing
     * to authenticate the user but without explicitly rejecting the user
     * (returning null for calls to {@link AuthenticationProvider#authenticateUser(org.apache.guacamole.net.auth.Credentials)}).
     */
    private final Throwable failure;

    /**
     * Creates a new AuthenticationFailureEvent which represents a failure
     * to authenticate the given credentials where there is no specific
     * AuthenticationProvider nor Throwable associated with the failure.
     *
     * @param credentials
     *     The credentials which failed authentication.
     */
    public AuthenticationFailureEvent(Credentials credentials) {
        this(credentials, null);
    }

    /**
     * Creates a new AuthenticationFailureEvent which represents a failure
     * to authenticate the given credentials where there is no specific
     * AuthenticationProvider causing the failure.
     *
     * @param credentials
     *     The credentials which failed authentication.
     *
     * @param failure
     *     The Throwable that was thrown resulting in the failure, or null if
     *     there is no such Throwable.
     */
    public AuthenticationFailureEvent(Credentials credentials, Throwable failure) {
        this(credentials, null, failure);
    }

    /**
     * Creates a new AuthenticationFailureEvent which represents a failure
     * to authenticate the given credentials.
     *
     * @param credentials
     *     The credentials which failed authentication.
     *
     * @param authProvider
     *     The AuthenticationProvider that caused the failure, or null if there
     *     is no such AuthenticationProvider.
     *
     * @param failure
     *     The Throwable that was thrown resulting in the failure, or null if
     *     there is no such Throwable.
     */
    public AuthenticationFailureEvent(Credentials credentials,
            AuthenticationProvider authProvider, Throwable failure) {
        this.credentials = credentials;
        this.authProvider = authProvider;
        this.failure = failure;
    }

    @Override
    public Credentials getCredentials() {
        return credentials;
    }

    /**
     * {@inheritDoc}
     *
     * <p>NOTE: In the case of an authentication failure, cases where this may
     * be null include if authentication failed without a definite single
     * AuthenticationProvider causing that failure, such as if the failure is
     * caused by every AuthenticationProvider passively refusing to
     * authenticate the user but without explicitly rejecting the user
     * (returning null for calls to {@link AuthenticationProvider#authenticateUser(org.apache.guacamole.net.auth.Credentials)}),
     * or if the failure is external to any installed AuthenticationProvider
     * (such as within a {@link Listener}.
     */
    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return authProvider;
    }

    /**
     * {@inheritDoc}
     *
     * <p>NOTE: In the case of an authentication failure, cases where this may
     * be null include if authentication failed without a known error, such as
     * if the failure is caused by every AuthenticationProvider passively
     * refusing to authenticate the user but without explicitly rejecting the
     * user (returning null for calls to {@link AuthenticationProvider#authenticateUser(org.apache.guacamole.net.auth.Credentials)}).
     */
    @Override
    public Throwable getFailure() {
        return failure;
    }

}
