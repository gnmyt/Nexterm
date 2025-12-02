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

package org.apache.guacamole.auth.cas;

import org.apache.guacamole.auth.sso.SSOAuthenticationProvider;
import org.apache.guacamole.auth.sso.SSOResource;

/**
 * Guacamole authentication backend which authenticates users using an
 * arbitrary external system implementing CAS. No storage for connections is
 * provided - only authentication. Storage must be provided by some other
 * extension.
 */
public class CASAuthenticationProvider extends SSOAuthenticationProvider {
    
    /**
     * Creates a new CASAuthenticationProvider that authenticates users
     * against an CAS service
     */
    public CASAuthenticationProvider() {
        super(AuthenticationProviderService.class,
                SSOResource.class, new CASAuthenticationProviderModule());
    }
    
    @Override
    public String getIdentifier() {
        return "cas";
    }

}
