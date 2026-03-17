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

/**
 * REST API response that reports the result of attempting to authenticate the
 * user using SSL/TLS client authentication. The information within this
 * result is intentionally opaque and must be resubmitted in a separate
 * authentication request for authentication to finally succeed or fail.
 */
public class OpaqueAuthenticationResult {

    /**
     * An arbitrary value representing the result of authenticating the
     * current user.
     */
    private final String state;

    /**
     * Creates a new OpaqueAuthenticationResult containing the given opaque
     * state value. Successful authentication results must be indistinguishable
     * from unsuccessful results with respect to this value. Only using this
     * value within ANOTHER authentication attempt can determine whether
     * authentication is successful.
     *
     * @param state
     *     An arbitrary value representing the result of authenticating the
     *     current user.
     */
    public OpaqueAuthenticationResult(String state) {
        this.state = state;
    }

    /**
     * Returns an arbitrary value representing the result of authenticating the
     * current user. This value may be resubmitted as the "state" parameter of
     * an authentication request beneath the primary URI of the web application
     * to finalize the authentication procedure and determine whether the
     * operation has succeeded or failed.
     *
     * @return
     *     An arbitrary value representing the result of authenticating the
     *     current user.
     */
    public String getState() {
        return state;
    }

}
