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

import org.apache.directory.api.ldap.model.message.AliasDerefMode;
import org.apache.guacamole.properties.BooleanGuacamoleProperty;
import org.apache.guacamole.properties.EnumGuacamoleProperty;
import org.apache.guacamole.properties.IntegerGuacamoleProperty;
import org.apache.guacamole.properties.StringGuacamoleProperty;


/**
 * Provides properties required for use of the LDAP authentication provider.
 * These properties will be read from guacamole.properties when the LDAP
 * authentication provider is used.
 */
public class LDAPGuacamoleProperties {

    /**
     * This class should not be instantiated.
     */
    private LDAPGuacamoleProperties() {}

    /**
     * The base DN to search for Guacamole configurations.
     */
    public static final LdapDnGuacamoleProperty LDAP_CONFIG_BASE_DN =
            new LdapDnGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-config-base-dn"; }

    };

    /**
     * The base DN of users. All users must be contained somewhere within the
     * subtree of this DN. If the LDAP authentication will not be given its own
     * credentials for querying other LDAP users, all users must be direct
     * children of this base DN, varying only by LDAP_USERNAME_ATTRIBUTE.
     */
    public static final LdapDnGuacamoleProperty LDAP_USER_BASE_DN =
            new LdapDnGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-user-base-dn"; }

    };

    /**
     * The base DN of role based access control (RBAC) groups. All groups which
     * will be used for RBAC must be contained somewhere within the subtree of
     * this DN.
     */
    public static final LdapDnGuacamoleProperty LDAP_GROUP_BASE_DN =
            new LdapDnGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-group-base-dn"; }

    };

    /**
     * The attribute or attributes which identify users. One of these
     * attributes must be present within each Guacamole user's record in the
     * LDAP directory. If the LDAP authentication will not be given its own
     * credentials for querying other LDAP users, this list may contain only
     * one attribute, and the concatenation of that attribute and the value of
     * LDAP_USER_BASE_DN must equal the user's full DN.
     */
    public static final StringGuacamoleProperty LDAP_USERNAME_ATTRIBUTE =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-username-attribute"; }

    };

    /**
     * The attribute or attributes which identify user groups. One of these
     * attributes must be present within each Guacamole user group's record in
     * the LDAP directory for that group to be visible.
     */
    public static final StringGuacamoleProperty LDAP_GROUP_NAME_ATTRIBUTE =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-group-name-attribute"; }

    };

    /**
     * The port on the LDAP server to connect to when authenticating users.
     */
    public static final IntegerGuacamoleProperty LDAP_PORT =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-port"; }

    };

    /**
     * The hostname of the LDAP server to connect to when authenticating users.
     */
    public static final StringGuacamoleProperty LDAP_HOSTNAME =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-hostname"; }

    };

    /**
     * The user that the LDAP extension should bind as when searching for the
     * accounts of users attempting to log in. The format of this parameter
     * will vary based on the LDAP server implementation - often it is expected
     * to be in full LDAP DN format; however various LDAP server implementations
     * allow this to be in other formats (e.g. Active Directory allows
     * User Principal Name, or UPN, format). For this reason the configuration
     * allows this to be any string.
     */
    public static final StringGuacamoleProperty LDAP_SEARCH_BIND_DN =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-search-bind-dn"; }

    };

    /**
     * The password to provide to the LDAP server when binding as
     * LDAP_SEARCH_BIND_DN. If LDAP_SEARCH_BIND_DN is not specified, this
     * property has no effect. If this property is not specified, no password
     * will be provided when attempting to bind as LDAP_SEARCH_BIND_DN.
     */
    public static final StringGuacamoleProperty LDAP_SEARCH_BIND_PASSWORD =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-search-bind-password"; }

    };

    /**
     * The encryption method to use when connecting to the LDAP server, if any.
     * The chosen method will also dictate the default port if not already
     * explicitly specified via LDAP_PORT.
     */
    public static final EnumGuacamoleProperty<EncryptionMethod> LDAP_ENCRYPTION_METHOD =
            new EnumGuacamoleProperty<EncryptionMethod>(EncryptionMethod.class) {

        @Override
        public String getName() { return "ldap-encryption-method"; }

    };
    
    public static final EnumGuacamoleProperty<LDAPSSLProtocol> LDAP_SSL_PROTOCOL =
            new EnumGuacamoleProperty<LDAPSSLProtocol>(LDAPSSLProtocol.class) {
    
        @Override
        public String getName() { return "ldap-ssl-protocol"; }
                
    };

    /**
     * The maximum number of results a LDAP query can return.
     */
    public static final IntegerGuacamoleProperty LDAP_MAX_SEARCH_RESULTS =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-max-search-results"; }

    };

    /**
     * Property that controls whether or not the LDAP connection follows
     * (dereferences) aliases as it searches the tree.
     */
    public static final EnumGuacamoleProperty<AliasDerefMode> LDAP_DEREFERENCE_ALIASES =
            new EnumGuacamoleProperty<AliasDerefMode>(
                "never",     AliasDerefMode.NEVER_DEREF_ALIASES,
                "searching", AliasDerefMode.DEREF_IN_SEARCHING,
                "finding",   AliasDerefMode.DEREF_FINDING_BASE_OBJ,
                "always",    AliasDerefMode.DEREF_ALWAYS
            ) {

        @Override
        public String getName() { return "ldap-dereference-aliases"; }

    };

    /**
     * A search filter to apply to user LDAP queries.
     */
    public static final LdapFilterGuacamoleProperty LDAP_USER_SEARCH_FILTER =
            new LdapFilterGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-user-search-filter"; }

    };

    /**
     * A search filter to apply to group LDAP queries.
     */
    public static final LdapFilterGuacamoleProperty LDAP_GROUP_SEARCH_FILTER =
            new LdapFilterGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-group-search-filter"; }

    };

    /**
     * Whether or not we should follow referrals.
     */
    public static final BooleanGuacamoleProperty LDAP_FOLLOW_REFERRALS =
            new BooleanGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-follow-referrals"; }

    };

    /**
     * Maximum number of referral hops to follow.
     */
    public static final IntegerGuacamoleProperty LDAP_MAX_REFERRAL_HOPS =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-max-referral-hops"; }

    };

    /**
     * Number of seconds to wait for LDAP operations to complete.
     */
    public static final IntegerGuacamoleProperty LDAP_OPERATION_TIMEOUT =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-operation-timeout"; }

    };

    /**
     * Number of milliseconds to wait for responses from the LDAP server.
     */
    public static final IntegerGuacamoleProperty LDAP_NETWORK_TIMEOUT =
            new IntegerGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-network-timeout"; }

    };

    /**
     * Custom attribute or attributes to query from Guacamole user's record in
     * the LDAP directory.
     */
    public static final StringGuacamoleProperty LDAP_USER_ATTRIBUTES =
            new StringGuacamoleProperty() {

        @Override
        public String getName() { return "ldap-user-attributes"; }

    };
    
    /**
     * LDAP attribute used to enumerate members of a group in the LDAP directory.
     */
    public static final StringGuacamoleProperty LDAP_MEMBER_ATTRIBUTE =
            new StringGuacamoleProperty() {
      
        @Override
        public String getName() { return "ldap-member-attribute"; }
        
    };

    /**
     * Specify the type of data contained in 'ldap-member-attribute'.
     */
    public static final EnumGuacamoleProperty<MemberAttributeType> LDAP_MEMBER_ATTRIBUTE_TYPE =
            new EnumGuacamoleProperty<MemberAttributeType>(MemberAttributeType.class) {

        @Override
        public String getName() { return "ldap-member-attribute-type"; }

    };

}
