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

import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.directory.ldap.client.api.LdapNetworkConnection;
import org.apache.guacamole.auth.ldap.ConnectedLDAPConfiguration;
import org.apache.guacamole.auth.ldap.conf.LDAPConfiguration;

/**
 * LDAPConfiguration implementation that represents the configuration and
 * network connection of an LDAP that has been bound on behalf of a Guacamole
 * user.
 */
public class UserLDAPConfiguration extends ConnectedLDAPConfiguration {

    /**
     * The username of the associated Guacamole user.
     */
    private final String username;
    
    /**
     * Creates a new UserLDAPConfiguration that associates the given
     * LDAPConfiguration of an LDAP server with the active network connection to
     * that server, as well as the username of the Guacamole user on behalf of
     * whom that connection was established. All functions inherited from the
     * LDAPConfiguration interface are delegated to the given LDAPConfiguration.
     * It is the responsibility of the caller to ensure the provided
     * LdapNetworkConnection is closed after it is no longer needed.
     *
     * @param config
     *      The LDAPConfiguration to wrap.
     *
     * @param username
     *      The username of the associated Guacamole user.
     *
     * @param bindDn
     *      The LDAP DN that was used to bind with the LDAP server to produce
     *      the given LdapNetworkConnection.
     *
     * @param connection
     *      The connection to the LDAP server represented by the given
     *      configuration.
     */
    public UserLDAPConfiguration(LDAPConfiguration config,
            String username, Dn bindDn, LdapNetworkConnection connection) {
        super(config, bindDn, connection);
        this.username = username;
    }

    /**
     * Returns the username of the Guacamole user on behalf of whom the
     * associated LDAP network connection was established.
     *
     * @return
     *     The username of the associated Guacamole user.
     */
    public String getGuacamoleUsername() {
        return username;
    }

}
