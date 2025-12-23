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

package org.apache.guacamole.auth.jdbc.sharing.user;

import java.util.Collections;
import java.util.Date;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.sharing.permission.SharedObjectPermissionSet;
import org.apache.guacamole.net.auth.AuthenticatedUser;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.net.auth.RelatedObjectSet;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * An immutable implementation of User which defines READ permission for each of
 * the objects accessible through the various directories of a given
 * SharedUserContext.
 */
public class SharedUser implements User {

    /**
     * The AuthenticatedUser that this SharedUser represents.
     */
    private final AuthenticatedUser user;

    /**
     * The SharedUserContext which should be used to define which objects this
     * SharedUser has READ permission for.
     */
    private final SharedUserContext userContext;

    /**
     * Creates a new SharedUser whose identity is defined by the given
     * AuthenticatedUser, and who has strictly READ access to all objects
     * accessible via the various directories of the given SharedUserContext.
     *
     * @param user
     *     The AuthenticatedUser that the SharedUser should represent.
     *
     * @param userContext
     *     The SharedUserContext which should be used to define which objects
     *     the SharedUser has READ permission for.
     */
    public SharedUser(AuthenticatedUser user, SharedUserContext userContext) {
        this.user = user;
        this.userContext = userContext;
    }

    @Override
    public String getIdentifier() {
        return user.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        throw new UnsupportedOperationException("Users authenticated via share keys are immutable.");
    }

    @Override
    public Map<String, String> getAttributes() {
        return Collections.<String, String>emptyMap();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        // Do nothing - no attributes supported
    }

    @Override
    public Date getLastActive() {

        // History is not recorded for shared users
        return null;

    }

    @Override
    public String getPassword() {
        return null;
    }

    @Override
    public void setPassword(String password) {
        throw new UnsupportedOperationException("Users authenticated via share keys are immutable.");
    }

    @Override
    public SystemPermissionSet getSystemPermissions() throws GuacamoleException {
        return SystemPermissionSet.EMPTY_SET;
    }

    @Override
    public ObjectPermissionSet getConnectionPermissions() throws GuacamoleException {
        Directory<Connection> connectionDirectory = userContext.getConnectionDirectory();
        return new SharedObjectPermissionSet(connectionDirectory.getIdentifiers());
    }

    @Override
    public ObjectPermissionSet getConnectionGroupPermissions() throws GuacamoleException {
        Directory<ConnectionGroup> connectionGroupDirectory = userContext.getConnectionGroupDirectory();
        return new SharedObjectPermissionSet(connectionGroupDirectory.getIdentifiers());
    }

    @Override
    public ObjectPermissionSet getUserPermissions() throws GuacamoleException {
        Directory<User> userDirectory = userContext.getUserDirectory();
        return new SharedObjectPermissionSet(userDirectory.getIdentifiers());
    }

    @Override
    public ObjectPermissionSet getUserGroupPermissions() throws GuacamoleException {
        return ObjectPermissionSet.EMPTY_SET;
    }

    @Override
    public ObjectPermissionSet getSharingProfilePermissions() throws GuacamoleException {
        return ObjectPermissionSet.EMPTY_SET;
    }

    @Override
    public ObjectPermissionSet getActiveConnectionPermissions() throws GuacamoleException {
        return ObjectPermissionSet.EMPTY_SET;
    }

    @Override
    public RelatedObjectSet getUserGroups() throws GuacamoleException {
        return RelatedObjectSet.EMPTY_SET;
    }

    @Override
    public Permissions getEffectivePermissions() throws GuacamoleException {
        return this;
    }

}
