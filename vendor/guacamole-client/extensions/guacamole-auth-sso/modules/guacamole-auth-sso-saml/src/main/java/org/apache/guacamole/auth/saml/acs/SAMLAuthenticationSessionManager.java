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

package org.apache.guacamole.auth.saml.acs;

import com.google.inject.Singleton;
import org.apache.guacamole.net.auth.AuthenticationSessionManager;

/**
 * Manager service that temporarily stores SAML authentication attempts while
 * the authentication flow is underway.
 */
@Singleton
public class SAMLAuthenticationSessionManager
        extends AuthenticationSessionManager<SAMLAuthenticationSession> {

    /**
     * Returns the identity finally asserted by the SAML IdP at the end of the
     * authentication process represented by the authentication session with
     * the given identifier. If there is no such authentication session, or no
     * valid identity has been asserted by the SAML IdP for that session, null
     * is returned.
     *
     * @param identifier
     *     The unique string returned by the call to defer(). For convenience,
     *     this value may safely be null.
     *
     * @return
     *     The identity finally asserted by the SAML IdP at the end of the
     *     authentication process represented by the authentication session
     *     with the given identifier, or null if there is no such identity.
     */
    public AssertedIdentity getIdentity(String identifier) {

        SAMLAuthenticationSession session = resume(identifier);
        if (session != null)
            return session.getIdentity();

        return null;

    }

}
