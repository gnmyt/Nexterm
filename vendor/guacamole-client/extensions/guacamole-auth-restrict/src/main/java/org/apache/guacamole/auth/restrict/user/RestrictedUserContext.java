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

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.restrict.RestrictionVerificationService;
import org.apache.guacamole.auth.restrict.connection.RestrictedConnection;
import org.apache.guacamole.auth.restrict.connectiongroup.RestrictedConnectionGroup;
import org.apache.guacamole.auth.restrict.usergroup.RestrictedUserGroup;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.DecoratingDirectory;
import org.apache.guacamole.net.auth.DelegatingUserContext;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A UserContext implementation for additional login and connection restrictions
 * which wraps the UserContext of some other extension.
 */
public class RestrictedUserContext extends DelegatingUserContext {

    /**
     * The logger for this class.
     */
    private static final Logger LOGGER = LoggerFactory.getLogger(RestrictedUserContext.class);
    
    /**
     * The remote address from which this user logged in.
     */
    private final String remoteAddress;
    
    /**
     * The identifiers effective groups of the user associated with this context.
     */
    private final Set<String> effectiveUserGroups;

    /**
     * Creates a new RestrictedUserContext which wraps the given UserContext,
     * providing additional control for user logins and connections.
     *
     * @param userContext
     *     The UserContext to wrap.
     * 
     * @param remoteAddress
     *     The address the user is logging in from, if known.
     * 
     * @param effectiveUserGroups
     *     The identifiers of the groups this user is associated with.
     */
    public RestrictedUserContext(UserContext userContext, String remoteAddress,
            Set<String> effectiveUserGroups) {
        super(userContext);
        this.remoteAddress = remoteAddress;
        this.effectiveUserGroups = effectiveUserGroups;
    }
    
    @Override
    public Directory<Connection> getConnectionDirectory() throws GuacamoleException {
        return new DecoratingDirectory<Connection>(super.getConnectionDirectory()) {

            @Override
            protected Connection decorate(Connection object) throws GuacamoleException {
                return new RestrictedConnection(object, remoteAddress);
            }

            @Override
            protected Connection undecorate(Connection object) {
                assert(object instanceof RestrictedConnection);
                return ((RestrictedConnection) object).getUndecorated();
            }

        };
    }
    
    @Override
    public Collection<Form> getConnectionAttributes() {
        Collection<Form> connectionAttrs = new HashSet<>(super.getConnectionAttributes());
        connectionAttrs.add(RestrictedConnection.RESTRICT_CONNECTION_FORM);
        return Collections.unmodifiableCollection(connectionAttrs);
    }
    
    @Override
    public Directory<ConnectionGroup> getConnectionGroupDirectory() throws GuacamoleException {
        return new DecoratingDirectory<ConnectionGroup>(super.getConnectionGroupDirectory()) {

            @Override
            protected ConnectionGroup decorate(ConnectionGroup object) throws GuacamoleException {
                return new RestrictedConnectionGroup(object, remoteAddress);
            }

            @Override
            protected ConnectionGroup undecorate(ConnectionGroup object) {
                assert(object instanceof RestrictedConnectionGroup);
                return ((RestrictedConnectionGroup) object).getUndecorated();
            }

        };
    }
    
    @Override
    public Collection<Form> getConnectionGroupAttributes() {
        Collection<Form> connectionGroupAttrs = new HashSet<>(super.getConnectionGroupAttributes());
        connectionGroupAttrs.add(RestrictedConnectionGroup.RESTRICT_CONNECTIONGROUP_FORM);
        return Collections.unmodifiableCollection(connectionGroupAttrs);
    }
    
    @Override
    public Directory<User> getUserDirectory() throws GuacamoleException {
        
        // Pull permissions of the current logged-in user.
        Permissions currentPermissions = self().getEffectivePermissions();
        boolean isAdmin = currentPermissions.getSystemPermissions().hasPermission(
                                        SystemPermission.Type.ADMINISTER
                        );
        Collection<String> adminIdentifiers = 
                currentPermissions.getUserPermissions().getAccessibleObjects(
                        Collections.singletonList(ObjectPermission.Type.ADMINISTER), super.getUserDirectory().getIdentifiers());
        
        return new DecoratingDirectory<User>(super.getUserDirectory()) {

            @Override
            protected User decorate(User object) throws GuacamoleException {
                
                // Check and see if the logged in user has admin privileges -
                // either system-level or for that particular object.
                boolean hasAdmin = isAdmin || adminIdentifiers.contains(object.getIdentifier());
                return new RestrictedUser(object, remoteAddress, hasAdmin);
            }

            @Override
            protected User undecorate(User object) {
                assert(object instanceof RestrictedUser);
                return ((RestrictedUser) object).getUndecorated();
            }

        };
    }
    
    @Override
    public Collection<Form> getUserAttributes() {
        Collection<Form> userAttrs = new HashSet<>(super.getUserAttributes());
        userAttrs.add(RestrictedUser.RESTRICT_LOGIN_FORM);
        return Collections.unmodifiableCollection(userAttrs);
    }
    
    @Override
    public Directory<UserGroup> getUserGroupDirectory() throws GuacamoleException {
        return new DecoratingDirectory<UserGroup>(super.getUserGroupDirectory()) {
            
            @Override
            protected UserGroup decorate(UserGroup object) {
                return new RestrictedUserGroup(object);
            }
            
            @Override
            protected UserGroup undecorate(UserGroup object) {
                assert(object instanceof RestrictedUserGroup);
                return ((RestrictedUserGroup) object).getUndecorated();
            }
            
        };
    }
    
    @Override
    public Collection<Form> getUserGroupAttributes() {
        Collection<Form> userGroupAttrs = new HashSet<>(super.getUserGroupAttributes());
        userGroupAttrs.add(RestrictedUserGroup.RESTRICT_LOGIN_FORM);
        return Collections.unmodifiableCollection(userGroupAttrs);
    }
    
    @Override
    public boolean isValid() {
        try {
            // Verify whether or not time restrictions still apply.
            RestrictionVerificationService.verifyTimeRestrictions(this, effectiveUserGroups);
            return true;
        }
        catch (GuacamoleException e) {
            LOGGER.debug("User account is now restricted and is no longer valid", e);
            return false;
        }
    }

}
