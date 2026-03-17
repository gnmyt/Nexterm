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

package org.apache.guacamole.auth.ldap;

import org.apache.guacamole.auth.ldap.user.UserLDAPConfiguration;
import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.directory.api.ldap.model.entry.Attribute;
import org.apache.directory.api.ldap.model.entry.Entry;
import org.apache.directory.api.ldap.model.exception.LdapException;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.directory.ldap.client.api.LdapNetworkConnection;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.auth.ldap.conf.ConfigurationService;
import org.apache.guacamole.auth.ldap.conf.LDAPConfiguration;
import org.apache.guacamole.auth.ldap.group.UserGroupService;
import org.apache.guacamole.auth.ldap.user.LDAPAuthenticatedUser;
import org.apache.guacamole.auth.ldap.user.LDAPUserContext;
import org.apache.guacamole.auth.ldap.user.UserService;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Credentials;
import org.apache.guacamole.token.TokenName;
import org.apache.guacamole.net.auth.credentials.CredentialsInfo;
import org.apache.guacamole.net.auth.credentials.GuacamoleInvalidCredentialsException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service providing convenience functions for the LDAP AuthenticationProvider
 * implementation.
 */
public class AuthenticationProviderService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(AuthenticationProviderService.class);
    
    /**
     * The prefix that will be used when generating tokens.
     */
    public static final String LDAP_TOKEN_PREFIX = "LDAP_";

    /**
     * Regular expression that extracts the Windows / Active Directory domain
     * from a username in either of the following formats: down-level logon
     * ("DOMAIN\\username") or UPN ("username@domain"). If the username is in
     * "DOMAIN\\username" format, the domain will be stored in the first
     * capturing group. If the username is in UPN format, the domain will be
     * stored in the second capturing group.
     */
    private static final Pattern LDAP_USERNAME_DOMAIN = Pattern.compile("^(.+)\\\\.*$|^.*@(.+)$");

    /**
     * The index of the capturing group in {@link #LDAP_USERNAME_DOMAIN} that
     * captures the domain of a username in down-level logon format
     * ("DOMAIN\\username").
     */
    private static final int LDAP_USERNAME_DOMAIN_DOWN_LEVEL_GROUP = 1;

    /**
     * The index of the capturing group in {@link #LDAP_USERNAME_DOMAIN} that
     * captures the domain of a username in UPN format ("username@domain").
     */
    private static final int LDAP_USERNAME_DOMAIN_UPN_GROUP = 2;

    /**
     * The name of parameter token that will contain the domain extracted from
     * the LDAP user's username, if applicable.
     */
    public static final String LDAP_DOMAIN_TOKEN = LDAP_TOKEN_PREFIX + "DOMAIN";

    /**
     * Service for creating and managing connections to LDAP servers.
     */
    @Inject
    private LDAPConnectionService ldapService;

    /**
     * Service for retrieving LDAP server configuration information.
     */
    @Inject
    private ConfigurationService confService;

    /**
     * Service for retrieving users and their corresponding LDAP DNs.
     */
    @Inject
    private UserService userService;

    /**
     * Service for retrieving user groups.
     */
    @Inject
    private UserGroupService userGroupService;

    /**
     * Provider for AuthenticatedUser objects.
     */
    @Inject
    private Provider<LDAPAuthenticatedUser> authenticatedUserProvider;

    /**
     * Provider for UserContext objects.
     */
    @Inject
    private Provider<LDAPUserContext> userContextProvider;

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
    private Dn getUserBindDN(LDAPConfiguration config, String username)
            throws GuacamoleException {

        // If a search DN is provided, search the LDAP directory for the DN
        // corresponding to the given username
        String searchBindLogon = config.getSearchBindDN();
        if (searchBindLogon != null) {

            // Create an LDAP connection using the search account
            LdapNetworkConnection searchConnection = ldapService.bindAs(config,
                searchBindLogon, config.getSearchBindPassword());

            // Warn of failure to find
            if (searchConnection == null) {
                logger.error("Unable to bind using search DN \"{}\"",
                        searchBindLogon);
                return null;
            }

            try {

                // Retrieve all DNs associated with the given username
                List<Dn> userDNs = userService.getUserDNs(config, searchConnection, username);
                if (userDNs.isEmpty())
                    return null;

                // Warn if multiple DNs exist for the same user
                if (userDNs.size() != 1) {
                    logger.warn("Multiple DNs possible for user \"{}\": {}", username, userDNs);
                    return null;
                }

                // Return the single possible DN
                return userDNs.get(0);

            }

            // Always disconnect
            finally {
                searchConnection.close();
            }

        }

        // Otherwise, derive user DN from base DN
        return userService.deriveUserDN(config, username);

    }

    /**
     * Returns a new UserLDAPConfiguration that is connected to an LDAP server
     * associated with the Guacamole user having the given username and bound
     * using the provided password. All LDAP servers associated with the given
     * user are tried until the connection and authentication attempt succeeds.
     * If no LDAP servers are available, or no LDAP servers are associated with
     * the given user, null is returned. The Guacamole username will be
     * internally translated to a fully-qualified LDAP DN according to the
     * configuration of the LDAP server that is ultimately chosen.
     *
     * @param username
     *      The username of the Guacamole user to bind as.
     *
     * @param password
     *      The password of the user to bind as.
     *
     * @return
     *      A new UserLDAPConfiguration which is bound to an LDAP server using
     *      the provided credentials, or null if no LDAP servers are available
     *      for the given user or connecting/authenticating has failed.
     *
     * @throws GuacamoleException
     *      If configuration information for the user's LDAP server(s) cannot
     *      be retrieved.
     */
    private UserLDAPConfiguration getLDAPConfiguration(String username,
            String password) throws GuacamoleException {

        // Get all LDAP server configurations
        Collection<? extends LDAPConfiguration> configs = confService.getLDAPConfigurations();
        if (configs.isEmpty()) {
            logger.info("Skipping LDAP authentication as no LDAP servers are configured.");
            return null;
        }

        // Try each possible LDAP configuration until the TCP connection and
        // authentication are successful
        for (LDAPConfiguration config : configs) {

            // Attempt connection only if username matches
            String translatedUsername = config.appliesTo(username);
            if (translatedUsername == null) {
                logger.debug("LDAP server \"{}\" does not match username \"{}\".", config.getServerHostname(), username);
                continue;
            }

            logger.debug("LDAP server \"{}\" matched username \"{}\" as \"{}\".",
                    config.getServerHostname(), username, translatedUsername);

            // Derive DN of user within this LDAP server
            Dn bindDn = getUserBindDN(config, translatedUsername);
            if (bindDn == null || bindDn.isEmpty()) {
                logger.info("Unable to determine DN of user \"{}\" using LDAP "
                        + "server \"{}\". Proceeding with next server...",
                        username, config.getServerHostname());
                continue;
            }

            // Attempt bind (authentication)
            LdapNetworkConnection ldapConnection = ldapService.bindAs(config, bindDn.getName(), password);
            if (ldapConnection == null) {
                logger.info("Unable to bind as user \"{}\" against LDAP "
                        + "server \"{}\". Proceeding with next server...",
                        username, config.getServerHostname());
                continue;
            }

            // Connection and bind were successful
            logger.info("User \"{}\" was successfully authenticated by LDAP server \"{}\".", username, config.getServerHostname());
            return new UserLDAPConfiguration(config, translatedUsername, bindDn, ldapConnection);

        }

        // No LDAP connection/authentication attempt succeeded
        logger.info("User \"{}\" did not successfully authenticate against any LDAP server.", username);
        return null;

    }
    
    /**
     * Returns an AuthenticatedUser representing the user authenticated by the
     * given credentials. Also adds custom LDAP attributes to the
     * AuthenticatedUser.
     *
     * @param credentials
     *     The credentials to use for authentication.
     *
     * @return
     *     An AuthenticatedUser representing the user authenticated by the
     *     given credentials.
     *
     * @throws GuacamoleException
     *     If an error occurs while authenticating the user, or if access is
     *     denied.
     */
    public LDAPAuthenticatedUser authenticateUser(Credentials credentials)
            throws GuacamoleException {
        
        String username = credentials.getUsername();
        String password = credentials.getPassword();
        
        // Username and password are required
        if (username == null
                || username.isEmpty()
                || password == null
                || password.isEmpty()) {
            throw new GuacamoleInvalidCredentialsException(
                    "Anonymous bind is not currently allowed by the LDAP"
                    + " authentication provider.", CredentialsInfo.USERNAME_PASSWORD);
        }

        UserLDAPConfiguration config = getLDAPConfiguration(username, password);
        if (config == null)
            throw new GuacamoleInvalidCredentialsException("Invalid login.",
                    CredentialsInfo.USERNAME_PASSWORD);

        try {

            // Retrieve group membership of the user that just authenticated
            Set<String> effectiveGroups =
                    userGroupService.getParentUserGroupIdentifiers(config, config.getBindDN());

            // Return AuthenticatedUser if bind succeeds
            LDAPAuthenticatedUser authenticatedUser = authenticatedUserProvider.get();

            authenticatedUser.init(config, credentials,
                    getUserTokens(config, credentials), effectiveGroups);

            return authenticatedUser;
        }

        catch (GuacamoleException | RuntimeException | Error e) {
            config.close();
            throw e;
        }

    }

    /**
     * Returns the Windows / Active Directory domain included in the username
     * of the provided user credentials. If the username does not contain a
     * domain, null is returned.
     *
     * @param credentials
     *     The credentials used for authentication.
     *
     * @return
     *     The domain name within the username of the provided credentials, or
     *     null if no domain is present.
     */
    private String getUserDomain(Credentials credentials) {

        // Extract domain from username (not necessarily present)
        String username = credentials.getUsername();
        Matcher matcher = LDAP_USERNAME_DOMAIN.matcher(username);
        if (!matcher.find())
            return null;

        String dlDomain = matcher.group(LDAP_USERNAME_DOMAIN_DOWN_LEVEL_GROUP);
        String upnDomain = matcher.group(LDAP_USERNAME_DOMAIN_UPN_GROUP);

        // The two domain formats are mutually exclusive. If any format is
        // present, the other must be absent unless there is a bug in the
        // way the domains are parsed
        assert(dlDomain == null || upnDomain == null);

        // Use whichever domain format is present
        return dlDomain != null ? dlDomain : upnDomain;

    }

    /**
     * Returns parameter tokens generated based on details specific to the user
     * currently bound under the given LDAP connection. Both LDAP attributes on
     * the user's associated LDAP object and the credentials submitted by the user
     * to Guacamole are considered. If any tokens are to be derived from LDAP
     * attributes, those attributes must be explicitly listed in
     * guacamole.properties. If no tokens are applicable, an empty map is returned.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param credentials
     *     The credentials to use for authentication.
     *
     * @return
     *     A map of parameter tokens. These tokens are generated based on
     *     the attributes of the user currently bound under the given LDAP connection
     *     and the user's credentials. The map's keys are the canonicalized attribute
     *     names with an "LDAP_" prefix, and the values are the corresponding attribute
     *     values. If the domain name is extracted from the user's credentials, it is added
     *     to the map with the key "LDAP_DOMAIN". If no applicable tokens are found,
     *     the method returns an empty map.
     *
     * @throws GuacamoleException
     *     If an error occurs retrieving the user DN or the attributes.
     */
    private Map<String, String> getUserTokens(ConnectedLDAPConfiguration config, Credentials credentials)
            throws GuacamoleException {

        // Get attributes from configuration information
        Collection<String> attrList = config.getAttributes();

        // If there are no attributes there is no reason to search LDAP
        if (attrList.isEmpty())
            return Collections.<String, String>emptyMap();

        // Build LDAP query parameters
        String[] attrArray = attrList.toArray(new String[attrList.size()]);

        Map<String, String> tokens = new HashMap<>();
        try {

            // Get LDAP attributes by querying LDAP
            Entry userEntry = config.getLDAPConnection().lookup(config.getBindDN(), attrArray);
            if (userEntry == null)
                return Collections.<String, String>emptyMap();

            Collection<Attribute> attributes = userEntry.getAttributes();
            if (attributes == null)
                return Collections.<String, String>emptyMap();

            // Convert each retrieved attribute into a corresponding token
            for (Attribute attr : attributes) {
                tokens.put(TokenName.canonicalize(attr.getId(),
                        LDAP_TOKEN_PREFIX), attr.getString());
            }
        }
        catch (LdapException e) {
            throw new GuacamoleServerException("Could not query LDAP user attributes.", e);
        }

        // Extract the domain (ie: Windows / Active Directory domain) from the
        // user's credentials
        String domainName = getUserDomain(credentials);
        if (domainName != null)
            tokens.put(LDAP_DOMAIN_TOKEN, domainName);

        return tokens;

    }

    /**
     * Returns a UserContext object initialized with data accessible to the
     * given AuthenticatedUser.
     *
     * @param authenticatedUser
     *     The AuthenticatedUser to retrieve data for.
     *
     * @return
     *     A UserContext object initialized with data accessible to the given
     *     AuthenticatedUser.
     *
     * @throws GuacamoleException
     *     If the UserContext cannot be created due to an error.
     */
    public LDAPUserContext getUserContext(AuthenticatedUser authenticatedUser)
            throws GuacamoleException {

        if (authenticatedUser instanceof LDAPAuthenticatedUser) {

            LDAPAuthenticatedUser ldapAuthenticatedUser = (LDAPAuthenticatedUser) authenticatedUser;
            ConnectedLDAPConfiguration config = ldapAuthenticatedUser.getLDAPConfiguration();

            try {

                // Build user context by querying LDAP
                LDAPUserContext userContext = userContextProvider.get();
                userContext.init(ldapAuthenticatedUser);
                return userContext;

            }

            // Always disconnect
            finally {
                config.close();
            }
        }

        return null;

    }

}
