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

package org.apache.guacamole.auth.jdbc.user;

import org.apache.guacamole.GuacamoleException;

/**
 * A ModeledAuthenticatedUser which is always privileged, returning true for
 * every call to isPrivileged().
 */
public class PrivilegedModeledAuthenticatedUser extends ModeledAuthenticatedUser {

    /**
     * Creates a new PrivilegedModeledAuthenticatedUser which shares the same
     * user identity as the given ModeledAuthenticatedUser. Regardless of the
     * privileges explicitly granted to the given user, the resulting
     * PrivilegedModeledAuthenticatedUser will always assert that it is
     * privileged.
     *
     * @param authenticatedUser
     *     The ModeledAuthenticatedUser that declares the identity of the user
     *     in question.
     */
    public PrivilegedModeledAuthenticatedUser(ModeledAuthenticatedUser authenticatedUser){
        super(authenticatedUser, authenticatedUser.getModelAuthenticationProvider(), authenticatedUser.getUser());
    }

    @Override
    public boolean isPrivileged() throws GuacamoleException {
        return true;
    }

}
