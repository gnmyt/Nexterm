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

package org.apache.guacamole.token;

import java.text.SimpleDateFormat;
import java.util.Date;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;

/**
 * Utility class which provides access to standardized token names, as well as
 * facilities for generating those tokens from common objects.
 *
 * @deprecated Standard tokens are now supplied by default to the connect()
 * functions of connections and connection groups. Manually generating the
 * standard tokens is not necessary.
 */
@Deprecated
public class StandardTokens {

    /**
     * The name of the username token added via addStandardTokens().
     */
    public static final String USERNAME_TOKEN = "GUAC_USERNAME";

    /**
     * The name of the password token added via addStandardTokens().
     */
    public static final String PASSWORD_TOKEN = "GUAC_PASSWORD";

    /**
     * The name of the client hostname token added via addStandardTokens().
     */
    public static final String CLIENT_HOSTNAME_TOKEN = "GUAC_CLIENT_HOSTNAME";

    /**
     * The name of the client address token added via addStandardTokens().
     */
    public static final String CLIENT_ADDRESS_TOKEN = "GUAC_CLIENT_ADDRESS";

    /**
     * The name of the date token (server-local time) added via
     * addStandardTokens().
     */
    public static final String DATE_TOKEN = "GUAC_DATE";

    /**
     * The name of the time token (server-local time) added via
     * addStandardTokens().
     */
    public static final String TIME_TOKEN = "GUAC_TIME";

    /**
     * The date format that should be used for the date token. This format must
     * be compatible with Java's SimpleDateFormat.
     */
    private static final String DATE_FORMAT = "yyyyMMdd";

    /**
     * The date format that should be used for the time token. This format must
     * be compatible with Java's SimpleDateFormat.
     */
    private static final String TIME_FORMAT = "HHmmss";

    /**
     * This utility class should not be instantiated.
     */
    private StandardTokens() {}

    /**
     * Adds tokens which are standardized by guacamole-ext to the given
     * TokenFilter and which do not require a corresponding Credentials object.
     * These the server date and time (GUAC_DATE and GUAC_TIME respectively).
     *
     * @param filter
     *     The TokenFilter to add standard tokens to.
     */
    public static void addStandardTokens(TokenFilter filter) {

        // Add date/time tokens (server-local time)
        Date currentTime = new Date();
        filter.setToken(DATE_TOKEN, new SimpleDateFormat(DATE_FORMAT).format(currentTime));
        filter.setToken(TIME_TOKEN, new SimpleDateFormat(TIME_FORMAT).format(currentTime));

    }

    /**
     * Adds tokens which are standardized by guacamole-ext to the given
     * TokenFilter using the values from the given Credentials object. These
     * standardized tokens include the current username (GUAC_USERNAME),
     * password (GUAC_PASSWORD), and the server date and time (GUAC_DATE and
     * GUAC_TIME respectively). If either the username or password are not set
     * within the given credentials, the corresponding token(s) will remain
     * unset.
     *
     * @param filter
     *     The TokenFilter to add standard tokens to.
     *
     * @param credentials
     *     The Credentials to use when populating the GUAC_USERNAME and
     *     GUAC_PASSWORD tokens.
     */
    public static void addStandardTokens(TokenFilter filter, Credentials credentials) {

        // Add username token
        String username = credentials.getUsername();
        if (username != null)
            filter.setToken(USERNAME_TOKEN, username);

        // Add password token
        String password = credentials.getPassword();
        if (password != null)
            filter.setToken(PASSWORD_TOKEN, password);

        // Add client hostname token
        String hostname = credentials.getRemoteHostname();
        if (hostname != null)
            filter.setToken(CLIENT_HOSTNAME_TOKEN, hostname);

        // Add client address token
        String address = credentials.getRemoteAddress();
        if (address != null)
            filter.setToken(CLIENT_ADDRESS_TOKEN, address);

        // Add any tokens which do not require credentials
        addStandardTokens(filter);

    }

    /**
     * Adds tokens which are standardized by guacamole-ext to the given
     * TokenFilter using the values from the given AuthenticatedUser object,
     * including any associated credentials. These standardized tokens include
     * the current username (GUAC_USERNAME), password (GUAC_PASSWORD), and the
     * server date and time (GUAC_DATE and GUAC_TIME respectively). If either
     * the username or password are not set within the given user or their
     * provided credentials, the corresponding token(s) will remain unset.
     *
     * @param filter
     *     The TokenFilter to add standard tokens to.
     *
     * @param user
     *     The AuthenticatedUser to use when populating the GUAC_USERNAME and
     *     GUAC_PASSWORD tokens.
     */
    public static void addStandardTokens(TokenFilter filter, AuthenticatedUser user) {

        // Default to the authenticated user's username for the GUAC_USERNAME
        // token
        filter.setToken(USERNAME_TOKEN, user.getIdentifier());

        // Add tokens specific to credentials
        addStandardTokens(filter, user.getCredentials());

    }

}
