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

package org.apache.guacamole.tunnel;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashMap;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;

/**
 * Map which is automatically populated with the name/value pairs of all
 * standardized tokens available for a particular AuthenticatedUser.
 */
public class StandardTokenMap extends HashMap<String, String> {

    /**
     * The name of the token containing the user's username.
     */
    public static final String USERNAME_TOKEN = "GUAC_USERNAME";

    /**
     * The name of the token containing the user's password.
     */
    public static final String PASSWORD_TOKEN = "GUAC_PASSWORD";

    /**
     * The name of the token containing the hostname/address of the machine the
     * user authenticated from.
     */
    public static final String CLIENT_HOSTNAME_TOKEN = "GUAC_CLIENT_HOSTNAME";

    /**
     * The name of the token containing the IP address of the machine the user
     * authenticated from.
     */
    public static final String CLIENT_ADDRESS_TOKEN = "GUAC_CLIENT_ADDRESS";

    /**
     * The name of the token containing the current date (server-local time).
     */
    public static final String DATE_TOKEN = "GUAC_DATE";

    /**
     * The name of the token containing the current time (server-local time).
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
     * Creates a new StandardTokenMap which is pre-populated with the
     * name/value pairs of all standardized tokens available for the given
     * AuthenticatedUser.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser to generate standard tokens for.
     */
    public StandardTokenMap(AuthenticatedUser authenticatedUser) {

        // Add date/time tokens (server-local time)
        Date currentTime = new Date();
        put(DATE_TOKEN, new SimpleDateFormat(DATE_FORMAT).format(currentTime));
        put(TIME_TOKEN, new SimpleDateFormat(TIME_FORMAT).format(currentTime));

        Credentials credentials = authenticatedUser.getCredentials();

        // Add username token
        String username = credentials.getUsername();
        if (username != null)
            put(USERNAME_TOKEN, username);

        // Default to the authenticated user's username for the GUAC_USERNAME
        // token
        else
            put(USERNAME_TOKEN, authenticatedUser.getIdentifier());

        // Add password token
        String password = credentials.getPassword();
        if (password != null)
            put(PASSWORD_TOKEN, password);

        // Add client hostname token
        String hostname = credentials.getRemoteHostname();
        if (hostname != null)
            put(CLIENT_HOSTNAME_TOKEN, hostname);

        // Add client address token
        String address = credentials.getRemoteAddress();
        if (address != null)
            put(CLIENT_ADDRESS_TOKEN, address);

    }

}
