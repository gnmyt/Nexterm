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

import java.util.Collection;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.form.Form;

/**
 * UserContext implementation which simply delegates all function calls to
 * an underlying UserContext.
 */
public class DelegatingUserContext implements UserContext {

    /**
     * The wrapped UserContext.
     */
    private final UserContext userContext;

    /**
     * Wraps the given UserContext such that all function calls against this
     * DelegatingUserContext will be delegated to it.
     *
     * @param userContext
     *     The UserContext to wrap.
     */
    public DelegatingUserContext(UserContext userContext) {
        this.userContext = userContext;
    }

    /**
     * Returns the underlying UserContext wrapped by this
     * DelegatingUserContext.
     *
     * @return
     *     The UserContext wrapped by this DelegatingUserContext.
     */
    protected UserContext getDelegateUserContext() {
        return userContext;
    }

    @Override
    public User self() {
        return userContext.self();
    }

    @Override
    public Object getResource() throws GuacamoleException {
        return userContext.getResource();
    }

    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return userContext.getAuthenticationProvider();
    }

    @Override
    public Directory<User> getUserDirectory() throws GuacamoleException {
        return userContext.getUserDirectory();
    }

    @Override
    public Directory<UserGroup> getUserGroupDirectory() throws GuacamoleException {
        return userContext.getUserGroupDirectory();
    }

    @Override
    public Directory<Connection> getConnectionDirectory()
            throws GuacamoleException {
        return userContext.getConnectionDirectory();
    }

    @Override
    public Directory<ConnectionGroup> getConnectionGroupDirectory()
            throws GuacamoleException {
        return userContext.getConnectionGroupDirectory();
    }

    @Override
    public Directory<ActiveConnection> getActiveConnectionDirectory()
            throws GuacamoleException {
        return userContext.getActiveConnectionDirectory();
    }

    @Override
    public Directory<SharingProfile> getSharingProfileDirectory()
            throws GuacamoleException {
        return userContext.getSharingProfileDirectory();
    }

    @Override
    public ActivityRecordSet<ConnectionRecord> getConnectionHistory()
            throws GuacamoleException {
        return userContext.getConnectionHistory();
    }

    @Override
    public ActivityRecordSet<ActivityRecord> getUserHistory()
            throws GuacamoleException {
        return userContext.getUserHistory();
    }

    @Override
    public ConnectionGroup getRootConnectionGroup() throws GuacamoleException {
        return userContext.getRootConnectionGroup();
    }

    @Override
    public Collection<Form> getUserAttributes() {
        return userContext.getUserAttributes();
    }

    @Override
    public Collection<Form> getUserPreferenceAttributes() {
        return userContext.getUserPreferenceAttributes();
    }

    @Override
    public Collection<Form> getUserGroupAttributes() {
        return userContext.getUserGroupAttributes();
    }

    @Override
    public Collection<Form> getConnectionAttributes() {
        return userContext.getConnectionAttributes();
    }

    @Override
    public Collection<Form> getConnectionGroupAttributes() {
        return userContext.getConnectionGroupAttributes();
    }

    @Override
    public Collection<Form> getSharingProfileAttributes() {
        return userContext.getSharingProfileAttributes();
    }

    @Override
    public void invalidate() {
        userContext.invalidate();
    }

    @Override
    public UserContext getPrivileged() {
        return userContext.getPrivileged();
    }

    @Override
    public boolean isValid() {
        return userContext.isValid();
    }

}
