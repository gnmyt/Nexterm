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

package org.apache.guacamole.auth.ssl.conf;

import java.net.URI;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.properties.URIGuacamoleProperty;

/**
 * A GuacamoleProperty whose value is a wildcard URI. The behavior of this
 * property is identical to URIGuacamoleProperty except that it verifies a
 * wildcard hostname prefix ("*.") is present and strips that prefix from the
 * parsed URI.
 */
public abstract class WildcardURIGuacamoleProperty extends URIGuacamoleProperty {

    /**
     * Regular expression that broadly matches URIs that contain wildcards in
     * their hostname. This regular expression is NOT strict and will match
     * invalid URIs. It is only strict enough to recognize a wildcard hostname
     * prefix.
     */
    private static final Pattern WILDCARD_URI_PATTERN = Pattern.compile("([^:]+://(?:[^@]+@)?)\\*\\.(.*)");

    @Override
    public URI parseValue(String value) throws GuacamoleException {

        if (value == null)
            return null;

        // Verify wildcard prefix is present
        Matcher matcher = WILDCARD_URI_PATTERN.matcher(value);
        if (matcher.matches()) {

            // Strip wildcard prefix from URI and verify a valid hostname is
            // still present
            URI uri = super.parseValue(matcher.group(1) + matcher.group(2));
            if (uri.getHost() != null)
                return uri;

        }

        // All other values are not valid wildcard URIs
        throw new GuacamoleServerException("Value \"" + value
            + "\" is not a valid wildcard URI.");

    }

}
