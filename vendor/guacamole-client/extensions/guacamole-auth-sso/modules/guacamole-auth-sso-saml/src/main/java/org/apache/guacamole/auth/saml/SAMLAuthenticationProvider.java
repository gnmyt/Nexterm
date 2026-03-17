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

package org.apache.guacamole.auth.saml;

import org.apache.guacamole.auth.saml.acs.AssertionConsumerServiceResource;
import org.apache.guacamole.auth.sso.SSOAuthenticationProvider;

/**
 * AuthenticationProvider implementation that authenticates Guacamole users
 * against a SAML SSO Identity Provider (IdP). This module does not provide any
 * storage for connection information, and must be layered with other modules
 * for authenticated users to have access to Guacamole connections.
 */
public class SAMLAuthenticationProvider extends SSOAuthenticationProvider {

    /**
     * Creates a new SAMLAuthenticationProvider that authenticates users
     * against a SAML IdP.
     */
    public SAMLAuthenticationProvider() {
        super(AuthenticationProviderService.class,
                AssertionConsumerServiceResource.class,
                new SAMLAuthenticationProviderModule());
    }

    @Override
    public String getIdentifier() {
        return "saml";
    }

}
