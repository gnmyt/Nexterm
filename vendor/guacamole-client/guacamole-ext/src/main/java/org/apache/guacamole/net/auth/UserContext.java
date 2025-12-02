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
import java.util.Collections;

import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.form.Form;

/**
 * The context of an active user. The functions of this class enforce all
 * permissions and act only within the rights of the associated user.
 */
public interface UserContext {

    /**
     * Returns the User whose access rights control the operations of this
     * UserContext.
     *
     * @return The User whose access rights control the operations of this
     *         UserContext.
     */
    User self();

    /**
     * Returns true if the session for the User associated with this user
     * context is valid, or false otherwise. If the session is not valid,
     * the webapp can be expected to terminate the session within a short
     * period of time.
     *
     * NOTE: The webapp currently checks once a minute, and terminates any
     * session marked as invalid.
     *
     * @return
     *     true if the session for the User associated with this user
     *     context is valid, or false otherwise.
     */
    default boolean isValid() {

        // A user context is always valid unless explicitly updated by an
        // implementation
        return true;

    }

    /**
     * Returns an arbitrary REST resource representing this UserContext. The
     * REST resource returned must be properly annotated with JSR-311
     * annotations, and may serve as the root resource for any number of
     * subresources. The returned resource is ultimately exposed at
     * ".../api/session/ext/IDENTIFIER/", where IDENTIFIER is the identifier of
     * the AuthenticationProvider associated with this UserContext.
     *
     * REST resources returned by this function will only be reachable by
     * authenticated users with valid authentication tokens. REST resources
     * which should be accessible by all users regardless of whether they have
     * authenticated should instead be returned from
     * AuthenticationProvider.getResource().
     *
     * @return
     *     An arbitrary REST resource, annotated with JSR-311 annotations, or
     *     null if no such resource is defined.
     *
     * @throws GuacamoleException
     *     If the REST resource cannot be returned due to an error.
     */
    Object getResource() throws GuacamoleException;

    /**
     * Returns the AuthenticationProvider which created this UserContext, which
     * may not be the same AuthenticationProvider that authenticated the user
     * associated with this UserContext.
     *
     * @return
     *     The AuthenticationProvider that created this UserContext.
     */
    AuthenticationProvider getAuthenticationProvider();

    /**
     * Retrieves a Directory which can be used to view and manipulate other
     * users, but only as allowed by the permissions given to the user of this
     * UserContext.
     *
     * @return A Directory whose operations are bound by the restrictions
     *         of this UserContext.
     *
     * @throws GuacamoleException If an error occurs while creating the
     *                            Directory.
     */
    Directory<User> getUserDirectory() throws GuacamoleException;

    /**
     * Retrieves a Directory which can be used to view and manipulate user
     * groups, but only as allowed by the permissions given to the user of this
     * UserContext.
     *
     * @return
     *     A Directory whose operations are bound by the restrictions
     *     of this UserContext.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    Directory<UserGroup> getUserGroupDirectory() throws GuacamoleException;

    /**
     * Retrieves a Directory which can be used to view and manipulate
     * connections and their configurations, but only as allowed by the
     * permissions given to the user.
     *
     * @return A Directory whose operations are bound by the permissions of 
     *         the user.
     *
     * @throws GuacamoleException If an error occurs while creating the
     *                            Directory.
     */
    Directory<Connection> getConnectionDirectory()
            throws GuacamoleException;

    /**
     * Retrieves a Directory which can be used to view and manipulate
     * connection groups and their members, but only as allowed by the
     * permissions given to the user.
     *
     * @return A Directory whose operations are bound by the permissions of
     *         the user.
     *
     * @throws GuacamoleException If an error occurs while creating the
     *                            Directory.
     */
    Directory<ConnectionGroup> getConnectionGroupDirectory()
            throws GuacamoleException;

    /**
     * Retrieves a Directory which can be used to view and manipulate
     * active connections, but only as allowed by the permissions given to the
     * user.
     *
     * @return
     *     A Directory whose operations are bound by the permissions of the
     *     user.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    Directory<ActiveConnection> getActiveConnectionDirectory()
            throws GuacamoleException;

    /**
     * Retrieves a Directory which can be used to view and manipulate
     * sharing profiles and their configurations, but only as allowed by the
     * permissions given to the user.
     *
     * @return
     *     A Directory whose operations are bound by the permissions of the
     *     user.
     *
     * @throws GuacamoleException
     *     If an error occurs while creating the Directory.
     */
    Directory<SharingProfile> getSharingProfileDirectory()
            throws GuacamoleException;

    /**
     * Retrieves all connection records visible to current user. Connection
     * history records describe the start and end times of connections, and
     * correspond to the times that users connect or disconnect to individual
     * remote desktops. The resulting set of connection records can be further
     * filtered and ordered using the methods defined on ActivityRecordSet.
     *
     * @return
     *     A set of all connection records visible to the current user.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the connection records.
     */
    ActivityRecordSet<ConnectionRecord> getConnectionHistory()
            throws GuacamoleException;

    /**
     * Retrieves all user history records visible to current user. User history
     * records describe the start and end times of user sessions, and correspond
     * to the times that users logged in or out. The resulting set of user
     * records can be further filtered and ordered using the methods defined on
     * ActivityRecordSet.
     *
     * @return
     *     A set of all user records visible to the current user.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the user records.
     */
    ActivityRecordSet<ActivityRecord> getUserHistory() throws GuacamoleException;

    /**
     * Retrieves a connection group which can be used to view and manipulate
     * connections, but only as allowed by the permissions given to the user of 
     * this UserContext.
     *
     * @return A connection group whose operations are bound by the restrictions
     *         of this UserContext.
     *
     * @throws GuacamoleException If an error occurs while creating the
     *                            Directory.
     */
    ConnectionGroup getRootConnectionGroup() throws GuacamoleException;

    /**
     * Retrieves a collection of all attributes applicable to users. This
     * collection will contain only those attributes which the current user has
     * general permission to view or modify. If there are no such attributes,
     * this collection will be empty.
     *
     * @return
     *     A collection of all attributes applicable to users.
     */
    Collection<Form> getUserAttributes();

    /**
     * Retrieves a collection of user attributes, specific to the user preferences
     * page in the UI. Unlike standard user attributes, these should be self-editable.
     *
     * @return
     *     A collection of form of user attributes, specific to the user preferences
     *     page in the UI.
     */
    default Collection<Form> getUserPreferenceAttributes() {

        // By default, a user context does not expose any preference user attributes
        return Collections.emptyList();

    }

    /**
     * Retrieves a collection of all attributes applicable to user groups. This
     * collection will contain only those attributes which the current user has
     * general permission to view or modify. If there are no such attributes,
     * this collection will be empty.
     *
     * @return
     *     A collection of all attributes applicable to user groups.
     */
    Collection<Form> getUserGroupAttributes();

    /**
     * Retrieves a collection of all attributes applicable to connections. This
     * collection will contain only those attributes which the current user has
     * general permission to view or modify. If there are no such attributes,
     * this collection will be empty.
     *
     * @return
     *     A collection of all attributes applicable to connections.
     */
    Collection<Form> getConnectionAttributes();

    /**
     * Retrieves a collection of all attributes applicable to connection
     * groups. This collection will contain only those attributes which the
     * current user has general permission to view or modify. If there are no
     * such attributes, this collection will be empty.
     *
     * @return
     *     A collection of all attributes applicable to connection groups.
     */
    Collection<Form> getConnectionGroupAttributes();

    /**
     * Retrieves a collection of all attributes applicable to sharing profiles.
     * This collection will contain only those attributes which the current user
     * has general permission to view or modify. If there are no such
     * attributes, this collection will be empty.
     *
     * @return
     *     A collection of all attributes applicable to sharing profile.
     */
    Collection<Form> getSharingProfileAttributes();

    /**
     * Invalidates this user context, releasing all associated resources. This
     * function will be invoked when the user logs out, or when their session
     * is automatically invalidated.
     */
    void invalidate();

    /**
     * Returns a user context which provides privileged access. Unlike the
     * original user context, which is required to enforce its own permissions
     * and act only within the rights of the associated user, the user context
     * returned by this function MAY ignore the restrictions that otherwise
     * limit the current user's access.
     *
     * <p>This function is intended to allow extensions which decorate other
     * extensions to act independently of the restrictions that affect the
     * current user. This function will only be invoked by extensions and
     * WILL NOT be invoked directly by the web application. Implementations of
     * this function MAY still enforce access restrictions, particularly if
     * they do not want to grant full, unrestricted access to other extensions.
     *
     * <p>A default implementation which simply returns <code>this</code> is
     * provided for compatibility with Apache Guacamole 1.1.0 and older.
     *
     * @return
     *     A user context instance which MAY ignore some or all restrictions
     *     which otherwise limit the current user's access.
     */
    default UserContext getPrivileged() {
        return this;
    }

}
