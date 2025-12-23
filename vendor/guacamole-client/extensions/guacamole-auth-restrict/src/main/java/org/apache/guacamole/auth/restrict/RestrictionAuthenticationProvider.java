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

package org.apache.guacamole.auth.restrict;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.restrict.user.RestrictedUserContext;
import org.apache.guacamole.net.auth.AbstractAuthenticationProvider;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.net.auth.UserContext;

/**
 * AuthenticationProvider implementation which provides additional restrictions
 * for users, groups of users, connections, and connection groups, allowing
 * administrators to further control access to Guacamole resources.
 */
public class RestrictionAuthenticationProvider extends AbstractAuthenticationProvider {
    
    @Override
    public String getIdentifier() {
        return "restrict";
    }

    @Override
    public UserContext decorate(UserContext context,
            AuthenticatedUser authenticatedUser, Credentials credentials)
            throws GuacamoleException {

        String remoteAddress = credentials.getRemoteAddress();
        
        // Verify identity of user
        RestrictionVerificationService.verifyLoginRestrictions(context,
                authenticatedUser.getEffectiveUserGroups(), remoteAddress);

        // User has been verified, and authentication should be allowed to
        // continue
        return new RestrictedUserContext(context, remoteAddress,
                authenticatedUser.getEffectiveUserGroups());

    }

}
