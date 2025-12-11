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

package org.apache.guacamole.net.auth;

import java.util.Set;

/**
 * A user of the Guacamole web application who has been authenticated by an
 * AuthenticationProvider.
 */
public interface AuthenticatedUser extends Identifiable {

    /**
     * The identifier reserved for representing a user that has authenticated
     * anonymously.
     */
    public static final String ANONYMOUS_IDENTIFIER = "";

    /**
     * Returns the AuthenticationProvider that authenticated this user.
     *
     * @return
     *     The AuthenticationProvider that authenticated this user.
     */
    AuthenticationProvider getAuthenticationProvider();

    /**
     * Returns the credentials that the user provided when they successfully
     * authenticated.
     *
     * @return
     *     The credentials provided by the user when they authenticated.
     */
    Credentials getCredentials();

    /**
     * Returns a read-only set of the identifiers of all user groups which
     * apply to this authenticated user. The exact semantics of what user
     * groups apply are up to the implementation, and the user groups within
     * this set may be implied, derived dynamically, inherited through multiple
     * levels of group membership, etc.
     *
     * Note that, as with user identifiers, user group identifiers form the
     * basis of identity which applies across authentication providers. It is
     * expected that any two user groups having the same identifier represent
     * the same group, even if defined by different authentication providers.
     *
     * @return
     *     A read-only set of the identifiers of all user groups which apply
     *     to this authenticated user.
     */
    Set<String> getEffectiveUserGroups();

    /**
     * Invalidates this authenticated user and their associated token such that
     * they are no longer logged in. This function will be automatically
     * invoked when the user logs out, or when their session expires.
     */
    void invalidate();

}
