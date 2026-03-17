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

package org.apache.guacamole.auth.ldap.user;

import com.google.inject.Inject;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import org.apache.directory.api.ldap.model.entry.Entry;
import org.apache.directory.api.ldap.model.exception.LdapInvalidDnException;
import org.apache.directory.api.ldap.model.exception.LdapInvalidAttributeValueException;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.directory.api.ldap.model.name.Rdn;
import org.apache.directory.ldap.client.api.LdapNetworkConnection;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.auth.ldap.ConnectedLDAPConfiguration;
import org.apache.guacamole.auth.ldap.conf.LDAPGuacamoleProperties;
import org.apache.guacamole.auth.ldap.ObjectQueryService;
import org.apache.guacamole.auth.ldap.conf.LDAPConfiguration;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.simple.SimpleUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for queries the users visible to a particular Guacamole user
 * according to an LDAP directory.
 */
public class UserService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(UserService.class);

    /**
     * Service for executing LDAP queries.
     */
    @Inject
    private ObjectQueryService queryService;

    /**
     * Returns all Guacamole users accessible to the given user.
     *
     * @param user
     *     The AuthenticatedUser object associated with the user who is
     *     currently authenticated with Guacamole.
     *
     * @return
     *     All users accessible to the user currently bound under the given
     *     LDAP connection, as a map of connection identifier to corresponding
     *     user object.
     *
     * @throws GuacamoleException
     *     If an error occurs preventing retrieval of users.
     */
    public Map<String, User> getUsers(LDAPAuthenticatedUser user)
            throws GuacamoleException {

        ConnectedLDAPConfiguration config = user.getLDAPConfiguration();
        
        // Retrieve all visible user objects
        Collection<String> usernameAttrs = config.getUsernameAttributes();
        Collection<String> attributes = new HashSet<>(usernameAttrs);
        attributes.addAll(config.getAttributes());
        List<Entry> results = queryService.search(
            config,
            config.getLDAPConnection(),
            config.getUserBaseDN(),
            config.getUserSearchFilter(),
            usernameAttrs,
            null,
            attributes
        );

        // Convert retrieved users to map of identifier to Guacamole user object
        return queryService.asMap(results, entry -> {

            // Get username from record
            try {
                String username = queryService.getIdentifier(entry, attributes);
                if (username == null) {
                    logger.warn("User \"{}\" is missing a username attribute "
                            + "and will be ignored.", entry.getDn().toString());
                    return null;
                }
                
                return new SimpleUser(username);
            }
            catch (LdapInvalidAttributeValueException e) {
                
                return null;
            }

        });

    }

    /**
     * Returns a list of all DNs corresponding to the users having the given
     * username. If multiple username attributes are defined, or if uniqueness
     * is not enforced across the username attribute, it is possible that this
     * will return multiple DNs.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param ldapConnection
     *     The connection to the LDAP server to use when querying user DNs.
     *
     * @param username
     *     The username of the user whose corresponding user account DNs are
     *     to be retrieved.
     *
     * @return
     *     A list of all DNs corresponding to the users having the given
     *     username. If no such DNs exist, this list will be empty.
     *
     * @throws GuacamoleException
     *     If an error occurs while querying the user DNs, or if the username
     *     attribute property cannot be parsed within guacamole.properties.
     */
    public List<Dn> getUserDNs(LDAPConfiguration config, LdapNetworkConnection ldapConnection,
            String username) throws GuacamoleException {

        // Retrieve user objects having a matching username
        List<Entry> results = queryService.search(config, ldapConnection,
                config.getUserBaseDN(),
                config.getUserSearchFilter(),
                config.getUsernameAttributes(),
                username,
                Collections.singletonList("dn"));

        // Build list of all DNs for retrieved users
        List<Dn> userDNs = new ArrayList<>(results.size());
        results.forEach(entry -> userDNs.add(entry.getDn()));

        return userDNs;

    }

    /**
     * Determines the DN which corresponds to the user having the given
     * username. The DN will either be derived directly from the user base DN,
     * or queried from the LDAP server, depending on how LDAP authentication
     * has been configured.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param username
     *     The username of the user whose corresponding DN should be returned.
     *
     * @return
     *     The DN which corresponds to the user having the given username.
     *
     * @throws GuacamoleException
     *     If required properties are missing, and thus the user DN cannot be
     *     determined.
     */
    public Dn deriveUserDN(LDAPConfiguration config, String username)
            throws GuacamoleException {

        // Pull username attributes from properties
        List<String> usernameAttributes = new ArrayList<>(config.getUsernameAttributes());

        // We need exactly one base DN to derive the user DN
        if (usernameAttributes.size() != 1) {
            logger.warn(String.format("Cannot directly derive user DN when "
                      + "multiple username attributes are specified. Please "
                      + "define an LDAP search DN using the \"%s\" property "
                      + "in your \"guacamole.properties\".",
                      LDAPGuacamoleProperties.LDAP_SEARCH_BIND_DN.getName()));
            return null;
        }

        // Derive user DN from base DN
        try {
            return new Dn(new Rdn(usernameAttributes.get(0), username),
                config.getUserBaseDN());
        }
        catch (LdapInvalidAttributeValueException | LdapInvalidDnException e) {
            throw new GuacamoleServerException("Error trying to derive user DN.", e);
        }

    }

}
