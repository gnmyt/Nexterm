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

package org.apache.guacamole.auth.jdbc.user;


import org.apache.guacamole.auth.jdbc.connectiongroup.RootConnectionGroup;
import org.apache.guacamole.auth.jdbc.connectiongroup.ConnectionGroupDirectory;
import org.apache.guacamole.auth.jdbc.connection.ConnectionDirectory;
import com.google.inject.Inject;
import com.google.inject.Provider;
import java.util.Collection;
import java.util.Date;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.auth.jdbc.base.RestrictedObject;
import org.apache.guacamole.auth.jdbc.JDBCEnvironment;
import org.apache.guacamole.auth.jdbc.activeconnection.ActiveConnectionDirectory;
import org.apache.guacamole.auth.jdbc.base.ActivityRecordModel;
import org.apache.guacamole.auth.jdbc.connection.ConnectionRecordSet;
import org.apache.guacamole.auth.jdbc.connection.ModeledConnection;
import org.apache.guacamole.auth.jdbc.connectiongroup.ModeledConnectionGroup;
import org.apache.guacamole.auth.jdbc.sharingprofile.ModeledSharingProfile;
import org.apache.guacamole.auth.jdbc.sharingprofile.SharingProfileDirectory;
import org.apache.guacamole.auth.jdbc.usergroup.ModeledUserGroup;
import org.apache.guacamole.auth.jdbc.usergroup.UserGroupDirectory;
import org.apache.guacamole.form.Form;
import org.apache.guacamole.net.auth.ActiveConnection;
import org.apache.guacamole.net.auth.ActivityRecord;
import org.apache.guacamole.net.auth.ActivityRecordSet;
import org.apache.guacamole.net.auth.AuthenticationProvider;
import org.apache.guacamole.net.auth.Connection;
import org.apache.guacamole.net.auth.ConnectionGroup;
import org.apache.guacamole.net.auth.Directory;
import org.apache.guacamole.net.auth.SharingProfile;
import org.apache.guacamole.net.auth.User;
import org.apache.guacamole.net.auth.UserContext;
import org.apache.guacamole.net.auth.UserGroup;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * UserContext implementation which is driven by an arbitrary, underlying
 * database.
 */
public class ModeledUserContext extends RestrictedObject
    implements org.apache.guacamole.net.auth.UserContext {

    /**
     * Logger for this class.
     */
    private static final Logger logger = LoggerFactory.getLogger(ModeledUserContext.class);

    /**
     * User directory restricted by the permissions of the user associated
     * with this context.
     */
    @Inject
    private UserDirectory userDirectory;

    /**
     * User group directory restricted by the permissions of the user associated
     * with this context.
     */
    @Inject
    private UserGroupDirectory userGroupDirectory;
 
    /**
     * Connection directory restricted by the permissions of the user
     * associated with this context.
     */
    @Inject
    private ConnectionDirectory connectionDirectory;

    /**
     * Connection group directory restricted by the permissions of the user
     * associated with this context.
     */
    @Inject
    private ConnectionGroupDirectory connectionGroupDirectory;

    /**
     * Sharing profile directory restricted by the permissions of the user
     * associated with this context.
     */
    @Inject
    private SharingProfileDirectory sharingProfileDirectory;

    /**
     * ActiveConnection directory restricted by the permissions of the user
     * associated with this context.
     */
    @Inject
    private ActiveConnectionDirectory activeConnectionDirectory;

    /**
     * Provider for creating the root group.
     */
    @Inject
    private Provider<RootConnectionGroup> rootGroupProvider;

    /**
     * Provider for creating connection record sets.
     */
    @Inject
    private Provider<ConnectionRecordSet> connectionRecordSetProvider;

    /**
     * Provider for creating user record sets.
     */
    @Inject
    private Provider<UserRecordSet> userRecordSetProvider;

    /**
     * Provider for retrieving UserContext instances.
     */
    @Inject
    private Provider<ModeledUserContext> userContextProvider;

    /**
     * Mapper for user login records.
     */
    @Inject
    private UserRecordMapper userRecordMapper;

    /**
     * The environment of the Guacamole server.
     */
    @Inject
    private JDBCEnvironment environment;

    /**
     * The activity record associated with this user's Guacamole session. If
     * this user's session will not have an associated activity record, such as
     * a temporary privileged session created via getPrivileged(), this will be
     * null.
     */
    private ActivityRecordModel userRecord;

    @Override
    public void init(ModeledAuthenticatedUser currentUser) {

        super.init(currentUser);
        
        // Init directories
        userDirectory.init(currentUser);
        userGroupDirectory.init(currentUser);
        connectionDirectory.init(currentUser);
        connectionGroupDirectory.init(currentUser);
        sharingProfileDirectory.init(currentUser);
        activeConnectionDirectory.init(currentUser);

    }

    /**
     * Records that the user associated with this UserContext has logged in,
     * creating a partial activity record. The resulting activity record will
     * contain a start date only, with the end date being automatically
     * populated when this UserContext is invalidated. If this function is
     * invoked more than once for the same UserContext, only the first
     * invocation has any effect. If this function is never invoked, no
     * activity record will be recorded, including when this UserContext is
     * invalidated.
     * 
     * @throws GuacamoleException
     *     If an error occurs retrieving configuration information from the
     *     environment.
     */
    public void recordUserLogin() throws GuacamoleException {

        // Do nothing if invoked multiple times
        if (userRecord != null)
            return;

        // Create login record for user
        userRecord = new ActivityRecordModel();
        userRecord.setUsername(getCurrentUser().getIdentifier());
        userRecord.setStartDate(new Date());
        userRecord.setRemoteHost(getCurrentUser().getCredentials().getRemoteAddress());

        // Insert record representing login
        userRecordMapper.insert(userRecord, environment.getCaseSensitivity());
        
    }

    @Override
    public UserContext getPrivileged() {
        ModeledUserContext context = userContextProvider.get();
        context.init(new PrivilegedModeledAuthenticatedUser(getCurrentUser()));
        return context;
    }

    @Override
    public User self() {
        return getCurrentUser().getUser();
    }

    @Override
    public Object getResource() throws GuacamoleException {
        return null;
    }

    @Override
    public AuthenticationProvider getAuthenticationProvider() {
        return getCurrentUser().getModelAuthenticationProvider();
    }

    @Override
    public Directory<User> getUserDirectory() throws GuacamoleException {
        return userDirectory;
    }

    @Override
    public Directory<UserGroup> getUserGroupDirectory() throws GuacamoleException {
        return userGroupDirectory;
    }

    @Override
    public Directory<Connection> getConnectionDirectory() throws GuacamoleException {
        return connectionDirectory;
    }

    @Override
    public Directory<ConnectionGroup> getConnectionGroupDirectory() throws GuacamoleException {
        return connectionGroupDirectory;
    }

    @Override
    public Directory<SharingProfile> getSharingProfileDirectory()
            throws GuacamoleException {
        return sharingProfileDirectory;
    }

    @Override
    public Directory<ActiveConnection> getActiveConnectionDirectory()
            throws GuacamoleException {
        return activeConnectionDirectory;
    }

    @Override
    public ConnectionRecordSet getConnectionHistory()
            throws GuacamoleException {
        ConnectionRecordSet connectionRecordSet = connectionRecordSetProvider.get();
        connectionRecordSet.init(getCurrentUser());
        return connectionRecordSet;
    }

    @Override
    public ActivityRecordSet<ActivityRecord> getUserHistory()
            throws GuacamoleException {
        UserRecordSet userRecordSet = userRecordSetProvider.get();
        userRecordSet.init(getCurrentUser());
        return userRecordSet;
    }

    @Override
    public ConnectionGroup getRootConnectionGroup() throws GuacamoleException {

        // Build and return a root group for the current user
        RootConnectionGroup rootGroup = rootGroupProvider.get();
        rootGroup.init(getCurrentUser());
        return rootGroup;

    }

    @Override
    public Collection<Form> getUserAttributes() {
        return ModeledUser.ATTRIBUTES;
    }

    @Override
    public Collection<Form> getUserGroupAttributes() {
        return ModeledUserGroup.ATTRIBUTES;
    }

    @Override
    public Collection<Form> getConnectionAttributes() {
        return ModeledConnection.ATTRIBUTES;
    }

    @Override
    public Collection<Form> getConnectionGroupAttributes() {
        return ModeledConnectionGroup.ATTRIBUTES;
    }

    @Override
    public Collection<Form> getSharingProfileAttributes() {
        return ModeledSharingProfile.ATTRIBUTES;
    }

    @Override
    public void invalidate() {

        // Record logout time only if login time was recorded
        if (userRecord != null) {
            userRecord.setEndDate(new Date());
            userRecordMapper.updateEndDate(userRecord);
        }

    }

    @Override
    public boolean isValid() {

        try {
            // If access window enforcement is disabled for active sessions,
            // skip validity checks entirely
            if (!environment.enforceAccessWindowsForActiveSessions())
                return true;
        }

        catch (GuacamoleException e) {

            logger.warn(
                    "Unable to determine if access window enforcement is"
                    + " enabled for active sessions; enforcing by default: {}"
                    , e.getMessage());
            logger.debug("Unable to determine access window enforcement policy.", e);

        }

        // A user context is valid if the associated user's account is valid
        // for the current date, and the user is within an access time window
        ModeledUser user = getCurrentUser().getUser();
        return user.isAccountValid() && user.isAccountAccessible();

    }

}
