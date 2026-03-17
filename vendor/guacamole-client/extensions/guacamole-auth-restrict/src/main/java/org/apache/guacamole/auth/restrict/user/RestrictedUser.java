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

package org.apache.guacamole.auth.restrict.user;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.guacamole.auth.restrict.Restrictable;
import org.apache.guacamole.auth.restrict.RestrictionVerificationService;
import org.apache.guacamole.auth.restrict.form.HostRestrictionField;
import org.apache.guacamole.auth.restrict.form.TimeRestrictionField;
import org.apache.guacamole.calendar.RestrictionType;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.DelegatingUser;
import org.apache.guacamole.net.auth.User;

/**
 * User implementation which wraps a User from another extension and enforces
 * additional restrictions.
 */
public class RestrictedUser extends DelegatingUser implements Restrictable {
    
    /**
     * The remote address of the client from which the current user is logged in.
     */
    private final String remoteAddress;
    
    /**
     * true if the user logged in to Guacamole has administrative privileges
     * for this user object, otherwise false.
     */
    private final boolean hasAdmin;
    
    /**
     * The name of the attribute that contains a list of weekdays and times (UTC)
     * that a user is allowed to log in. The presence of this attribute will
     * restrict the user to logins only during the times that are contained
     * within the attribute, subject to further restriction by the
     * guac-restrict-time-denied attribute.
     */
    public static final String RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME = "guac-restrict-time-allowed";
    
    /**
     * The name of the attribute that contains a list of weekdays and times (UTC)
     * that a user is not allowed to log in. Denied times will always take
     * precedence over allowed times. The presence of this attribute without
     * guac-restrict-time-allowed will deny logins only during the times listed
     * in this attribute, allowing logins at all other times. The presence of
     * this attribute along with the guac-restrict-time-allowed attribute will
     * deny logins at any times that overlap with the allowed times.
     */
    public static final String RESTRICT_TIME_DENIED_ATTRIBUTE_NAME = "guac-restrict-time-denied";
    
    /**
     * The name of the attribute that contains a list of IP addresses from which
     * a user is allowed to log in. The presence of this attribute will restrict
     * users to only the list of IP addresses contained in the attribute, subject
     * to further restriction by the guac-restrict-hosts-denied attribute.
     */
    public static final String RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME = "guac-restrict-hosts-allowed";
    
    /**
     * The name of the attribute that contains a list of IP addresses from which
     * a user is not allowed to log in. The presence of this attribute, absent
     * the guac-restrict-hosts-allowed attribute, will allow logins from all
     * hosts except the ones listed in this attribute. The presence of this
     * attribute coupled with the guac-restrict-hosts-allowed attribute will
     * block access from any IPs in this list, overriding any that may be
     * allowed.
     */
    public static final String RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME = "guac-restrict-hosts-denied";
    
    /**
     * The list of all user attributes provided by this User implementation.
     */
    public static final List<String> RESTRICT_USER_ATTRIBUTES = Arrays.asList(
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
     * Wraps the given User object, providing capability of further restricting
     * logins beyond the default restrictions provided by default modules.
     *
     * @param user
     *     The User object to wrap.
     * 
     * @param remoteAddress
     *     The remote address of the client from which the current user is logged
     *     in.
     */
    public RestrictedUser(User user, String remoteAddress, boolean hasAdmin) {
        super(user);
        this.remoteAddress = remoteAddress;
        this.hasAdmin = hasAdmin;
    }

    /**
     * Returns the User object wrapped by this RestrictUser.
     *
     * @return
     *     The wrapped User object.
     */
    public User getUndecorated() {
        return getDelegateUser();
    }

    @Override
    public Map<String, String> getAttributes() {
        
        // Create independent, mutable copy of attributes
        Map<String, String> attributes = new HashMap<>(super.getAttributes());
        
        // Loop through extension-specific attributes, adding ones that are
        // empty so that they are displayed in the web UI.
        for (String attribute : RESTRICT_USER_ATTRIBUTES) {
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
        for (String attribute : RESTRICT_USER_ATTRIBUTES) {
            
            /* If the user lacks admin access, don't set restriction attributes. */
            if (!hasAdmin) {
                attributes.remove(attribute);
                continue;
            }
            
            /* Replace empty values with null values. */
            String value = attributes.get(attribute);
            if (value != null && value.isEmpty())
                attributes.put(attribute, null);
        }

        super.setAttributes(attributes);

    }
    
    @Override
    public RestrictionType getCurrentTimeRestriction() {
        String allowedTimeString = getAttributes().get(RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME);
        String deniedTimeString = getAttributes().get(RESTRICT_TIME_DENIED_ATTRIBUTE_NAME);
        return RestrictionVerificationService.allowedByTimeRestrictions(allowedTimeString, deniedTimeString);
    }
    
    @Override
    public RestrictionType getCurrentHostRestriction() {
        String allowedHostString = getAttributes().get(RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME);
        String deniedHostString = getAttributes().get(RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME);
        return RestrictionVerificationService.allowedByHostRestrictions(allowedHostString, deniedHostString, remoteAddress);
    }

}
