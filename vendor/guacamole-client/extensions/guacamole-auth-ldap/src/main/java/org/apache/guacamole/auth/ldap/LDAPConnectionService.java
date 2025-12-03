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

import org.apache.directory.api.ldap.model.exception.LdapAuthenticationException;
import org.apache.directory.api.ldap.model.exception.LdapException;
import org.apache.directory.api.ldap.model.exception.LdapInvalidDnException;
import org.apache.directory.api.ldap.model.filter.ExprNode;
import org.apache.directory.api.ldap.model.message.SearchRequest;
import org.apache.directory.api.ldap.model.message.SearchRequestImpl;
import org.apache.directory.api.ldap.model.message.SearchScope;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.directory.api.ldap.model.url.LdapUrl;
import org.apache.directory.ldap.client.api.LdapConnectionConfig;
import org.apache.directory.ldap.client.api.LdapNetworkConnection;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.auth.ldap.conf.EncryptionMethod;
import org.apache.guacamole.auth.ldap.conf.LDAPConfiguration;
import org.apache.guacamole.auth.ldap.conf.LDAPSSLProtocol;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for creating and managing connections to LDAP servers.
 */
public class LDAPConnectionService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(LDAPConnectionService.class);

    /**
     * Creates a new instance of LdapNetworkConnection, configured as required
     * to use the given encryption method to communicate with the LDAP server
     * at the given hostname and port, with the specified encryption method,
     * SSL protocol version, and timeout. The returned LdapNetworkConnection is
     * configured for use but is not yet connected nor bound to the LDAP
     * server. It will not be bound until a bind operation is explicitly
     * requested, and will not be connected until it is used in an LDAP
     * operation (such as a bind).
     *
     * @param host
     *     The hostname or IP address of the LDAP server.
     *
     * @param port
     *     The TCP port that the LDAP server is listening on.
     *
     * @param encryptionMethod
     *     The encryption method that should be used to communicate with the
     *     LDAP server.
     * 
     * @param sslProtocol
     *     The SSL protocol version to use to make a secure LDAP configuration,
     *     if SSL or STARTTLS is used.
     *
     * @param timeout
     *     The maximum number of milliseconds to wait for a response from the
     *     LDAP server.
     *
     * @return
     *     A new instance of LdapNetworkConnection which uses the given
     *     encryption method to communicate with the LDAP server at the given
     *     hostname and port.
     *
     * @throws GuacamoleException
     *     If the requested encryption method is actually not implemented (a
     *     bug).
     */
    private LdapNetworkConnection createLDAPConnection(String host, int port,
            EncryptionMethod encryptionMethod, LDAPSSLProtocol sslProtocol,
            int timeout)
            throws GuacamoleException {

        LdapConnectionConfig config = new LdapConnectionConfig();
        config.setLdapHost(host);
        config.setLdapPort(port);
        config.setTimeout(timeout);

        // Map encryption method to proper connection and socket factory
        switch (encryptionMethod) {

            // Unencrypted LDAP connection
            case NONE:
                logger.debug("Connection to LDAP server without encryption.");
                break;

            // LDAP over SSL (LDAPS)
            case SSL:
                logger.debug("Connecting to LDAP server using SSL/TLS.");
                config.setUseSsl(true);
                config.setSslProtocol(sslProtocol.toString());
                break;

            // LDAP + STARTTLS
            case STARTTLS:
                logger.debug("Connecting to LDAP server using STARTTLS.");
                config.setUseTls(true);
                config.setSslProtocol(sslProtocol.toString());
                break;

            // The encryption method, though known, is not actually
            // implemented. If encountered, this would be a bug.
            default:
                throw new GuacamoleUnsupportedException("Unimplemented encryption method: " + encryptionMethod);

        }

        return new LdapNetworkConnection(config);

    }
    
    /**
     * Creates a new instance of LdapNetworkConnection, configured as required
     * to use the given encryption method to communicate with the LDAP server
     * at the given hostname and port with the encryption method and timeout
     * specified, as well. The returned LdapNetworkConnection is configured
     * for use but is not yet connected nor bound to the LDAP server. It will
     * not be bound until a bind operation is explicitly requested, and will
     * not be connected until it is used in an LDAP operation (such as a bind).
     *
     * @param host
     *     The hostname or IP address of the LDAP server.
     *
     * @param port
     *     The TCP port that the LDAP server is listening on.
     *
     * @param encryptionMethod
     *     The encryption method that should be used to communicate with the
     *     LDAP server.
     *
     * @param timeout
     *     The maximum number of milliseconds to wait for a response from the
     *     LDAP server.
     *
     * @return
     *     A new instance of LdapNetworkConnection which uses the given
     *     encryption method to communicate with the LDAP server at the given
     *     hostname and port.
     *
     * @throws GuacamoleException
     *     If the requested encryption method is actually not implemented (a
     *     bug).
     */
    private LdapNetworkConnection createLDAPConnection(String host, int port,
            EncryptionMethod encryptionMethod, int timeout)
            throws GuacamoleException {
        return createLDAPConnection(host, port, encryptionMethod,
                LDAPSSLProtocol.TLSv1_3, timeout);
    }

    /**
     * Creates a new instance of LdapNetworkConnection, configured as required
     * to use whichever encryption method, hostname, and port are requested
     * within guacamole.properties. The returned LdapNetworkConnection is
     * configured for use but is not yet connected nor bound to the LDAP
     * server. It will not be bound until a bind operation is explicitly
     * requested, and will not be connected until it is used in an LDAP
     * operation (such as a bind).
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @return
     *     A new LdapNetworkConnection instance which has already been
     *     configured to use the encryption method, hostname, and port
     *     requested within guacamole.properties.
     *
     * @throws GuacamoleException
     *     If an error occurs while parsing guacamole.properties, or if the
     *     requested encryption method is actually not implemented (a bug).
     */
    private LdapNetworkConnection createLDAPConnection(LDAPConfiguration config)
            throws GuacamoleException {
        return createLDAPConnection(
                config.getServerHostname(),
                config.getServerPort(),
                config.getEncryptionMethod(),
                config.getSslProtocol(),
                config.getNetworkTimeout());
    }

    /**
     * Creates a new instance of LdapNetworkConnection, configured as required
     * to use whichever encryption method, hostname, and port are specified
     * within the given LDAP URL. The returned LdapNetworkConnection is
     * configured for use but is not yet connected nor bound to the LDAP
     * server. It will not be bound until a bind operation is explicitly
     * requested, and will not be connected until it is used in an LDAP
     * operation (such as a bind).
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param url
     *     The LDAP URL containing the details which should be used to connect
     *     to the LDAP server.
     *
     * @return
     *     A new LdapNetworkConnection instance which has already been
     *     configured to use the encryption method, hostname, and port
     *     specified within the given LDAP URL.
     *
     * @throws GuacamoleException
     *     If the given URL is not a valid LDAP URL, or if the encryption
     *     method indicated by the URL is known but not actually implemented (a
     *     bug).
     */
    private LdapNetworkConnection createLDAPConnection(LDAPConfiguration config,
            String url) throws GuacamoleException {

        // Parse provided LDAP URL
        LdapUrl ldapUrl;
        try {
            ldapUrl = new LdapUrl(url);
        }
        catch (LdapException e) {
            logger.debug("Cannot connect to LDAP URL \"{}\": URL is invalid.", url, e);
            throw new GuacamoleServerException("Invalid LDAP URL.", e);
        }

        // Retrieve hostname from URL, bailing out if no hostname is present
        String host = ldapUrl.getHost();
        if (host == null || host.isEmpty()) {
            logger.debug("Cannot connect to LDAP URL \"{}\": no hostname is present.", url);
            throw new GuacamoleServerException("LDAP URL contains no hostname.");
        }

        // Parse encryption method from URL scheme
        EncryptionMethod encryptionMethod = EncryptionMethod.NONE;
        if (LdapUrl.LDAPS_SCHEME.equals(ldapUrl.getScheme()))
            encryptionMethod = EncryptionMethod.SSL;

        // Use STARTTLS for otherwise unencrypted ldap:// URLs if the main
        // LDAP connection requires STARTTLS
        else if (config.getEncryptionMethod() == EncryptionMethod.STARTTLS) {
            logger.debug("Using STARTTLS for LDAP URL \"{}\" as the main LDAP "
                    + "connection described in guacamole.properties is "
                    + "configured to use STARTTLS.", url);
            encryptionMethod = EncryptionMethod.STARTTLS;
        }

        // If no post is specified within the URL, use the default port
        // dictated by the encryption method
        int port = ldapUrl.getPort();
        if (port < 1)
            port = encryptionMethod.DEFAULT_PORT;

        return createLDAPConnection(host, port, encryptionMethod,
                config.getSslProtocol(), config.getNetworkTimeout());

    }

    /**
     * Binds to the LDAP server indicated by the given LdapNetworkConnection
     * using the given credentials. If the LdapNetworkConnection is not yet
     * connected, an LDAP connection is first established. The provided
     * credentials will be stored within the LdapConnectionConfig of the given
     * LdapNetworkConnection. If the bind operation fails, the given
     * LdapNetworkConnection is automatically closed.
     *
     * @param ldapConnection
     *     The LdapNetworkConnection describing the connection to the LDAP
     *     server. This LdapNetworkConnection is modified as a result of this
     *     call and will be automatically closed if this call fails.
     *
     * @param userDN
     *     The DN of the user to bind as, or null to bind anonymously.
     *
     * @param password
     *     The password to use when binding as the specified user, or null to
     *     attempt to bind without a password.
     *
     * @return
     *     A bound LDAP connection, or null if the connection could not be
     *     bound.
     */
    private LdapNetworkConnection bindAs(LdapNetworkConnection ldapConnection,
            String bindUser, String password) {

        // Add credentials to existing config
        LdapConnectionConfig config = ldapConnection.getConfig();
        config.setName(bindUser);
        config.setCredentials(password);

        try {
            // Connect and bind using provided credentials
            ldapConnection.bind();
        }

        // Disconnect if an authentication error occurs, but log that failure
        // only at the debug level (such failures are expected)
        catch (LdapAuthenticationException e) {
            ldapConnection.close();
            logger.debug("Bind attempt with LDAP server as user \"{}\" failed.",
                    bindUser, e);
            return null;
        }

        // Disconnect for all other bind failures, as well, logging those at
        // the error level
        catch (LdapException e) {
            ldapConnection.close();
            logger.error("Binding with the LDAP server at \"{}\" as user "
                    + "\"{}\" failed: {}", config.getLdapHost(), bindUser,
                    e.getMessage());
            logger.debug("Unable to bind to LDAP server.", e);
            return null;
        }

        return ldapConnection;

    }

    /**
     * Binds to the LDAP server indicated by a given LdapNetworkConnection
     * using the credentials that were used to bind another
     * LdapNetworkConnection. If the LdapNetworkConnection about to be bound is
     * not yet connected, an LDAP connection is first established. The
     * credentials from the other LdapNetworkConnection will be stored within
     * the LdapConnectionConfig of the given LdapNetworkConnection. If the bind
     * operation fails, the given LdapNetworkConnection is automatically
     * closed.
     *
     * @param ldapConnection
     *     The LdapNetworkConnection describing the connection to the LDAP
     *     server. This LdapNetworkConnection is modified as a result of this
     *     call and will be automatically closed if this call fails.
     *
     * @param useCredentialsFrom
     *     A bound LdapNetworkConnection whose bind credentials should be
     *     copied for use within this bind operation.
     *
     * @return
     *     A bound LDAP connection, or null if the connection could not be
     *     bound.
     */
    private LdapNetworkConnection bindAs(LdapNetworkConnection ldapConnection,
            LdapNetworkConnection useCredentialsFrom) {

        // Copy bind username and password from original config
        LdapConnectionConfig ldapConfig = useCredentialsFrom.getConfig();
        String username = ldapConfig.getName();
        String password = ldapConfig.getCredentials();

        // Parse bind username as an LDAP DN
        Dn userDN;
        try {
            userDN = new Dn(username);
        }
        catch (LdapInvalidDnException e) {
            logger.error("Credentials of existing connection cannot be used. "
                    + "The username used (\"{}\") is not a valid DN.", username);
            logger.debug("Cannot bind using invalid DN.", e);
            ldapConnection.close();
            return null;
        }

        // Bind using username/password from existing connection
        return bindAs(ldapConnection, userDN.getName(), password);

    }

    /**
     * Binds to the LDAP server using the provided user DN and password. The
     * hostname, port, and encryption method of the LDAP server are determined
     * from guacamole.properties.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param bindUser
     *     The DN or UPN of the user to bind as, or null to bind anonymously.
     *
     * @param password
     *     The password to use when binding as the specified user, or null to
     *     attempt to bind without a password.
     *
     * @return
     *     A bound LDAP connection, or null if the connection could not be
     *     bound.
     *
     * @throws GuacamoleException
     *     If an error occurs while parsing guacamole.properties, or if the
     *     configured encryption method is actually not implemented (a bug).
     */
    public LdapNetworkConnection bindAs(LDAPConfiguration config,
            String bindUser, String password) throws GuacamoleException {
        return bindAs(createLDAPConnection(config), bindUser, password);
    }

    /**
     * Binds to the LDAP server indicated by the given LDAP URL using the
     * credentials that were used to bind an existing LdapNetworkConnection.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param url
     *     The LDAP URL containing the details which should be used to connect
     *     to the LDAP server.
     *
     * @param useCredentialsFrom
     *     A bound LdapNetworkConnection whose bind credentials should be
     *     copied for use within this bind operation.
     *
     * @return
     *     A bound LDAP connection, or null if the connection could not be
     *     bound.
     *
     * @throws GuacamoleException
     *     If the given URL is not a valid LDAP URL, or if the encryption
     *     method indicated by the URL is known but not actually implemented (a
     *     bug).
     */
    public LdapNetworkConnection bindAs(LDAPConfiguration config, String url,
            LdapNetworkConnection useCredentialsFrom)
            throws GuacamoleException {
        return bindAs(createLDAPConnection(config, url), useCredentialsFrom);
    }

    /**
     * Generate a SearchRequest object using the given Base DN and filter
     * and retrieving other properties from the LDAP configuration service.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param baseDn
     *     The LDAP Base DN at which to search the search.
     * 
     * @param filter
     *     A string representation of a LDAP filter to use for the search.
     * 
     * @return
     *     The properly-configured SearchRequest object.
     * 
     * @throws GuacamoleException
     *     If an error occurs retrieving any of the configuration values.
     */
    public SearchRequest getSearchRequest(LDAPConfiguration config, Dn baseDn,
            ExprNode filter) throws GuacamoleException {
        
        SearchRequest searchRequest = new SearchRequestImpl();
        searchRequest.setBase(baseDn);
        searchRequest.setDerefAliases(config.getDereferenceAliases());
        searchRequest.setScope(SearchScope.SUBTREE);
        searchRequest.setFilter(filter);
        searchRequest.setSizeLimit(config.getMaxResults());
        searchRequest.setTimeLimit(config.getOperationTimeout());
        searchRequest.setTypesOnly(false);
        
        if (config.getFollowReferrals())
            searchRequest.followReferrals();
        
        return searchRequest;
    }

}
