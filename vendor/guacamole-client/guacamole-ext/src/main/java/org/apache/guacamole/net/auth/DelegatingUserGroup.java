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

package org.apache.guacamole.net.auth;

import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * UserGroup implementation which simply delegates all function calls to an
 * underlying UserGroup.
 */
public class DelegatingUserGroup implements UserGroup {

    /**
     * The wrapped UserGroup.
     */
    private final UserGroup userGroup;

    /**
     * Wraps the given UserGroup such that all function calls against this
     * DelegatingUserGroup will be delegated to it.
     *
     * @param userGroup
     *     The UserGroup to wrap.
     */
    public DelegatingUserGroup(UserGroup userGroup) {
        this.userGroup = userGroup;
    }

    /**
     * Returns the underlying UserGroup wrapped by this DelegatingUserGroup.
     *
     * @return
     *     The UserGroup wrapped by this DelegatingUserGroup.
     */
    protected UserGroup getDelegateUserGroupGroup() {
        return userGroup;
    }

    @Override
    public String getIdentifier() {
        return userGroup.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        userGroup.setIdentifier(identifier);
    }
    
    @Override
    public boolean isDisabled() {
        return userGroup.isDisabled();
    }
    
    @Override
    public void setDisabled(boolean disabled) {
        userGroup.setDisabled(disabled);
    }

    @Override
    public Map<String, String> getAttributes() {
        return userGroup.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        userGroup.setAttributes(attributes);
    }

    @Override
    public SystemPermissionSet getSystemPermissions()
            throws GuacamoleException {
        return userGroup.getSystemPermissions();
    }

    @Override
    public ObjectPermissionSet getConnectionPermissions()
            throws GuacamoleException {
        return userGroup.getConnectionPermissions();
    }

    @Override
    public ObjectPermissionSet getConnectionGroupPermissions()
            throws GuacamoleException {
        return userGroup.getConnectionGroupPermissions();
    }

    @Override
    public ObjectPermissionSet getSharingProfilePermissions()
            throws GuacamoleException {
        return userGroup.getSharingProfilePermissions();
    }

    @Override
    public ObjectPermissionSet getActiveConnectionPermissions()
            throws GuacamoleException {
        return userGroup.getActiveConnectionPermissions();
    }

    @Override
    public ObjectPermissionSet getUserPermissions() throws GuacamoleException {
        return userGroup.getUserPermissions();
    }

    @Override
    public ObjectPermissionSet getUserGroupPermissions()
            throws GuacamoleException {
        return userGroup.getUserGroupPermissions();
    }

    @Override
    public RelatedObjectSet getUserGroups() throws GuacamoleException {
        return userGroup.getUserGroups();
    }

    @Override
    public RelatedObjectSet getMemberUsers() throws GuacamoleException {
        return userGroup.getMemberUsers();
    }

    @Override
    public RelatedObjectSet getMemberUserGroups() throws GuacamoleException {
        return userGroup.getMemberUserGroups();
    }

}
