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

package org.apache.guacamole.auth.cas.conf;

import com.google.inject.Inject;
import java.net.URI;
import java.security.PrivateKey;
import javax.naming.ldap.LdapName;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleServerException;
import org.apache.guacamole.auth.cas.group.GroupFormat;
import org.apache.guacamole.environment.Environment;
import org.apache.guacamole.auth.cas.group.GroupParser;
import org.apache.guacamole.auth.cas.group.LDAPGroupParser;
import org.apache.guacamole.auth.cas.group.PlainGroupParser;

/**
 * Service for retrieving configuration information regarding the CAS service.
 */
public class ConfigurationService {

    /**
     * The Guacamole server environment.
     */
    @Inject
    private Environment environment;

    /**
     * Returns the authorization endpoint (URI) of the CAS service as
     * configured with guacamole.properties.
     *
     * @return
     *     The authorization endpoint of the CAS service, as configured with
     *     guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed, or if the authorization
     *     endpoint property is missing.
     */
    public URI getAuthorizationEndpoint() throws GuacamoleException {
        return environment.getRequiredProperty(CASGuacamoleProperties.CAS_AUTHORIZATION_ENDPOINT);
    }

    /**
     * Returns the URI that the CAS service should redirect to after
     * the authentication process is complete, as configured with
     * guacamole.properties. This must be the full URL that a user would enter
     * into their browser to access Guacamole.
     *
     * @return
     *     The URI to redirect the client back to after authentication
     *     is completed, as configured in guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed, or if the redirect URI
     *     property is missing.
     */
    public URI getRedirectURI() throws GuacamoleException {
        return environment.getRequiredProperty(CASGuacamoleProperties.CAS_REDIRECT_URI);
    }

    /**
     * Returns the PrivateKey used to decrypt the credential object
     * sent encrypted by CAS, or null if no key is defined.
     *
     * @return
     *     The PrivateKey used to decrypt the ClearPass
     *     credential returned by CAS.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public PrivateKey getClearpassKey() throws GuacamoleException {
        return environment.getProperty(CASGuacamoleProperties.CAS_CLEARPASS_KEY);
    }

    /**
     * Returns the CAS attribute that should be used to determine group
     * memberships in CAS, such as "memberOf". If no attribute has been
     * specified, null is returned.
     *
     * @return
     *     The attribute name used to determine group memberships in CAS,
     *     null if not defined.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getGroupAttribute() throws GuacamoleException {
        return environment.getProperty(CASGuacamoleProperties.CAS_GROUP_ATTRIBUTE);
    }

    /**
     * Returns the format that CAS is expected to use for its group names, such
     * as {@link GroupFormat#PLAIN} (simple plain-text names) or
     * {@link GroupFormat#LDAP} (fully-qualified LDAP DNs). If not specified,
     * PLAIN is used by default.
     *
     * @return
     *     The format that CAS is expected to use for its group names.
     *
     * @throws GuacamoleException
     *     If the format specified within guacamole.properties is not valid.
     */
    public GroupFormat getGroupFormat() throws GuacamoleException {
        return environment.getProperty(CASGuacamoleProperties.CAS_GROUP_FORMAT, GroupFormat.PLAIN);
    }

    /**
     * Returns the base DN that all LDAP-formatted CAS groups must reside
     * beneath. Any groups that are not beneath this base DN should be ignored.
     * If no such base DN is provided, the tree structure of the ancestors of
     * LDAP-formatted CAS groups should not be considered.
     *
     * @return
     *     The base DN that all LDAP-formatted CAS groups must reside beneath,
     *     or null if the tree structure of the ancestors of LDAP-formatted
     *     CAS groups should not be considered.
     *
     * @throws GuacamoleException
     *     If the provided base DN is not a valid LDAP DN.
     */
    public LdapName getGroupLDAPBaseDN() throws GuacamoleException {
        return environment.getProperty(CASGuacamoleProperties.CAS_GROUP_LDAP_BASE_DN);
    }

    /**
     * Returns the LDAP attribute that should be required for all LDAP-formatted
     * CAS groups. Any groups that do not use this attribute as the last
     * (leftmost) attribute of their DN should be ignored. If no such LDAP
     * attribute is provided, the last (leftmost) attribute should still be
     * used to determine the group name, but the specific attribute involved
     * should not be considered.
     *
     * @return
     *     The LDAP attribute that should be required for all LDAP-formatted
     *     CAS groups, or null if any attribute should be allowed.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public String getGroupLDAPAttribute() throws GuacamoleException {
        return environment.getProperty(CASGuacamoleProperties.CAS_GROUP_LDAP_ATTRIBUTE);
    }

    /**
     * Returns a GroupParser instance that can be used to parse CAS group
     * names. The parser returned will take into account the configured CAS
     * group format, as well as any configured LDAP-specific restrictions.
     *
     * @return
     *     A GroupParser instance that can be used to parse CAS group names as
     *     configured in guacamole.properties.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    public GroupParser getGroupParser() throws GuacamoleException {
        switch (getGroupFormat()) {

            // Simple, plain-text groups
            case PLAIN:
                return new PlainGroupParser();

            // LDAP DNs
            case LDAP:
                return new LDAPGroupParser(getGroupLDAPAttribute(), getGroupLDAPBaseDN());

            default:
                throw new GuacamoleServerException("Unsupported CAS group format: " + getGroupFormat());

        }
    }

}
