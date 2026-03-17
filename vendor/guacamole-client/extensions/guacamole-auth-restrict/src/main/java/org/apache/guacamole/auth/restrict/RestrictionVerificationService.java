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

package org.apache.guacamole.auth.restrict;

import inet.ipaddr.HostName;
import inet.ipaddr.HostNameException;
import inet.ipaddr.IPAddress;
import java.net.UnknownHostException;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.restrict.connection.RestrictedConnection;
import org.apache.guacamole.auth.restrict.user.RestrictedUser;
import org.apache.guacamole.auth.restrict.usergroup.RestrictedUserGroup;
import org.apache.guacamole.calendar.DailyRestriction;
import org.apache.guacamole.calendar.RestrictionType;
import org.apache.guacamole.calendar.TimeRestrictionParser;
import org.apache.guacamole.host.HostRestrictionParser;
import org.apache.guacamole.language.TranslatableGuacamoleSecurityException;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Service for verifying additional user login restrictions against a given
 * login attempt.
 */
public class RestrictionVerificationService {

    /**
     * Logger for this class.
     */
    private static final Logger LOGGER = LoggerFactory.getLogger(RestrictionVerificationService.class);

    /**
     * Parse out the provided strings of allowed and denied times, verifying
     * whether or not a login or connection should be allowed at the current
     * day and time, and returning the appropriate restriction type.
     * 
     * @param allowedTimeString
     *     The string containing the times that should be parsed to determine if
     *     the login or connection should be allowed at the current time, or
     *     null or an empty string if there are no specific allowed times defined.
     * 
     * @param deniedTimeString
     *     The string containing the times that should be parsed to determine if
     *     the login or connection should be denied at the current time, or null
     *     or an empty string if there are no specific times during which a
     *     action should be denied.
     * 
     * @return
     *     A RestrictionType based on the provided allowed and denied strings.
     */
    public static RestrictionType allowedByTimeRestrictions(String allowedTimeString,
            String deniedTimeString) {
        
        // Check for denied entries, first, returning the explicit deny if the
        // login or connection should not be allowed.
        if (deniedTimeString != null && !deniedTimeString.isEmpty()) {
            List<DailyRestriction> deniedTimes = 
                    TimeRestrictionParser.parseString(deniedTimeString);

            for (DailyRestriction restriction : deniedTimes) {
                if (restriction.appliesNow())
                    return RestrictionType.EXPLICIT_DENY;
            }
        }
        
        // If no allowed entries are present, return the implicit allow, allowing
        // the login or connection to continue.
        if (allowedTimeString == null || allowedTimeString.isEmpty())
            return RestrictionType.IMPLICIT_ALLOW;
        
        // Pull the list of allowed times.
        List<DailyRestriction> allowedTimes = 
                TimeRestrictionParser.parseString(allowedTimeString);
        
        // Allowed entries are present, loop through them and check for a valid time.
        for (DailyRestriction restriction : allowedTimes) {
            // If this time allows the login or connection return the explicit allow.
            if (restriction.appliesNow())
                return RestrictionType.EXPLICIT_ALLOW;
        }
        
        // We have allowed entries, but login hasn't matched, so implicitly deny it.
        return RestrictionType.IMPLICIT_DENY;
        
    }
    
    /**
     * Given the strings of allowed and denied hosts, verify that the login or
     * connection should be allowed from the given remote address, returning
     * the RestrictionType that matches the provided allowed and denied strings.
     * 
     * @param allowedHostsString
     *     The string containing a semicolon-separated list of hosts from
     *     which the login or connection should be allowed, or null or an empty
     *     string if no specific set of allowed hosts is defined.
     * 
     * @param deniedHostsString
     *     The string containing a semicolon-separated list of hosts from
     *     which the login or connection should be denied, or null or an empty
     *     string if no specific set of denied hosts is defined.
     * 
     * @param remoteAddress
     *     The IP address from which the user is logging in or has logged in
     *     and is attempting to connect from, if it is known. If it is unknown
     *     and restrictions are defined, the login or connection will be denied.
     * 
     * @return
     *     A RestrictionType that matches the provided allow and deny strings.
     */
    public static RestrictionType allowedByHostRestrictions(String allowedHostsString,
            String deniedHostsString, String remoteAddress) {
        
        // If attributes do not exist or are empty then the action is allowed.
        if ((allowedHostsString == null || allowedHostsString.isEmpty()) 
                && (deniedHostsString == null || deniedHostsString.isEmpty()))
            return RestrictionType.IMPLICIT_ALLOW;
        
        // If the remote address cannot be determined, and restrictions are
        // in effect, log an error and deny the action.
        if (remoteAddress == null || remoteAddress.isEmpty()) {
            LOGGER.warn("Host-based restrictions are present, but the remote "
                    + "address is invalid or could not be resolved. "
                    + "The action will not be allowed.");
            return RestrictionType.IMPLICIT_DENY;
        }
        
        // Convert the string to a HostName
        HostName remoteHostName = new HostName(remoteAddress);
        
        // Split denied hosts attribute and process each entry, checking them
        // against the current remote address, and returning a deny restriction
        // if a match is found, or if an error occurs in processing a host in
        // the list.
        List<HostName> deniedHosts = HostRestrictionParser.parseHostList(deniedHostsString);
        for (HostName hostName : deniedHosts) {

            try {
                if (hostName.isAddress()
                        && hostName.toAddress().contains(remoteHostName.asAddress())) {
                    return RestrictionType.EXPLICIT_DENY;
                }

                else {
                    for (IPAddress currAddr : hostName.toAllAddresses())
                        if (currAddr.matches(remoteHostName.asAddressString()))
                            return RestrictionType.EXPLICIT_DENY;
                }
            }
            catch (UnknownHostException | HostNameException e) {
                LOGGER.warn("Unknown or invalid host in denied hosts list: \"{}\"", hostName);
                LOGGER.debug("Exception while trying to resolve host: \"{}\"", hostName, e);
                return RestrictionType.IMPLICIT_DENY;
            }
        }
        
        // If denied hosts have been checked and allowed hosts are empty, we're
        // good, and can allow the action.
        if (allowedHostsString == null || allowedHostsString.isEmpty())
            return RestrictionType.IMPLICIT_ALLOW;
        
        // Run through allowed hosts, if there are any, and return, allowing the
        // action if there are any matches.
        List<HostName> allowedHosts = HostRestrictionParser.parseHostList(allowedHostsString);
        for (HostName hostName : allowedHosts) {
            try {
                // If the entry is an IP or Subnet, check the remote address against it directly
                if (hostName.isAddress() && hostName.toAddress().contains(remoteHostName.asAddress()))
                    return RestrictionType.EXPLICIT_ALLOW;
                
                // Entry is a hostname, so resolve to IPs and check each one
                for (IPAddress currAddr : hostName.toAllAddresses())
                    if (currAddr.matches(remoteHostName.asAddressString()))
                        return RestrictionType.EXPLICIT_ALLOW;
                
            }
            // If an entry cannot be resolved we will log a warning.
            catch (UnknownHostException | HostNameException e) {
                LOGGER.warn("Unknown host encountered in allowed host string: {}", hostName);
                LOGGER.debug("Exception received trying to resolve host: {}", hostName, e);
            }
        }
        
        // If we've made it here, the allowed hosts do not contain the remote
        // address, and the action should not be allowed;
        return RestrictionType.IMPLICIT_DENY;
        
    }
    
    /**
     * Verify the host restrictions for the user associated with the given
     * UserContext, throwing an exception if any of the restrictions result
     * in the user not being allowed to be logged in to Guacamole from this
     * host.
     * 
     * @param context
     *     The UserContext associated with the user who is being verified.
     * 
     * @param effectiveUserGroups
     *     The set of identifiers of groups of which the user who is being
     *     verified is a member.
     * 
     * @param remoteAddress
     *     The remote address of the client from which the current user is
     *     logged in.
     * 
     * @throws GuacamoleException 
     *     If the restrictions on the user should prevent the user from
     *     logging in from the current client, or if an error occurs attempting
     *     to retrieve permissions.
     */
    public static void verifyHostRestrictions(UserContext context,
            Set<String> effectiveUserGroups, String remoteAddress)
            throws GuacamoleException {
        
        // Get the current user
        User currentUser = context.self();
        
        // Admins always have access.
        if (currentUser.getEffectivePermissions().getSystemPermissions().hasPermission(SystemPermission.Type.ADMINISTER)) {
            LOGGER.warn("User \"{}\" has System Administration permissions; additional restrictions will be bypassed.", 
                    currentUser.getIdentifier());
            return;
        }
        
        // Get user's attributes
        Map<String, String> userAttributes = currentUser.getAttributes();
        
        // Verify host-based restrictions specific to the user
        String allowedHostString = userAttributes.get(RestrictedUser.RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME);
        String deniedHostString = userAttributes.get(RestrictedUser.RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME);
        RestrictionType hostRestrictionResult = allowedByHostRestrictions(allowedHostString, deniedHostString, remoteAddress);
        
        switch (hostRestrictionResult) {
            // User-level explicit deny overrides everything
            case EXPLICIT_DENY:
                throw new TranslatableInvalidHostLoginException("User \"" 
                    + currentUser.getIdentifier() 
                    +"\" is not allowed to log in from \"" 
                    + remoteAddress + "\"",
                    "RESTRICT.ERROR_USER_LOGIN_NOT_ALLOWED_FROM_HOST"
                );
            
            // User-level explicit allow means the user is allowed.
            case EXPLICIT_ALLOW:
                return;
            
        }
        
        // Gather user's effective groups.
        Collection<UserGroup> userGroups = context
                .getPrivileged()
                .getUserGroupDirectory()
                .getAll(effectiveUserGroups);
        
        // Loop user's effective groups and verify restrictions
        for (UserGroup userGroup : userGroups) {

            // Get group's attributes
            Map<String, String> grpAttributes = userGroup.getAttributes();
            
            // Pull host-based restrictions for this group and verify
            String grpAllowedHostString = grpAttributes.get(RestrictedUserGroup.RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME);
            String grpDeniedHostString = grpAttributes.get(RestrictedUserGroup.RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME);
            RestrictionType grpRestrictionResult = allowedByHostRestrictions(grpAllowedHostString, grpDeniedHostString, remoteAddress);
            
            // Any explicit denials are thrown immediately
            if (grpRestrictionResult == RestrictionType.EXPLICIT_DENY)
                throw new TranslatableInvalidHostLoginException("User \"" 
                        + currentUser.getIdentifier() 
                        + "\" is not allowed to log in from host \""
                        + remoteAddress
                        + "\" due to restrictions on group \"" 
                        + userGroup.getIdentifier() + "\".",
                        "RESTRICT.ERROR_USER_LOGIN_NOT_ALLOWED_FROM_HOST"
                );
            
            // Compare the two, returning the highest-priority restriction so far.
            hostRestrictionResult = RestrictionType.getHigherPriority(hostRestrictionResult, grpRestrictionResult);
            
        }

        // Check the result and log allowed
        switch (hostRestrictionResult) {
            // Explicit allow was the highest result, so we log it and return, allowing the user to be logged in.
            case EXPLICIT_ALLOW:
                return;
                
            // Implicit allow was the highest result, so we log it and return, allowing the user to be logged in.
            case IMPLICIT_ALLOW:
                return;
        }
        
        // If we reach, here, we've reached an implict deny, so we throw an exception.
        throw new TranslatableInvalidHostLoginException("User \""
                + currentUser.getIdentifier()
                + "\" is implicitly denied at this time.",
                "RESTRICT.ERROR_USER_LOGIN_NOT_ALLOWED_FROM_HOST"
        );
        
    }
    
    /**
     * Verify the host-based restrictions of the Connection, throwing an
     * exception if the Connection should be allowed from the host from which
     * the user is logged in.
     * 
     * @param restrictable
     *     The Restrictable object that should be verified against host restrictions.
     * 
     * @param remoteAddress
     *     The remote address of the client from which the current user is
     *     logged in.
     * 
     * @throws GuacamoleException 
     *     If the connection should not be allowed from the remote host from
     *     which the user is logged in.
     */
    public static void verifyHostRestrictions(Restrictable restrictable,
            String remoteAddress) throws GuacamoleException {
        
        // Verify time-based restrictions specific to this connection.
        String allowedHostsString = restrictable.getAttributes().get(RestrictedConnection.RESTRICT_HOSTS_ALLOWED_ATTRIBUTE_NAME);
        String deniedHostsString = restrictable.getAttributes().get(RestrictedConnection.RESTRICT_HOSTS_DENIED_ATTRIBUTE_NAME);
        RestrictionType hostRestrictionResult = allowedByHostRestrictions(allowedHostsString, deniedHostsString, remoteAddress);
        
        // If the host is not allowed
        if (!hostRestrictionResult.isAllowed())
            throw new TranslatableGuacamoleSecurityException(
                    "Use of this connection is not allowed from this remote host: \"" + remoteAddress + "\".", 
                    "RESTRICT.ERROR_CONNECTION_NOT_ALLOWED_NOW"
            );
        
    }
    
    /**
     * Verifies the time restrictions for this extension and whether or not the
     * account should be allowed to be logged in to Guacamole at the current
     * day and time, throwing an exception if any of the restrictions result
     * in a violation of the time constraints of the account.
     * 
     * @param context
     *     The UserContext of the user whose access to Guacamole is being
     *     checked.
     * 
     * @param effectiveUserGroups
     *     The set of identifiers of groups of which the user who is being
     *     verified is a member.
     * 
     * @throws GuacamoleException 
     *     If any of the time constraints configured for the user result in the
     *     user not being allowed to be logged in to Guacamole, or if errors
     *     occur trying to retrieve permissions or attributes.
     */
    public static void verifyTimeRestrictions(UserContext context,
            Set<String> effectiveUserGroups) throws GuacamoleException {
        
        // Retrieve the current User object associated with the UserContext
        User currentUser = context.self();
        
        // Admins always have access.
        if (currentUser.getEffectivePermissions().getSystemPermissions().hasPermission(SystemPermission.Type.ADMINISTER)) {
            LOGGER.warn("User \"{}\" has System Administration permissions; additional restrictions will be bypassed.", 
                    currentUser.getIdentifier());
            return;
        }
        
        // Get user's attributes
        Map<String, String> userAttributes = currentUser.getAttributes();
        
        // Verify time-based restrictions specific to the user
        String allowedTimeString = userAttributes.get(RestrictedUser.RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME);
        String deniedTimeString = userAttributes.get(RestrictedUser.RESTRICT_TIME_DENIED_ATTRIBUTE_NAME);
        RestrictionType timeRestrictionResult = allowedByTimeRestrictions(allowedTimeString, deniedTimeString);
        
        // Check the time restriction for explicit results.
        switch (timeRestrictionResult) {
            // User-level explicit deny overrides everything
            case EXPLICIT_DENY:
                throw new TranslatableInvalidTimeLoginException("User \""
                        + currentUser.getIdentifier()
                        + "\" is not allowed to log in at this time.",
                        "RESTRICT.ERROR_USER_LOGIN_NOT_ALLOWED_NOW"
                );
            
            // User-level explicit allow means the user is allowed.
            case EXPLICIT_ALLOW:
                return;
            
        }
        
        // Gather user's effective groups.
        Collection<UserGroup> userGroups = context
                .getPrivileged()
                .getUserGroupDirectory()
                .getAll(effectiveUserGroups);
        
        // Loop user's effective groups and verify restrictions
        for (UserGroup userGroup : userGroups) {
            
            // Get group's attributes
            Map<String, String> grpAttributes = userGroup.getAttributes();
            
            // Pull time-based restrictions for this group and verify
            String grpAllowedTimeString = grpAttributes.get(RestrictedUserGroup.RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME);
            String grpDeniedTimeString = grpAttributes.get(RestrictedUserGroup.RESTRICT_TIME_DENIED_ATTRIBUTE_NAME);
            RestrictionType grpRestrictionResult = allowedByTimeRestrictions(grpAllowedTimeString, grpDeniedTimeString);
            
            // An explicit deny results in immediate denial of the login.
            if (grpRestrictionResult == RestrictionType.EXPLICIT_DENY)
                throw new TranslatableInvalidTimeLoginException("User \"" 
                        + currentUser.getIdentifier() 
                        +"\" is not allowed to log in at this time due to restrictions on group \"" 
                        + userGroup + "\".",
                        "RESTRICT.ERROR_USER_LOGIN_NOT_ALLOWED_NOW"
                );
            
            // Compare the two, returning the highest-priority restriction so far.
            timeRestrictionResult = RestrictionType.getHigherPriority(timeRestrictionResult, grpRestrictionResult);
            
        }
        
        switch (timeRestrictionResult) {
            // Explicit allow was the highest result, so we log it and return, allowing the user to be logged in.
            case EXPLICIT_ALLOW:
                return;
                
            // Implicit allow was the highest result, so we log it and return, allowing the user to be logged in.
            case IMPLICIT_ALLOW:
                return;
        }
        
        // If we reach, here, we've reached an implict deny, so we throw an exception.
        throw new TranslatableInvalidTimeLoginException("User \""
                + currentUser.getIdentifier()
                + "\" is implicitly denied at this time.",
                "RESTRICT.ERROR_USER_LOGIN_NOT_ALLOWED_NOW"
        );
        
    }
    
    /**
     * Verify the time restrictions for the given Connection object, throwing
     * an exception if the connection should not be allowed, or silently
     * returning if the connection should be allowed.
     * 
     * @param restrictable
     *     The item that supports restrictions that is to be verified against
     *     the current time.
     * 
     * @throws GuacamoleException 
     *     If the connection should not be allowed at the current time.
     */
    public static void verifyTimeRestrictions(Restrictable restrictable) throws GuacamoleException {
        
        // Verify time-based restrictions specific to this connection.
        String allowedTimeString = restrictable.getAttributes().get(RestrictedConnection.RESTRICT_TIME_ALLOWED_ATTRIBUTE_NAME);
        String deniedTimeString = restrictable.getAttributes().get(RestrictedConnection.RESTRICT_TIME_DENIED_ATTRIBUTE_NAME);
        RestrictionType timeRestriction = allowedByTimeRestrictions(allowedTimeString, deniedTimeString);
        if (!timeRestriction.isAllowed())
            throw new TranslatableGuacamoleSecurityException(
                    "Use of this connection or connection group is not allowed at this time.", 
                    "RESTRICT.ERROR_CONNECTION_NOT_ALLOWED_NOW"
            );
        
    }
    
    /**
     * Verifies the login restrictions supported by this extension for the user
     * who is attempting to log in, throwing an exception if any of the
     * restrictions result in the user not being allowed to log in.
     * 
     * @param context
     *     The context of the user who is attempting to log in.
     * 
     * @param effectiveUserGroups
     *     The identifiers of the UserGroups of which the user who is logging
     *     in is a member.
     * 
     * @param remoteAddress
     *     The remote address of the client from which the current user is
     *     logged in.
     * 
     * @throws GuacamoleException 
     *     If any of the restrictions should prevent the user from logging in.
     */
    public static void verifyLoginRestrictions(UserContext context,
            Set<String> effectiveUserGroups, String remoteAddress)
            throws GuacamoleException {
        
        verifyTimeRestrictions(context, effectiveUserGroups);
        verifyHostRestrictions(context, effectiveUserGroups, remoteAddress);
        
    }
    
    /**
     * Verifies the connection restrictions supported by this extension for the
     * connection the user is attempting to access, throwing an exception if
     * any of the restrictions result in the connection being unavailable.
     * 
     * @param restrictable
     *     The object that supports restrictions that is to be verified to be
     *     usable within the current restrictions.
     * 
     * @param remoteAddress
     *     The remote address of the client from which the current user is
     *     logged in.
     * 
     * @throws GuacamoleException 
     *     If any of the restrictions should prevent the connection from being
     *     used by the user at the current time.
     */
    public static void verifyConnectionRestrictions(Restrictable restrictable,
            String remoteAddress) throws GuacamoleException {
        verifyTimeRestrictions(restrictable);
        verifyHostRestrictions(restrictable, remoteAddress);
    }

}
