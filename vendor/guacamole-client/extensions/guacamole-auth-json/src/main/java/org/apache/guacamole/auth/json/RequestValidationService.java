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

package org.apache.guacamole.auth.json;

import com.google.inject.Inject;
import inet.ipaddr.IPAddressString;
import java.util.Collection;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Credentials;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for testing the validity of received HTTP requests.
 */
public class RequestValidationService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(RequestValidationService.class);

    /**
     * Service for retrieving configuration information regarding the
     * JSONAuthenticationProvider.
     */
    private ConfigurationService confService;

    /**
     * Create a new instance of the request validation service, with the
     * provided ConfigurationService object used to retrieve configuration
     * properties for this extension.
     *
     * @param confService
     *     The instance of ConfigurationService for retrieving configuration
     *     properties for this extension.
     */
    @Inject
    public RequestValidationService(ConfigurationService confService) {
        this.confService = confService;
    }

    /**
     * Returns whether the given credentials can be used for authentication,
     * taking into account restrictions specified within guacamole.properties.
     *
     * @param credentials
     *     The credentials of the authentication request to test.
     *
     * @return
     *     true if the given credentials come from a trusted source and can be
     *     used for authentication, false otherwise.
     */
    public boolean isAuthenticationAllowed(Credentials credentials) {

        // Pull list of all trusted networks
        Collection<String> trustedNetworks;
        try {
            trustedNetworks = confService.getTrustedNetworks();
        }

        // Deny all requests if restrictions cannot be parsed
        catch (GuacamoleException e) {
            logger.warn("Authentication request from \"{}\" is DENIED due to parse error: {}", credentials.getRemoteAddress(), e.getMessage());
            logger.debug("Error parsing authentication request restrictions from guacamole.properties.", e);
            return false;
        }

        // All requests are allowed if no restrictions are defined
        if (trustedNetworks.isEmpty()) {
            logger.debug("Authentication request from \"{}\" is ALLOWED (no restrictions).", credentials.getRemoteAddress());
            return true;
        }

        // Otherwise ensure that the remote address is part of a trusted network
        for (String network : trustedNetworks) {

            // Request is allowed if any subnet matches
            if (new IPAddressString(network).contains(new IPAddressString(credentials.getRemoteAddress()))) {
                logger.debug("Authentication request from \"{}\" is ALLOWED (matched subnet).", credentials.getRemoteAddress());
                return true;
            }

        }

        // Otherwise request is denied - no subnets matched
        logger.debug("Authentication request from \"{}\" is DENIED (did not match subnet).", credentials.getRemoteAddress());
        return false;

    }

}
