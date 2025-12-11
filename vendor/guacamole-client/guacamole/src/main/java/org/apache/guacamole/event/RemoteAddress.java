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

package org.apache.guacamole.event;

import java.util.regex.Pattern;
import org.apache.guacamole.net.auth.Credentials;

/**
 * Loggable representation of the remote address of a user, including any
 * intervening proxies noted by "X-Forwarded-For". This representation takes
 * into account the fact that "X-Forwarded-For" may come from an untrusted
 * source, logging such addresses within square brackets alongside the trusted
 * source IP.
 */
public class RemoteAddress implements LoggableDetail {

    /**
     * Regular expression which matches any IPv4 address.
     */
    private static final String IPV4_ADDRESS_REGEX = "([0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3}\\.[0-9]{1,3})";

    /**
     * Regular expression which matches any IPv6 address.
     */
    private static final String IPV6_ADDRESS_REGEX = "([0-9a-fA-F]*(:[0-9a-fA-F]*){0,7})";

    /**
     * Regular expression which matches any IP address, regardless of version.
     */
    private static final String IP_ADDRESS_REGEX = "(" + IPV4_ADDRESS_REGEX + "|" + IPV6_ADDRESS_REGEX + ")";

    /**
     * Regular expression which matches any Port Number.
     */
    private static final String PORT_NUMBER_REGEX = "(:[0-9]{1,5})?";

    /**
     * Pattern which matches valid values of the de-facto standard
     * "X-Forwarded-For" header.
     */
    private static final Pattern X_FORWARDED_FOR = Pattern.compile("^" + IP_ADDRESS_REGEX + PORT_NUMBER_REGEX + "(, " + IP_ADDRESS_REGEX + PORT_NUMBER_REGEX + ")*$");

    /**
     * The credentials supplied by the user when they authenticated.
     */
    private final Credentials creds;

    /**
     * Creates a new RemoteAddress representing the source address of the HTTP
     * request that provided the given Credentials.
     *
     * @param creds
     *     The Credentials associated with the request whose source address
     *     should be represented by this RemoteAddress.
     */
    public RemoteAddress(Credentials creds) {
        this.creds = creds;
    }

    @Override
    public String toString() {

        String remoteAddress = creds.getRemoteAddress();

        // Log X-Forwarded-For, if present and valid
        String header = creds.getHeader("X-Forwarded-For");
        if (header != null && X_FORWARDED_FOR.matcher(header).matches())
            return "[" + header + ", " + remoteAddress + "]";

        // If header absent or invalid, just use source IP
        return remoteAddress;

    }

}
