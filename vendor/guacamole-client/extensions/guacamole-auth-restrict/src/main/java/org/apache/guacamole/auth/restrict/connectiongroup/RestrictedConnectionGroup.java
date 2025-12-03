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

package org.apache.guacamole.auth.restrict.connectiongroup;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.restrict.Restrictable;
import org.apache.guacamole.auth.restrict.RestrictionVerificationService;
import org.apache.guacamole.auth.restrict.form.HostRestrictionField;
import org.apache.guacamole.auth.restrict.form.TimeRestrictionField;
import org.apache.guacamole.calendar.RestrictionType;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.GuacamoleTunnel;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.DelegatingConnectionGroup;
import org.apache.guacamole.protocol.GuacamoleClientInformation;

/**
 * A ConnectionGroup implementation that wraps an existing ConnectionGroup,
 * providing additional ability to control access to the ConnectionGroup.
 */
public class RestrictedConnectionGroup extends DelegatingConnectionGroup implements Restrictable {
    
    /**
     * The remote address of the client from which the current user logged in.
     */
    private final String remoteAddress;
    
    /**
     * The name of the attribute that contains a list of weekdays and times (UTC)
     * that this connection group can be accessed. The presence of values within
     * this attribute will automatically restrict use of the connection group
     * at any times that are not specified.
     */
    public static final String RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME = "guac-restrict-time-allowed";
    
    /**
     * The name of the attribute that contains a list of weekdays and times (UTC)
     * that this connection group cannot be accessed. Denied times will always
     * take precedence over allowed times. The presence of this attribute without
     * guac-restrict-time-allowed will deny access only during the times listed
     * in this attribute, allowing access at all other times. The presence of
     * this attribute along with the guac-restrict-time-allowed attribute will
     * deny access at any times that overlap with the allowed times.
     */
    public static final String RESTRICT_TIME_DENIED_ATTRIBUTE_NAME = "guac-restrict-time-denied";
    
    /**
     * The name of the attribute that contains a list of hosts from which a user
     * may access this connection group. The presence of this attribute will
     * restrict access to only users accessing Guacamole from the list of hosts
     * contained in the attribute, subject to further restriction by the
     * guac-restrict-hosts-denied attribute.
     */
    public static final String RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME = "guac-restrict-hosts-allowed";
    
    /**
     * The name of the attribute that contains a list of hosts from which
     * a user may not access this connection group. The presence of this
     * attribute, absent the guac-restrict-hosts-allowed attribute, will allow
     * access from all hosts except the ones listed in this attribute. The
     * presence of this attribute coupled with the guac-restrict-hosts-allowed
     * attribute will block access from any hosts in this list, overriding any
     * that may be allowed.
     */
    public static final String RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME = "guac-restrict-hosts-denied";
    
    /**
     * The list of all connection group attributes provided by this
     * ConnectionGroup implementation.
     */
    public static final List<String> RESTRICT_CONNECTIONGROUP_ATTRIBUTES = Arrays.asList(
            RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME,
            RESTRICT_TIME_DENIED_ATTRIBUTE_NAME,
            RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME,
            RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME
    );
    
    /**
     * The form containing the list of fields for the attributes provided
     * by this ConnectionGroup implementation.
     */
    public static final Form RESTRICT_CONNECTIONGROUP_FORM = new Form("restrict-login-form",
            Arrays.asList(
                    new TimeRestrictionField(RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME),
                    new TimeRestrictionField(RESTRICT_TIME_DENIED_ATTRIBUTE_NAME),
                    new HostRestrictionField(RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME),
                    new HostRestrictionField(RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME)
            )
    );
    
    /**
     * Wraps the given ConnectionGroup object, providing capability of further
     * restricting connection group access beyond the default access control
     * provided by other modules.
     *
     * @param connectionGroup
     *     The ConnectionGroup object to wrap.
     * 
     * @param remoteAddress
     *     The remote address of the client from which the current user logged
     *     in.
     */
    public RestrictedConnectionGroup(ConnectionGroup connectionGroup, String remoteAddress) {
        super(connectionGroup);
        this.remoteAddress = remoteAddress;
    }
    
    /**
     * Returns the original ConnectionGroup object wrapped by this
     * RestrictConnectionGroup.
     *
     * @return
     *     The wrapped ConnectionGroup object.
     */
    public ConnectionGroup getUndecorated() {
        return getDelegateConnectionGroup();
    }
    
    @Override
    public Map<String, String> getAttributes() {

        // Create independent, mutable copy of attributes
        Map<String, String> attributes = new HashMap<>(super.getAttributes());
        
        // Loop through extension-specific attributes and add them where no
        // values exist, so that they show up in the web UI.
        for (String attribute : RESTRICT_CONNECTIONGROUP_ATTRIBUTES) {
            String value = attributes.get(attribute);
            if (value == null || value.isEmpty())
                attributes.put(attribute, null);
        }

        return attributes;

    }

    @Override
    public void setAttributes(Map<String, String> attributes) {

        // Create independent, mutable copy of attributes
        attributes = new HashMap<>(attributes);

        // Loop through extension-specific attributes, only sending ones
        // that are non-null and non-empty to the underlying storage mechanism.
        for (String attribute : RESTRICT_CONNECTIONGROUP_ATTRIBUTES) {
            String value = attributes.get(attribute);
            if (value != null && value.isEmpty())
                attributes.put(attribute, null);
        }

        super.setAttributes(attributes);

    }
    
    @Override
    public GuacamoleTunnel connect(GuacamoleClientInformation info,
            Map<String, String> tokens) throws GuacamoleException {
        
        // Verify restrictions for this connection group.
        RestrictionVerificationService.verifyConnectionRestrictions(this, remoteAddress);
        
        // Connect
        return super.connect(info, tokens);
        
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
