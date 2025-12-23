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

import org.apache.guacamole.auth.sso.SSOAuthenticationProvider;

/**
 * Guacamole authentication backend which authenticates users using SSL/TLS
 * client authentication provided by some external SSL termination system. This
 * SSL termination system must be configured to provide access to this same
 * instance of Guacamole and must have both a wildcard certificate and wildcard
 * DNS. No storage for connections is provided - only authentication. Storage
 * must be provided by some other extension.
 */
public class SSLAuthenticationProvider extends SSOAuthenticationProvider {

    /**
     * Creates a new SSLAuthenticationProvider that authenticates users against
     * an external SSL termination system using SSL/TLS client authentication.
     */
    public SSLAuthenticationProvider() {
        super(AuthenticationProviderService.class, SSLClientAuthenticationResource.class,
                new SSLAuthenticationProviderModule());
    }

    @Override
    public String getIdentifier() {
        return "ssl";
    }

}
