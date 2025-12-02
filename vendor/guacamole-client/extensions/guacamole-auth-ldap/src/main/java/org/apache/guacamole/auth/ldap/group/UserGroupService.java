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

package org.apache.guacamole.auth.ldap.group;

import com.google.inject.Inject;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.directory.api.ldap.model.entry.Entry;
import org.apache.directory.api.ldap.model.exception.LdapInvalidAttributeValueException;
import org.apache.directory.api.ldap.model.filter.AndNode;
import org.apache.directory.api.ldap.model.filter.EqualityNode;
import org.apache.directory.api.ldap.model.filter.ExprNode;
import org.apache.directory.api.ldap.model.filter.NotNode;
import org.apache.directory.api.ldap.model.name.Dn;
import org.apache.guacamole.auth.ldap.conf.MemberAttributeType;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.ldap.ConnectedLDAPConfiguration;
import org.apache.guacamole.auth.ldap.ObjectQueryService;
import org.apache.guacamole.auth.ldap.conf.LDAPConfiguration;
import org.apache.guacamole.auth.ldap.user.LDAPAuthenticatedUser;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.net.auth.simple.SimpleUserGroup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for querying user group membership and retrieving user groups
 * visible to a particular Guacamole user.
 */
public class UserGroupService {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(UserGroupService.class);

    /**
     * Service for executing LDAP queries.
     */
    @Inject
    private ObjectQueryService queryService;

    /**
     * Returns the base search filter which should be used to retrieve user
     * groups which do not represent Guacamole connections. As excluding the
     * guacConfigGroup object class may not work as expected if it is not
     * defined (may always return zero results), it should only be explicitly
     * excluded if it is expected to have been defined.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @return
     *     The base search filter which should be used to retrieve user groups.
     *
     * @throws GuacamoleException
     *     If guacamole.properties cannot be parsed.
     */
    private ExprNode getGroupSearchFilter(LDAPConfiguration config) throws GuacamoleException {

        // Use filter defined by "ldap-group-search-filter" as basis for all
        // retrieval of user groups
        ExprNode groupFilter = config.getGroupSearchFilter();

        // Explicitly exclude guacConfigGroup object class only if it should
        // be assumed to be defined (query may fail due to no such object
        // class existing otherwise)
        if (config.getConfigurationBaseDN() != null) {
            groupFilter = new AndNode(
                groupFilter,
                new NotNode(new EqualityNode<String>("objectClass", "guacConfigGroup"))
            );
        }

        return groupFilter;
        
    }

    /**
     * Returns all Guacamole user groups accessible to the given user.
     *
     * @param user
     *     The AuthenticatedUser object associated with the user who is
     *     currently authenticated with Guacamole.
     *
     * @return
     *     All user groups accessible to the user currently bound under the
     *     given LDAP connection, as a map of user group identifier to
     *     corresponding UserGroup object.
     *
     * @throws GuacamoleException
     *     If an error occurs preventing retrieval of user groups.
     */
    public Map<String, UserGroup> getUserGroups(LDAPAuthenticatedUser user)
            throws GuacamoleException {

        ConnectedLDAPConfiguration config = user.getLDAPConfiguration();
        
        // Do not return any user groups if base DN is not specified
        Dn groupBaseDN = config.getGroupBaseDN();
        if (groupBaseDN == null)
            return Collections.emptyMap();

        // Gather all attributes relevant for a group
        String memberAttribute = config.getMemberAttribute();
        Collection<String> groupAttributes = new HashSet<>(config.getGroupNameAttributes());
        groupAttributes.add(memberAttribute);

        // Retrieve all visible user groups which are not guacConfigGroups
        Collection<String> attributes = config.getGroupNameAttributes();
        List<Entry> results = queryService.search(
            config,
            config.getLDAPConnection(),
            groupBaseDN,
            getGroupSearchFilter(config),
            attributes,
            null,
            groupAttributes
        );

        // Convert retrieved user groups to map of identifier to Guacamole
        // user group object
        return queryService.asMap(results, entry -> {

            // Translate entry into UserGroup object having proper identifier
            try {
                String name = queryService.getIdentifier(entry, attributes);
                if (name != null)
                    return new SimpleUserGroup(name);
            }
            catch (LdapInvalidAttributeValueException e) {
                return null;
            }

            // Ignore user groups which lack a name attribute
            logger.debug("User group \"{}\" is missing a name attribute "
                    + "and will be ignored.", entry.getDn().toString());
            return null;

        });

    }

    /**
     * Returns the LDAP entries representing all user groups that the given
     * user is a member of. Only user groups which are readable by the current
     * user will be retrieved.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param userDN
     *     The DN of the user whose group membership should be retrieved.
     *
     * @return
     *     The LDAP entries representing all readable parent user groups of the
     *     user having the given DN.
     *
     * @throws GuacamoleException
     *     If an error occurs preventing retrieval of user groups.
     */
    public List<Entry> getParentUserGroupEntries(ConnectedLDAPConfiguration config, Dn userDN)
            throws GuacamoleException {

        // Do not return any user groups if base DN is not specified
        Dn groupBaseDN = config.getGroupBaseDN();
        if (groupBaseDN == null)
            return Collections.emptyList();

        // memberAttribute specified in properties could contain DN or username 
        MemberAttributeType memberAttributeType = config.getMemberAttributeType();
        String userIDorDN = userDN.toString();
        Collection<String> userAttributes = config.getUsernameAttributes();
        if (memberAttributeType == MemberAttributeType.UID) {
            // Retrieve user objects with userDN
            List<Entry> userEntries = queryService.search(
                config,
                config.getLDAPConnection(),
                userDN,
                config.getUserSearchFilter(),
                0,
                userAttributes);
            // ... there can surely only be one
            if (userEntries.size() != 1)
                logger.warn("user DN \"{}\" does not return unique value "
                        + "and will be ignored", userDN.toString());
            else {
                // determine unique identifier for user
                Entry userEntry = userEntries.get(0);
                try {
                    userIDorDN = queryService.getIdentifier(userEntry,
                                         userAttributes);
                }
                catch (LdapInvalidAttributeValueException e) {
                    logger.error("User group missing identifier: {}",
                            e.getMessage());
                    logger.debug("LDAP exception while getting "
                            + "group identifier.", e);
                }
            }
        }

        // Gather all attributes relevant for a group
        String memberAttribute = config.getMemberAttribute();
        Collection<String> groupAttributes = new HashSet<>(config.getGroupNameAttributes());
        groupAttributes.add(memberAttribute);

        // Get all groups the user is a member of starting at the groupBaseDN,
        // excluding guacConfigGroups
        return queryService.search(
            config,
            config.getLDAPConnection(),
            groupBaseDN,
            getGroupSearchFilter(config),
            Collections.singleton(memberAttribute),
            userIDorDN,
            groupAttributes
        );

    }

    /**
     * Returns the identifiers of all user groups that the given user is a
     * member of. Only identifiers of user groups which are readable by the
     * current user will be retrieved.
     *
     * @param config
     *     The configuration of the LDAP server being queried.
     *
     * @param userDN
     *     The DN of the user whose group membership should be retrieved.
     *
     * @return
     *     The identifiers of all readable parent user groups of the user
     *     having the given DN.
     *
     * @throws GuacamoleException
     *     If an error occurs preventing retrieval of user groups.
     */
    public Set<String> getParentUserGroupIdentifiers(ConnectedLDAPConfiguration config, Dn userDN)
            throws GuacamoleException {

        Collection<String> attributes = config.getGroupNameAttributes();
        List<Entry> userGroups = getParentUserGroupEntries(config, userDN);

        Set<String> identifiers = new HashSet<>(userGroups.size());
        userGroups.forEach(entry -> {

            // Determine unique identifier for user group
            try {
                String name = queryService.getIdentifier(entry, attributes);
                if (name != null)
                    identifiers.add(name);

                // Ignore user groups which lack a name attribute
                else
                    logger.debug("User group \"{}\" is missing a name attribute "
                            + "and will be ignored.", entry.getDn().toString());
            }
            catch (LdapInvalidAttributeValueException e) {
                logger.error("User group missing identifier: {}",
                        e.getMessage());
                logger.debug("LDAP exception while getting group identifier.", e);
            }

        });

        return identifiers;

    }

}
