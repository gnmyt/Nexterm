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

package org.apache.guacamole.rest.auth;

import java.util.Collections;
import java.util.List;

/**
 * A simple object which describes the result of an authentication operation,
 * including the resulting token.
 */
public class APIAuthenticationResult {

    /**
     * The unique token generated for the user that authenticated.
     */
    private final String authToken;

    /**
     * The username of the user that authenticated.
     */
    private final String username;

    /**
     * The unique identifier of the data source from which this user account
     * came. Although this user account may exist across several data sources
     * (AuthenticationProviders), this will be the unique identifier of the
     * AuthenticationProvider that authenticated this user for the current
     * session.
     */
    private final String dataSource;

    /**
     * The identifiers of all data sources available to this user.
     */
    private final List<String> availableDataSources;

    /**
     * Returns the unique authentication token which identifies the current
     * session.
     *
     * @return
     *     The user's authentication token.
     */
    public String getAuthToken() {
        return authToken;
    }

    /**
     * Returns the user identified by the authentication token associated with
     * the current session.
     *
     * @return
     *      The user identified by this authentication token.
     */
    public String getUsername() {
        return username;
    }

    /**
     * Returns the unique identifier of the data source associated with the user
     * account associated with the current session.
     *
     * @return
     *     The unique identifier of the data source associated with the user
     *     account associated with the current session.
     */
    public String getDataSource() {
        return dataSource;
    }

    /**
     * Returns the identifiers of all data sources available to the user
     * associated with the current session.
     *
     * @return
     *     The identifiers of all data sources available to the user associated
     *     with the current session.
     */
    public List<String> getAvailableDataSources() {
        return availableDataSources;
    }

    /**
     * Create a new APIAuthenticationResult object containing the given data.
     *
     * @param authToken
     *     The unique token generated for the user that authenticated, to be
     *     used for the duration of their session.
     *
     * @param username
     *     The username of the user owning the given token.
     *
     * @param dataSource
     *     The unique identifier of the AuthenticationProvider which
     *     authenticated the user.
     *
     * @param availableDataSources
     *     The unique identifier of all AuthenticationProviders to which the
     *     user now has access.
     */
    public APIAuthenticationResult(String authToken, String username,
            String dataSource, List<String> availableDataSources) {
        this.authToken = authToken;
        this.username = username;
        this.dataSource = dataSource;
        this.availableDataSources = Collections.unmodifiableList(availableDataSources);
    }

}
