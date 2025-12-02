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

package org.apache.guacamole.auth.restrict.usergroup;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.guacamole.auth.restrict.form.HostRestrictionField;
import org.apache.guacamole.auth.restrict.form.TimeRestrictionField;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.DelegatingUserGroup;
import org.apache.guacamole.net.auth.UserGroup;

/**
 * UserGroup implementation which wraps a UserGroup from another extension and
 * enforces additional restrictions for members of that group.
 */
public class RestrictedUserGroup extends DelegatingUserGroup {
    
    /**
     * The name of the attribute that contains a list of weekdays and times (UTC)
     * that members of a group are allowed to log in. The presence of this
     * attribute will restrict any users who are members of the group to logins
     * only during the times that are contained within the attribute,
     * subject to further restriction by the guac-restrict-time-denied attribute.
     */
    public static final String RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME = "guac-restrict-time-allowed";
    
    /**
     * The name of the attribute that contains a list of weekdays and times (UTC)
     * that members of a group are not allowed to log in. Denied times will
     * always take precedence over allowed times. The presence of this attribute
     * without guac-restrict-time-allowed will deny logins only during the times
     * listed in this attribute, allowing logins at all other times. The
     * presence of this attribute along with the guac-restrict-time-allowed
     * attribute will deny logins at any times that overlap with the allowed
     * times.
     */
    public static final String RESTRICT_TIME_DENIED_ATTRIBUTE_NAME = "guac-restrict-time-denied";
    
    /**
     * The name of the attribute that contains a list of IP addresses from which
     * members of a group are allowed to log in. The presence of this attribute
     * will restrict users to only the list of IP addresses contained in the
     * attribute, subject to further restriction by the
     * guac-restrict-hosts-denied attribute.
     */
    public static final String RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME = "guac-restrict-hosts-allowed";
    
    /**
     * The name of the attribute that contains a list of IP addresses from which
     * members of a group are not allowed to log in. The presence of this
     * attribute, absent the guac-restrict-hosts-allowed attribute, will allow
     * logins from all hosts except the ones listed in this attribute. The
     * presence of this attribute coupled with the guac-restrict-hosts-allowed
     * attribute will block access from any IPs in this list, overriding any
     * that may be allowed.
     */
    public static final String RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME = "guac-restrict-hosts-denied";
    
    /**
     * The list of all user attributes provided by this UserGroup implementation.
     */
    public static final List<String> RESTRICT_USERGROUP_ATTRIBUTES = Arrays.asList(
            RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME,
            RESTRICT_TIME_DENIED_ATTRIBUTE_NAME,
            RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME,
            RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME
    );
    
    /**
     * The form containing the list of fields for the attributes provided
     * by this module.
     */
    public static final Form RESTRICT_LOGIN_FORM = new Form("restrict-login-form",
            Arrays.asList(
                    new TimeRestrictionField(RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME),
                    new TimeRestrictionField(RESTRICT_TIME_DENIED_ATTRIBUTE_NAME),
                    new HostRestrictionField(RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME),
                    new HostRestrictionField(RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME)
            )
    );
    
    
    /**
     * Wraps the given UserGroup object, providing capability of further restricting
     * logins beyond the default restrictions provided by default modules.
     *
     * @param userGroup
     *     The UserGroup object to wrap.
     */
    public RestrictedUserGroup(UserGroup userGroup) {
        super(userGroup);
    }

    /**
     * Returns the UserGroup object wrapped by this RestrictUserGroup.
     *
     * @return
     *     The wrapped UserGroup object.
     */
    public UserGroup getUndecorated() {
        return getDelegateUserGroupGroup();
    }

    @Override
    public Map<String, String> getAttributes() {

        // Create independent, mutable copy of attributes
        Map<String, String> attributes = new HashMap<>(super.getAttributes());
        
        // Loop through extension-specific attributes, adding ones that are
        // empty so that they are displayed in the web UI.
        for (String attribute : RESTRICT_USERGROUP_ATTRIBUTES) {
            String value = attributes.get(attribute);
            if (value == null || value.isEmpty())
                attributes.put(attribute,  null);
        }

        return attributes;

    }

    @Override
    public void setAttributes(Map<String, String> attributes) {

        // Create independent, mutable copy of attributes
        attributes = new HashMap<>(attributes);

        // Loop through extension-specific attributes, only sending ones
        // that are non-null and non-empty to the underlying storage mechanism.
        for (String attribute : RESTRICT_USERGROUP_ATTRIBUTES) {
            String value = attributes.get(attribute);
            if (value != null && value.isEmpty())
                attributes.put(attribute, null);
        }

        super.setAttributes(attributes);

    }

}
