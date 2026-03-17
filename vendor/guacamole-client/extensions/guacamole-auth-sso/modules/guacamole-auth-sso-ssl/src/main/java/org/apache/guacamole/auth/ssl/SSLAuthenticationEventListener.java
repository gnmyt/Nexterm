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

package org.apache.guacamole.auth.ssl;

import com.google.inject.Inject;
import org.apache.guacamole.auth.sso.SSOAuthenticationEventListener;
import org.apache.guacamole.net.auth.Credentials;

/**
 * A Listener that will reactivate or invalidate SSL auth sessions depending on
 * overall auth success or failure.
 */
public class SSLAuthenticationEventListener extends SSOAuthenticationEventListener {

    /**
     * Session manager for generating and maintaining unique tokens to
     * represent the authentication flow of a user who has only partially
     * authenticated.
     *
     * Requires static injection due to the fact that the webapp just calls the
     * constructor directly when creating new Listeners. The instances will not
     * be constructed by guice.
     */
    @Inject
    protected static SSLAuthenticationSessionManager sessionManager;

    @Override
    protected String getSessionIdentifier(Credentials credentials) {
        return AuthenticationProviderService.getSessionIdentifier(credentials);
    }

    @Override
    protected void reactivateSession(String sessionIdentifier) {
        sessionManager.reactivateSession(sessionIdentifier);
    }

    @Override
    protected void invalidateSession(String sessionIdentifier) {
        sessionManager.invalidateSession(sessionIdentifier);
    }

}
