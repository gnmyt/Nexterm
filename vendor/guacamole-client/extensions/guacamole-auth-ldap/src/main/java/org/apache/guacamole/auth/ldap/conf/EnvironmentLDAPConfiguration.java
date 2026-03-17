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

package org.apache.guacamole.auth.ldap.conf;

import java.util.Collection;
import org.apache.directory.api.ldap.model.filter.ExprNode;
import org.apache.directory.api.ldap.model.message.AliasDerefMode;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.environment.Environment;

/**
 * LDAPConfiguration implementation that reads its configuration details from
 * guacamole.properties.
 */
public class EnvironmentLDAPConfiguration implements LDAPConfiguration {

    /**
     * The Guacamole server environment.
     */
    private final Environment environment;

    /**
     * The default configuration options for all parameters.
     */
    private static final LDAPConfiguration DEFAULT = new DefaultLDAPConfiguration();

    /**
     * Creates a new EnvironmentLDAPConfiguration that reads its configuration
     * details from guacamole.properties, as exposed by the given Environment.
     *
     * @param environment
     *     The Guacamole server environment.
     */
    public EnvironmentLDAPConfiguration(Environment environment) {
        this.environment = environment;
    }

    @Override
    public String appliesTo(String username) throws GuacamoleException {
        return username;
    }

    @Override
    public String getServerHostname() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_HOSTNAME,
            DEFAULT.getServerHostname()
        );
    }

    @Override
    public int getServerPort() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_PORT,
            getEncryptionMethod().DEFAULT_PORT
        );
    }

    @Override
    public Collection<String> getUsernameAttributes() throws GuacamoleException {
        return environment.getPropertyCollection(
            LDAPGuacamoleProperties.LDAP_USERNAME_ATTRIBUTE,
            DEFAULT.getUsernameAttributes()
        );
    }

    @Override
    public Dn getUserBaseDN() throws GuacamoleException {
        return environment.getRequiredProperty(
            LDAPGuacamoleProperties.LDAP_USER_BASE_DN
        );
    }

    @Override
    public Dn getConfigurationBaseDN() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_CONFIG_BASE_DN,
            DEFAULT.getConfigurationBaseDN()
        );
    }

    @Override
    public Collection<String> getGroupNameAttributes() throws GuacamoleException {
        return environment.getPropertyCollection(
            LDAPGuacamoleProperties.LDAP_GROUP_NAME_ATTRIBUTE,
            DEFAULT.getGroupNameAttributes()
        );
    }

    @Override
    public Dn getGroupBaseDN() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_GROUP_BASE_DN,
            DEFAULT.getGroupBaseDN()
        );
    }

    @Override
    public String getSearchBindDN() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_SEARCH_BIND_DN,
            DEFAULT.getSearchBindDN()
        );
    }

    @Override
    public String getSearchBindPassword() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_SEARCH_BIND_PASSWORD,
            DEFAULT.getSearchBindPassword()
        );
    }

    @Override
    public EncryptionMethod getEncryptionMethod() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_ENCRYPTION_METHOD,
            DEFAULT.getEncryptionMethod()
        );
    }
    
    @Override
    public LDAPSSLProtocol getSslProtocol() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_SSL_PROTOCOL,
            DEFAULT.getSslProtocol()
        );
    }

    @Override
    public int getMaxResults() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_MAX_SEARCH_RESULTS,
            DEFAULT.getMaxResults()
        );
    }

    @Override
    public AliasDerefMode getDereferenceAliases() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_DEREFERENCE_ALIASES,
            DEFAULT.getDereferenceAliases()
        );
    }

    @Override
    public boolean getFollowReferrals() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_FOLLOW_REFERRALS,
            DEFAULT.getFollowReferrals()
        );
    }

    @Override
    public int getMaxReferralHops() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_MAX_REFERRAL_HOPS,
            DEFAULT.getMaxReferralHops()
        );
    }

    @Override
    public ExprNode getUserSearchFilter() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_USER_SEARCH_FILTER,
            DEFAULT.getUserSearchFilter()
        );
    }

    @Override
    public ExprNode getGroupSearchFilter() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_GROUP_SEARCH_FILTER,
            DEFAULT.getGroupSearchFilter()
        );
    }

    @Override
    public int getOperationTimeout() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_OPERATION_TIMEOUT,
            DEFAULT.getOperationTimeout()
        );
    }

    @Override
    public int getNetworkTimeout() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_NETWORK_TIMEOUT,
            DEFAULT.getNetworkTimeout()
        );
    }

    @Override
    public Collection<String> getAttributes() throws GuacamoleException {
        return environment.getPropertyCollection(
            LDAPGuacamoleProperties.LDAP_USER_ATTRIBUTES,
            DEFAULT.getAttributes()
        );
    }
    
    @Override
    public String getMemberAttribute() throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_MEMBER_ATTRIBUTE,
            DEFAULT.getMemberAttribute()
        );
    }

    @Override
    public MemberAttributeType getMemberAttributeType()
            throws GuacamoleException {
        return environment.getProperty(
            LDAPGuacamoleProperties.LDAP_MEMBER_ATTRIBUTE_TYPE,
            DEFAULT.getMemberAttributeType()
        );
    }

}
