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

import com.fasterxml.jackson.annotation.JsonFormat;
import static com.fasterxml.jackson.annotation.JsonFormat.Feature.ACCEPT_SINGLE_VALUE_AS_ARRAY;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Collection;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.apache.directory.api.ldap.model.filter.ExprNode;
import org.apache.directory.api.ldap.model.message.AliasDerefMode;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.properties.GuacamoleProperty;

/**
 * LDAPConfiguration implementation that is annotated for deserialization by
 * Jackson.
 */
public class JacksonLDAPConfiguration implements LDAPConfiguration {

    /**
     * The regular expressions that match all users that should be routed to
     * the LDAP server represented by this configuration.
     */
    @JsonProperty("match-usernames")
    @JsonFormat(with = ACCEPT_SINGLE_VALUE_AS_ARRAY)
    private List<Pattern> matchUsernames;
    
    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_HOSTNAME}. If
     * not set within the YAML, this will be null.
     */
    @JsonProperty("hostname")
    private String hostname;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_PORT}. If not
     * set within the YAML, this will be null.
     */
    @JsonProperty("port")
    private Integer port;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_USERNAME_ATTRIBUTES}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("username-attribute")
    @JsonFormat(with = ACCEPT_SINGLE_VALUE_AS_ARRAY)
    private List<String> usernameAttributes;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_USER_BASE_DN}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("user-base-dn")
    private String userBaseDn;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_CONFIG_BASE_DN}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("config-base-dn")
    private String configBaseDn;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_GROUP_BASE_DN}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("group-base-dn")
    private String groupBaseDn;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_GROUP_NAME_ATTRIBUTES}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("group-name-attribute")
    @JsonFormat(with = ACCEPT_SINGLE_VALUE_AS_ARRAY)
    private List<String> groupNameAttributes;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_SEARCH_BIND_DN}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("search-bind-dn")
    private String searchBindDn;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_SEARCH_BIND_PASSWORD}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("search-bind-password")
    private String searchBindPassword;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_ENCRYPTION_METHOD}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("encryption-method")
    private String encryptionMethod;
    
    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_SSL_PROTOCOL}. If
     * not set within the YAML, this will be null, and will default to the value
     * specified by the LDAP API library.
     */
    @JsonProperty("ssl-protocol")
    private String sslProtocol;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_MAX_SEARCH_RESULTS}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("max-search-results")
    private Integer maxSearchResults;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_DEREFERENCE_ALIASES}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("dereference-aliases")
    private String dereferenceAliases;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_FOLLOW_REFERRALS}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("follow-referrals")
    private Boolean followReferrals;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_MAX_REFERRAL_HOPS}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("max-referral-hops")
    private Integer maxReferralHops;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_USER_SEARCH_FILTER}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("user-search-filter")
    private String userSearchFilter;
    
    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_GROUP_SEARCH_FILTER}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("group-search-filter")
    private String groupSearchFilter;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_OPERATION_TIMEOUT}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("operation-timeout")
    private Integer operationTimeout;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_NETWORK_TIMEOUT}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("network-timeout")
    private Integer networkTimeout;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_USER_ATTRIBUTES}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("user-attributes")
    @JsonFormat(with = ACCEPT_SINGLE_VALUE_AS_ARRAY)
    private List<String> userAttributes;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_MEMBER_ATTRIBUTE}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("member-attribute")
    private String memberAttribute;

    /**
     * The raw YAML value of {@link LDAPGuacamoleProperties#LDAP_MEMBER_ATTRIBUTE_TYPE}.
     * If not set within the YAML, this will be null.
     */
    @JsonProperty("member-attribute-type")
    private String memberAttributeType;

    /**
     * The default configuration options for all parameters.
     */
    private LDAPConfiguration defaultConfig = new DefaultLDAPConfiguration();

    /**
     * Supplier of default values for LDAP configurations. Unlike
     * {@link java.util.function.Supplier}, the {@link #get()} function of
     * DefaultSupplier may throw a {@link GuacamoleException}.
     *
     * @param <T>
     *    The type of value returned by this DefaultSupplier.
     */
    @FunctionalInterface
    private interface DefaultSupplier<T> {

        /**
         * Returns the value supplied by this DefaultSupplier. The value
         * returned is not cached and may be non-deterministic.
         *
         * @return
         *     The value supplied by this DefaultSupplier.
         *
         * @throws GuacamoleException
         *     If an error occurs while producing/retrieving the value.
         */
        T get() throws GuacamoleException;

    }

    /**
     * Returns the given value, if non-null. If null, the given default value
     * is returned.
     *
     * @param <T>
     *     The type of value accepted and returned.
     *
     * @param value
     *     The possibly null value to return if non-null.
     *
     * @param defaultValue
     *     A function which supplies the value to return if the provided value
     *     is null.
     *     
     * @return
     *     The provided value, if non-null, otherwise the provided default
     *     value.
     *
     * @throws GuacamoleException
     *     If an error occurs while producing/retrieving the default value.
     */
    private <T> T withDefault(T value, DefaultSupplier<T> defaultValue)
            throws GuacamoleException {
        return value != null ? value : defaultValue.get();
    }

    /**
     * Parses and returns the given value, if non-null. If null, the given
     * default value is returned.
     *
     * @param <T>
     *     The type of value accepted and returned.
     *
     * @param property
     *     The GuacamoleProperty implementation to use to parse the provided
     *     String value.
     *
     * @param value
     *     The possibly null value to return if non-null.
     *
     * @param defaultValue
     *     A function which supplies the value to return if the provided value
     *     is null.
     *     
     * @return
     *     The provided value, if non-null, otherwise the provided default
     *     value.
     *
     * @throws GuacamoleException
     *     If an error occurs while producing/retrieving the default value.
     */
    private <T> T withDefault(GuacamoleProperty<T> property, String value,
            DefaultSupplier<T> defaultValue)
            throws GuacamoleException {
        return withDefault(property.parseValue(value), defaultValue);
    }

    /**
     * Sets the LDAPConfiguration that should be used for the default values of
     * any configuration options omitted from the YAML. If not set, an instance
     * of {@link DefaultLDAPConfiguration} will be used.
     *
     * @param defaultConfig
     *     The LDAPConfiguration to use for the default values of any omitted
     *     configuration options.
     */
    public void setDefaults(LDAPConfiguration defaultConfig) {
        this.defaultConfig = defaultConfig;
    }

    @Override
    public String appliesTo(String username) throws GuacamoleException {

        // Match any user by default
        if (matchUsernames == null || matchUsernames.isEmpty())
            return username;
        
        for (Pattern pattern : matchUsernames) {
            Matcher matcher = pattern.matcher(username);
            if (matcher.matches())
                return matcher.groupCount() >= 1 ? matcher.group(1) : username;
        }

        return null;

    }

    @Override
    public String getServerHostname() throws GuacamoleException {
        return withDefault(hostname, defaultConfig::getServerHostname);
    }

    @Override
    public int getServerPort() throws GuacamoleException {
        return withDefault(port, () -> getEncryptionMethod().DEFAULT_PORT);
    }

    @Override
    public Collection<String> getUsernameAttributes() throws GuacamoleException {
        return withDefault(usernameAttributes, defaultConfig::getUsernameAttributes);
    }

    @Override
    public Dn getUserBaseDN() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_USER_BASE_DN,
                userBaseDn, defaultConfig::getUserBaseDN);
    }

    @Override
    public Dn getConfigurationBaseDN() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_CONFIG_BASE_DN,
                configBaseDn, defaultConfig::getConfigurationBaseDN);
    }

    @Override
    public Collection<String> getGroupNameAttributes() throws GuacamoleException {
        return withDefault(groupNameAttributes, defaultConfig::getGroupNameAttributes);
    }

    @Override
    public Dn getGroupBaseDN() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_GROUP_BASE_DN,
                groupBaseDn, defaultConfig::getGroupBaseDN);
    }

    @Override
    public String getSearchBindDN() throws GuacamoleException {
        return withDefault(searchBindDn, defaultConfig::getSearchBindDN);
    }

    @Override
    public String getSearchBindPassword() throws GuacamoleException {
        return withDefault(searchBindPassword, defaultConfig::getSearchBindPassword);
    }

    @Override
    public EncryptionMethod getEncryptionMethod() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_ENCRYPTION_METHOD,
                encryptionMethod, defaultConfig::getEncryptionMethod);
    }
    
    @Override
    public LDAPSSLProtocol getSslProtocol() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_SSL_PROTOCOL,
                sslProtocol, defaultConfig::getSslProtocol);
    }

    @Override
    public int getMaxResults() throws GuacamoleException {
        return withDefault(maxSearchResults, defaultConfig::getMaxResults);
    }

    @Override
    public AliasDerefMode getDereferenceAliases() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_DEREFERENCE_ALIASES,
                dereferenceAliases, defaultConfig::getDereferenceAliases);
    }

    @Override
    public boolean getFollowReferrals() throws GuacamoleException {
        return withDefault(followReferrals, defaultConfig::getFollowReferrals);
    }

    @Override
    public int getMaxReferralHops() throws GuacamoleException {
        return withDefault(maxReferralHops, defaultConfig::getMaxReferralHops);
    }

    @Override
    public ExprNode getUserSearchFilter() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_USER_SEARCH_FILTER,
                userSearchFilter, defaultConfig::getUserSearchFilter);
    }

    @Override
    public ExprNode getGroupSearchFilter() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_GROUP_SEARCH_FILTER,
                groupSearchFilter, defaultConfig::getGroupSearchFilter);
    }

    @Override
    public int getOperationTimeout() throws GuacamoleException {
        return withDefault(operationTimeout, defaultConfig::getOperationTimeout);
    }

    @Override
    public int getNetworkTimeout() throws GuacamoleException {
        return withDefault(networkTimeout, defaultConfig::getNetworkTimeout);
    }

    @Override
    public Collection<String> getAttributes() throws GuacamoleException {
        return withDefault(userAttributes, defaultConfig::getAttributes);
    }
    
    @Override
    public String getMemberAttribute() throws GuacamoleException {
        return withDefault(memberAttribute, defaultConfig::getMemberAttribute);
    }

    @Override
    public MemberAttributeType getMemberAttributeType() throws GuacamoleException {
        return withDefault(LDAPGuacamoleProperties.LDAP_MEMBER_ATTRIBUTE_TYPE,
                memberAttributeType, defaultConfig::getMemberAttributeType);
    }

}
