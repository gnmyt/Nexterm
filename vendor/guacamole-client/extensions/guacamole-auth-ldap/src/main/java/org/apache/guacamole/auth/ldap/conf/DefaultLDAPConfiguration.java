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

import java.util.Collections;
import java.util.List;
import org.apache.directory.api.ldap.model.filter.ExprNode;
import org.apache.directory.api.ldap.model.filter.PresenceNode;
import org.apache.directory.api.ldap.model.message.AliasDerefMode;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;

/**
 * LDAPConfiguration implementation that returns the default values for all
 * configuration parameters. For any configuration parameters that are
 * required (such as {@link #getUserBaseDN()}), an exception is thrown.
 */
public class DefaultLDAPConfiguration implements LDAPConfiguration {
    
    @Override
    public String appliesTo(String username) {
        return null;
    }

    @Override
    public String getServerHostname() {
        return "localhost";
    }

    @Override
    public int getServerPort() {
        return getEncryptionMethod().DEFAULT_PORT;
    }

    @Override
    public List<String> getUsernameAttributes() {
        return Collections.singletonList("uid");
    }

    @Override
    public Dn getUserBaseDN() throws GuacamoleException {
        throw new GuacamoleServerException("All LDAP servers must have a defined user base DN.");
    }

    @Override
    public Dn getConfigurationBaseDN() {
        return null;
    }

    @Override
    public List<String> getGroupNameAttributes() {
        return Collections.singletonList("cn");
    }

    @Override
    public Dn getGroupBaseDN() {
        return null;
    }

    @Override
    public String getSearchBindDN() {
        return null;
    }

    @Override
    public String getSearchBindPassword() {
        return null;
    }

    @Override
    public EncryptionMethod getEncryptionMethod() {
        return EncryptionMethod.NONE;
    }
    
    @Override
    public LDAPSSLProtocol getSslProtocol() {
        return LDAPSSLProtocol.TLSv1_3;
    }

    @Override
    public int getMaxResults() {
        return 1000;
    }

    @Override
    public AliasDerefMode getDereferenceAliases() {
        return AliasDerefMode.NEVER_DEREF_ALIASES;
    }

    @Override
    public boolean getFollowReferrals() {
        return false;
    }

    @Override
    public int getMaxReferralHops() {
        return 5;
    }

    @Override
    public ExprNode getUserSearchFilter() {
        return new PresenceNode("objectClass");
    }

    @Override
    public ExprNode getGroupSearchFilter() {
        return new PresenceNode("objectClass");
    }

    @Override
    public int getOperationTimeout() {
        return 30;
    }

    @Override
    public int getNetworkTimeout() {
        return 30000;
    }

    @Override
    public List<String> getAttributes() {
        return Collections.<String>emptyList();
    }
    
    @Override
    public String getMemberAttribute() {
        return "member";
    }

    @Override
    public MemberAttributeType getMemberAttributeType()
            throws GuacamoleException {
        return MemberAttributeType.DN;
    }

}
