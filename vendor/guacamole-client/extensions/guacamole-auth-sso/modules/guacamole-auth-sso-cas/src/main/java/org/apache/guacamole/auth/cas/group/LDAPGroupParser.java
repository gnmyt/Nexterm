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

package org.apache.guacamole.auth.cas.group;

import javax.naming.InvalidNameException;
import javax.naming.ldap.LdapName;
import javax.naming.ldap.Rdn;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * GroupParser that converts group names from LDAP DNs into normal group names,
 * using the last (leftmost) attribute of the DN as the name. Groups may
 * optionally be restricted to only those beneath a specific base DN, or only
 * those using a specific attribute as their last (leftmost) attribute.
 */
public class LDAPGroupParser implements GroupParser {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(LDAPGroupParser.class);

    /**
     * The LDAP attribute to require for all accepted group names. If null, any
     * LDAP attribute will be allowed.
     */
    private final String nameAttribute;

    /**
     * The base DN to require for all accepted group names. If null, ancestor
     * tree structure will not be considered in accepting/rejecting a group.
     */
    private final LdapName baseDn;

    /**
     * Creates a new LDAPGroupParser which applies the given restrictions on
     * any provided group names.
     *
     * @param nameAttribute
     *     The LDAP attribute to require for all accepted group names. This
     *     restriction applies to the last (leftmost) attribute only, which is
     *     always used to determine the name of the group. If null, any LDAP
     *     attribute will be allowed in the last (leftmost) position.
     *
     * @param baseDn
     *     The base DN to require for all accepted group names. If null,
     *     ancestor tree structure will not be considered in
     *     accepting/rejecting a group.
     */
    public LDAPGroupParser(String nameAttribute, LdapName baseDn) {
        this.nameAttribute = nameAttribute;
        this.baseDn = baseDn;
    }

    @Override
    public String parse(String casGroup) {

        // Reject null/empty group names
        if (casGroup == null || casGroup.isEmpty())
            return null;

        // Parse group as an LDAP DN
        LdapName group;
        try {
            group = new LdapName(casGroup);
        }
        catch (InvalidNameException e) {
            logger.debug("CAS group \"{}\" has been rejected as it is not a "
                    + "valid LDAP DN.", casGroup, e);
            return null;
        }

        // Reject any group that is not beneath the base DN
        if (baseDn != null && !group.startsWith(baseDn))
            return null;

        // If a specific name attribute is defined, restrict to groups that
        // use that attribute to distinguish themselves
        Rdn last = group.getRdn(group.size() - 1);
        if (nameAttribute != null && !nameAttribute.equalsIgnoreCase(last.getType()))
            return null;

        // The group name is the string value of the final attribute in the DN
        return last.getValue().toString();

    }

}
