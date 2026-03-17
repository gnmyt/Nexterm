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

import java.util.Date;
import java.util.List;
import java.util.Map;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * User implementation which simply delegates all function calls to an
 * underlying User.
 */
public class DelegatingUser implements User {

    /**
     * The wrapped User.
     */
    private final User user;

    /**
     * Wraps the given User such that all function calls against this
     * DelegatingUser will be delegated to it.
     *
     * @param user
     *     The User to wrap.
     */
    public DelegatingUser(User user) {
        this.user = user;
    }

    /**
     * Returns the underlying User wrapped by this DelegatingUser.
     *
     * @return
     *     The User wrapped by this DelegatingUser.
     */
    protected User getDelegateUser() {
        return user;
    }

    @Override
    public String getIdentifier() {
        return user.getIdentifier();
    }

    @Override
    public void setIdentifier(String identifier) {
        user.setIdentifier(identifier);
    }

    @Override
    public String getPassword() {
        return user.getPassword();
    }

    @Override
    public void setPassword(String password) {
        user.setPassword(password);
    }
    
    @Override
    public boolean isDisabled() {
        return user.isDisabled();
    }
    
    @Override
    public void setDisabled(boolean disabled) {
        user.setDisabled(disabled);
    }

    @Override
    public Map<String, String> getAttributes() {
        return user.getAttributes();
    }

    @Override
    public void setAttributes(Map<String, String> attributes) {
        user.setAttributes(attributes);
    }

    @Override
    public Date getLastActive() {
        return user.getLastActive();
    }

    @Deprecated
    @Override
    public List<? extends ActivityRecord> getHistory()
            throws GuacamoleException {
        return user.getHistory();
    }
    
    @Override
    public ActivityRecordSet<ActivityRecord> getUserHistory()
            throws GuacamoleException {
        return user.getUserHistory();
    }

    @Override
    public SystemPermissionSet getSystemPermissions()
            throws GuacamoleException {
        return user.getSystemPermissions();
    }

    @Override
    public ObjectPermissionSet getConnectionPermissions()
            throws GuacamoleException {
        return user.getConnectionPermissions();
    }

    @Override
    public ObjectPermissionSet getConnectionGroupPermissions()
            throws GuacamoleException {
        return user.getConnectionGroupPermissions();
    }

    @Override
    public ObjectPermissionSet getSharingProfilePermissions()
            throws GuacamoleException {
        return user.getSharingProfilePermissions();
    }

    @Override
    public ObjectPermissionSet getActiveConnectionPermissions()
            throws GuacamoleException {
        return user.getActiveConnectionPermissions();
    }

    @Override
    public ObjectPermissionSet getUserPermissions() throws GuacamoleException {
        return user.getUserPermissions();
    }

    @Override
    public ObjectPermissionSet getUserGroupPermissions()
            throws GuacamoleException {
        return user.getUserGroupPermissions();
    }

    @Override
    public RelatedObjectSet getUserGroups() throws GuacamoleException {
        return user.getUserGroups();
    }

    @Override
    public Permissions getEffectivePermissions() throws GuacamoleException {
        return user.getEffectivePermissions();
    }

}
