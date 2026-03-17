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

import org.apache.guacamole.net.auth.AuthenticationSession;

/**
 * Representation of an in-progress SSL/TLS authentication attempt.
 */
public class SSLAuthenticationSession extends AuthenticationSession {

    /**
     * The identity asserted by the external SSL termination service.
     */
    private final String identity;

    /**
     * Creates a new AuthenticationSession representing an in-progress SSL/TLS
     * authentication attempt.
     *
     * @param identity
     *     The identity asserted by the external SSL termination service. This
     *     MAY NOT be null.
     *
     * @param expires
     *     The number of milliseconds that may elapse before this session must
     *     be considered invalid.
     */
    public SSLAuthenticationSession(String identity, long expires) {
        super(expires);
        this.identity = identity;
    }

    /**
     * Returns the identity asserted by the external SSL termination service.
     * As authentication will have completed with respect to the SSL
     * termination service by the time this session is created, this will
     * always be non-null.
     *
     * @return
     *     The identity asserted by the external SSL termination service.
     */
    public String getIdentity() {
        return identity;
    }

}
