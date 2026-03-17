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

import java.util.Collection;
import java.util.List;
import org.apache.directory.api.ldap.model.filter.ExprNode;
import org.apache.directory.api.ldap.model.message.AliasDerefMode;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.directory.ldap.client.api.LdapNetworkConnection;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.ldap.conf.EncryptionMethod;
import org.apache.guacamole.auth.ldap.conf.LDAPConfiguration;
import org.apache.guacamole.auth.ldap.conf.LDAPSSLProtocol;
import org.apache.guacamole.auth.ldap.conf.MemberAttributeType;

/**
 * LDAPConfiguration implementation that is associated with an
 * LdapNetworkConnection to the configured LDAP server.
 */
public class ConnectedLDAPConfiguration implements LDAPConfiguration, AutoCloseable {

    /**
     * The wrapped LDAPConfiguration.
     */
    private final LDAPConfiguration config;

    /**
     * The connection to the LDAP server represented by this configuration.
     */
    private final LdapNetworkConnection connection;

    /**
     * The LDAP DN that was used to bind with the LDAP server to produce
     * {@link #connection}.
     */
    private final Dn bindDn;

    /**
     * Creates a new ConnectedLDAPConfiguration that associates the given
     * LdapNetworkConnection with the given LDAPConfiguration. All functions
     * inherited from the LDAPConfiguration interface are delegated to the
     * given LDAPConfiguration. It is the responsibility of the caller to
     * ensure the provided LdapNetworkConnection is closed after it is no
     * longer needed.
     *
     * @param config
     *      The LDAPConfiguration to wrap.
     *
     * @param bindDn
     *      The LDAP DN that was used to bind with the LDAP server to produce
     *      the given LdapNetworkConnection.
     *
     * @param connection
     *      The connection to the LDAP server represented by the given
     *      configuration.
     */
    public ConnectedLDAPConfiguration(LDAPConfiguration config, Dn bindDn, LdapNetworkConnection connection) {
        this.config = config;
        this.bindDn = bindDn;
        this.connection = connection;
    }

    /**
     * Returns the LdapNetworkConnection for the connection to the LDAP server
     * represented by this configuration. The lifecycle of this connection is
     * managed externally. The connection is not guaranteed to still be
     * connected.
     *
     * @return
     *     The LdapNetworkConnection for the connection to the LDAP server
     *     represented by this configuration.
     */
    public LdapNetworkConnection getLDAPConnection() {
        return connection;
    }

    /**
     * Returns the LDAP DN that was used to bind with the LDAP server to
     * produce the LdapNetworkConnection associated with this
     * ConnectedLDAPConfiguration.
     *
     * @return
     *     The LDAP DN that was used to bind with the LDAP server.
     */
    public Dn getBindDN() {
        return bindDn;
    }

    @Override
    public void close() {
        connection.close();
    }

    @Override
    public String appliesTo(String username) throws GuacamoleException {
        return config.appliesTo(username);
    }

    @Override
    public String getServerHostname() throws GuacamoleException {
        return config.getServerHostname();
    }

    @Override
    public int getServerPort() throws GuacamoleException {
        return config.getServerPort();
    }

    @Override
    public Collection<String> getUsernameAttributes() throws GuacamoleException {
        return config.getUsernameAttributes();
    }

    @Override
    public Dn getUserBaseDN() throws GuacamoleException {
        return config.getUserBaseDN();
    }

    @Override
    public Dn getConfigurationBaseDN() throws GuacamoleException {
        return config.getConfigurationBaseDN();
    }

    @Override
    public Collection<String> getGroupNameAttributes() throws GuacamoleException {
        return config.getGroupNameAttributes();
    }

    @Override
    public Dn getGroupBaseDN() throws GuacamoleException {
        return config.getGroupBaseDN();
    }

    @Override
    public String getSearchBindDN() throws GuacamoleException {
        return config.getSearchBindDN();
    }

    @Override
    public String getSearchBindPassword() throws GuacamoleException {
        return config.getSearchBindPassword();
    }

    @Override
    public EncryptionMethod getEncryptionMethod() throws GuacamoleException {
        return config.getEncryptionMethod();
    }
    
    @Override
    public LDAPSSLProtocol getSslProtocol() throws GuacamoleException {
        return config.getSslProtocol();
    }

    @Override
    public int getMaxResults() throws GuacamoleException {
        return config.getMaxResults();
    }

    @Override
    public AliasDerefMode getDereferenceAliases() throws GuacamoleException {
        return config.getDereferenceAliases();
    }

    @Override
    public boolean getFollowReferrals() throws GuacamoleException {
        return config.getFollowReferrals();
    }

    @Override
    public int getMaxReferralHops() throws GuacamoleException {
        return config.getMaxReferralHops();
    }

    @Override
    public ExprNode getUserSearchFilter() throws GuacamoleException {
        return config.getUserSearchFilter();
    }

    @Override
    public ExprNode getGroupSearchFilter() throws GuacamoleException {
        return config.getGroupSearchFilter();
    }

    @Override
    public int getOperationTimeout() throws GuacamoleException {
        return config.getOperationTimeout();
    }

    @Override
    public int getNetworkTimeout() throws GuacamoleException {
        return config.getNetworkTimeout();
    }

    @Override
    public Collection<String> getAttributes() throws GuacamoleException {
        return config.getAttributes();
    }

    @Override
    public String getMemberAttribute() throws GuacamoleException {
        return config.getMemberAttribute();
    }

    @Override
    public MemberAttributeType getMemberAttributeType() throws GuacamoleException {
        return config.getMemberAttributeType();
    }

}
