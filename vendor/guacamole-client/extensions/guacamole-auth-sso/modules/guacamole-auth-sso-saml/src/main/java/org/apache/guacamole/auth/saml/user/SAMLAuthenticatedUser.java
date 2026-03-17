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

package org.apache.guacamole.auth.saml.user;

import com.google.inject.Inject;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.saml.acs.AssertedIdentity;
import org.apache.guacamole.auth.saml.conf.ConfigurationService;
import org.apache.guacamole.auth.sso.user.SSOAuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.token.TokenName;

/**
 * A SAML-specific implementation of AuthenticatedUser, associating a SAML
 * identity and particular set of credentials with the SAML authentication
 * provider.
 */
public class SAMLAuthenticatedUser extends SSOAuthenticatedUser {

    /**
     * The prefix that should be prepended to all parameter tokens generated
     * from SAML attributes.
     */
    private static final String SAML_ATTRIBUTE_TOKEN_PREFIX = "SAML_";

    /**
     * Service for retrieving SAML configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Returns a Map of all parameter tokens that should be made available for
     * substitution based on the given {@link AssertedIdentity}. The resulting
     * Map will contain one parameter token for each SAML attribute in the
     * SAML response that originally asserted the user's identity. Attributes
     * that have multiple values will be reduced to a single value, taking the
     * first available value and discarding the remaining values.
     *
     * @param identity
     *     The {@link AssertedIdentity} representing the user identity
     *     asserted by the SAML IdP.
     *
     * @return
     *     A Map of key and single value pairs that should be made available
     *     for substitution as parameter tokens.
     */
    private Map<String, String> getTokens(AssertedIdentity identity) {
        return Collections.unmodifiableMap(identity.getAttributes().entrySet()
                .stream()
                .filter((entry) -> !entry.getValue().isEmpty())
                .collect(Collectors.toMap(
                    (entry) -> TokenName.canonicalize(entry.getKey(), SAML_ATTRIBUTE_TOKEN_PREFIX),
                    (entry) -> entry.getValue().get(0)
                )));
    }

    /**
     * Returns a set of all group memberships asserted by the SAML IdP.
     * 
     * @param identity
     *     The {@link AssertedIdentity} representing the user identity
     *     asserted by the SAML IdP.
     * 
     * @return
     *     A set of all groups that the SAML IdP asserts this user is a
     *     member of.
     *
     * @throws GuacamoleException
     *     If the configuration information necessary to retrieve group
     *     memberships from a SAML response cannot be read.
     */
    private Set<String> getGroups(AssertedIdentity identity)
            throws GuacamoleException {

        List<String> samlGroups = identity.getAttributes().get(confService.getGroupAttribute());
        if (samlGroups == null || samlGroups.isEmpty())
            return Collections.emptySet();

        return Collections.unmodifiableSet(new HashSet<>(samlGroups));

    }

    /**
     * Initializes this AuthenticatedUser using the given
     * {@link AssertedIdentity} and credentials.
     *
     * @param identity
     *     The {@link AssertedIdentity} representing the user identity
     *     asserted by the SAML IdP.
     *
     * @param credentials
     *     The credentials provided when this user was authenticated.
     *
     * @throws GuacamoleException
     *     If configuration information required for processing the user's
     *     identity and group memberships cannot be read.
     */
    public void init(AssertedIdentity identity, Credentials credentials)
            throws GuacamoleException {
        super.init(identity.getUsername(), credentials, getGroups(identity), getTokens(identity));
    }
    
}
