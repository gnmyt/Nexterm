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

package org.apache.guacamole.rest.usergroup;

import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.net.auth.RelatedObjectSet;
import org.apache.guacamole.net.auth.UserGroup;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * A wrapper to make an APIUserGroup look like a UserGroup. Useful where an
 * org.apache.guacamole.net.auth.UserGroup is required. As a simple wrapper for
 * APIUserGroup, access to permissions, groups, and members is not provided.
 * Any attempt to access or manipulate permissions or group membership via an
 * APIUserGroupWrapper will result in an exception.
 */
public class APIUserGroupWrapper implements UserGroup {

    /**
     * The wrapped APIUserGroup.
     */
    private final APIUserGroup apiUserGroup;

    /**
     * Creates a new APIUserGroupWrapper which wraps the given APIUserGroup,
     * exposing its properties through the UserGroup interface.
     *
     * @param apiUserGroup
     *     The APIUserGroup to wrap.
     */
    public APIUserGroupWrapper(APIUserGroup apiUserGroup) {
        this.apiUserGroup = apiUserGroup;
    }

    @Override
    public String getIdentifier() {
        return apiUserGroup.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        apiUserGroup.setIdentifier(identifier);
    }
    
    @Override
    public boolean isDisabled() {
        return apiUserGroup.isDisabled();
    }
    
    @Override
    public void setDisabled(boolean disabled) {
        apiUserGroup.setDisabled(disabled);
    }

    @Override
    public Map<String, String> getAttributes() {
        return apiUserGroup.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        apiUserGroup.setAttributes(attributes);
    }

    @Override
    public SystemPermissionSet getSystemPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getConnectionPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getConnectionGroupPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getSharingProfilePermissions() throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getUserPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getUserGroupPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getActiveConnectionPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide permission access.");
    }

    @Override
    public RelatedObjectSet getUserGroups() throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide group access.");
    }

    @Override
    public RelatedObjectSet getMemberUsers() throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide member access.");
    }

    @Override
    public RelatedObjectSet getMemberUserGroups() throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserGroupWrapper does not provide member access.");
    }

}
