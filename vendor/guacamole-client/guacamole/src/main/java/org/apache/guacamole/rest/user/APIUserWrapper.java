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

package org.apache.guacamole.rest.user;

import java.util.Date;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.net.auth.RelatedObjectSet;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * A wrapper to make an APIUser look like a User. Useful where an
 * org.apache.guacamole.net.auth.User is required. As a simple wrapper for
 * APIUser, access to permissions is not provided. Any attempt to access or
 * manipulate permissions on an APIUserWrapper will result in an exception.
 */
public class APIUserWrapper implements User {
    
    /**
     * The wrapped APIUser.
     */
    private final APIUser apiUser;
    
    /**
     * Wrap a given APIUser to expose as a User.
     * @param apiUser The APIUser to wrap.
     */
    public APIUserWrapper(APIUser apiUser) {
        this.apiUser = apiUser;
    }
    
    @Override
    public String getIdentifier() {
        return apiUser.getUsername();
    }

    @Override
    public void setIdentifier(String username) {
        apiUser.setUsername(username);
    }

    @Override
    public String getPassword() {
        return apiUser.getPassword();
    }

    @Override
    public void setPassword(String password) {
        apiUser.setPassword(password);
    }
    
    @Override
    public boolean isDisabled() {
        return apiUser.isDisabled();
    }
    
    @Override
    public void setDisabled(boolean disabled) {
        apiUser.setDisabled(disabled);
    }

    @Override
    public Map<String, String> getAttributes() {
        return apiUser.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        apiUser.setAttributes(attributes);
    }

    @Override
    public SystemPermissionSet getSystemPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getConnectionPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getConnectionGroupPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getSharingProfilePermissions() throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getUserPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getUserGroupPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide permission access.");
    }

    @Override
    public ObjectPermissionSet getActiveConnectionPermissions()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide permission access.");
    }

    @Override
    public Permissions getEffectivePermissions() throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide permission access.");
    }

    @Override
    public RelatedObjectSet getUserGroups() throws GuacamoleException {
        throw new GuacamoleUnsupportedException("APIUserWrapper does not provide group access.");
    }

    @Override
    public Date getLastActive() {
        return null;
    }

}
