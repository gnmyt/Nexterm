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

import org.apache.guacamole.net.auth.AuthenticationSession;

/**
 * Representation of an in-progress SAML authentication attempt.
 */
public class SAMLAuthenticationSession extends AuthenticationSession {

    /**
     * The request ID of the SAML request associated with the authentication
     * attempt.
     */
    private final String requestId;

    /**
     * The identity asserted by the SAML IdP, or null if authentication has not
     * yet completed successfully.
     */
    private AssertedIdentity identity = null;

    /**
     * Creates a new AuthenticationSession representing an in-progress SAML
     * authentication attempt.
     *
     * @param requestId
     *     The request ID of the SAML request associated with the
     *     authentication attempt.
     *
     * @param expires
     *     The number of milliseconds that may elapse before this session must
     *     be considered invalid.
     */
    public SAMLAuthenticationSession(String requestId, long expires) {
        super(expires);
        this.requestId = requestId;
    }

    /**
     * {@inheritDoc}
     *
     * <p>If an identity has been asserted by the SAML IdP, this
     * considers also whether the SAML response asserting that identity has
     * expired.
     */
    @Override
    public boolean isValid() {
        return super.isValid() && (identity == null || identity.isValid());
    }

    /**
     * Returns the request ID of the SAML request associated with the
     * authentication attempt.
     *
     * @return
     *     The request ID of the SAML request associated with the
     *     authentication attempt.
     */
    public String getRequestID() {
        return requestId;
    }

    /**
     * Marks this authentication attempt as completed and successful, with the
     * user having been asserted as having the given identity by the SAML IdP.
     *
     * @param identity
     *     The identity asserted by the SAML IdP.
     */
    public void setIdentity(AssertedIdentity identity) {
        this.identity = identity;
    }

    /**
     * Returns the identity asserted by the SAML IdP. If authentication has not
     * yet completed successfully, this will be null.
     *
     * @return
     *     The identity asserted by the SAML IdP, or null if authentication has
     *     not yet completed successfully.
     */
    public AssertedIdentity getIdentity() {
        return identity;
    }

}
