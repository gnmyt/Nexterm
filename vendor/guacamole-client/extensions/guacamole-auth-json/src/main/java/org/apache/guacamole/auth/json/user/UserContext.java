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

package org.apache.guacamole.auth.json.user;

import com.google.inject.Inject;
import org.apache.guacamole.net.auth.AbstractUserContext;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.User;

/**
 * An implementation of UserContext specific to the JSONAuthenticationProvider
 * which obtains all data from the encrypted JSON provided during
 * authentication.
 */
public class UserContext extends AbstractUserContext {

    /**
     * The identifier reserved for the root connection group.
     */
    public static final String ROOT_CONNECTION_GROUP = DEFAULT_ROOT_CONNECTION_GROUP;

    /**
     * Reference to the AuthenticationProvider associated with this
     * UserContext.
     */
    @Inject
    private AuthenticationProvider authProvider;

    /**
     * Service for deriving Guacamole extension API data from UserData objects.
     */
    @Inject
    private UserDataService userDataService;

    /**
     * The UserData object associated with the user to whom this UserContext
     * belongs.
     */
    private UserData userData;

    /**
     * Initializes this UserContext using the data associated with the provided
     * UserData object.
     *
     * @param userData
     *     The UserData object derived from the JSON data received when the
     *     user authenticated.
     */
    public void init(UserData userData) {
        this.userData = userData;
    }

    @Override
    public User self() {
        return userDataService.getUser(userData);
    }

    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return authProvider;
    }

    @Override
    public Directory<Connection> getConnectionDirectory() {
        return userDataService.getConnectionDirectory(userData);
    }

}
