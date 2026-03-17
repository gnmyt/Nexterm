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

import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleUnsupportedException;

/**
 * A user of the Guacamole web application.
 */
public interface User extends Disableable, Identifiable, Attributes, Permissions {

    /**
     * All standard attribute names with semantics defined by the Guacamole web
     * application. Extensions may additionally define their own attributes
     * with completely arbitrary names and semantics, so long as those names do
     * not conflict with the names listed here. All standard attribute names
     * have a "guac-" prefix to avoid such conflicts.
     */
    public static class Attribute {

        /**
         * The user's full name.
         */
        public static String FULL_NAME = "guac-full-name";

        /**
         * The email address of the user.
         */
        public static String EMAIL_ADDRESS = "guac-email-address";

        /**
         * The organization, company, group, etc. that the user belongs to.
         */
        public static String ORGANIZATION = "guac-organization";

        /**
         * The role that the user has at the organization, company, group, etc.
         * they belong to.
         */
        public static String ORGANIZATIONAL_ROLE = "guac-organizational-role";

    }

    /**
     * Returns this user's password. Note that the password returned may be
     * hashed or completely arbitrary.
     *
     * @return A String which may (or may not) be the user's password.
     */
    public String getPassword();

    /**
     * Sets this user's password. Note that while this function is guaranteed
     * to change the password of this User object, there is no guarantee that
     * getPassword() will return the value given to setPassword().
     *
     * @param password The password to set.
     */
    public void setPassword(String password);

    /**
     * Returns the date and time that this user was last active. If the user
     * was never active, the time that the user was last active is unknown, or
     * this information is not visible to the current user, this may be null.
     *
     * @return
     *     The date and time this user was last active, or null if this
     *     information is unavailable or inapplicable.
     */
    Date getLastActive();

    /**
     * Returns a list of ActivityRecords representing the login history
     * of this user, including any active sessions. ActivityRecords
     * in this list will be sorted in descending order of end time (active
     * sessions are first), and then in descending order of start time
     * (newer sessions are first). If user login history is not implemented
     * this method should throw GuacamoleUnsupportedException.
     *
     * @deprecated
     *     This function is deprecated in favor of {@link getUserHistory}, which
     *     returns the login history as an ActivityRecordSet which supports
     *     various sort and filter functions. While this continues to be defined
     *     for API compatibility, new implementation should avoid this function
     *     and use getUserHistory(), instead.
     * 
     * @return
     *     A list of ActivityRecords representing the login history of this
     *     User.
     *
     * @throws GuacamoleException
     *     If history tracking is not implemented, if an error occurs while
     *     reading the history of this user, or if permission is denied.
     */
    @Deprecated
    default List<? extends ActivityRecord> getHistory() throws GuacamoleException {
        return Collections.unmodifiableList(new ArrayList<>(getUserHistory().asCollection()));
    }
    
    /**
     * Returns an ActivityRecordSet containing ActivityRecords representing
     * the login history for this user, including any active sessions.
     * ActivityRecords in this list will be sorted in descending order of end
     * time (active sessions are first), and then in descending order of start
     * time (newer sessions are first). If login history tracking is not
     * implemented, or is only implemented using the deprecated {@link getHistory}
     * method, this method should throw GuacamoleUnsupportedException.
     * 
     * @return
     *     An ActivityRecordSet containing ActivityRecords representing the
     *     login history for this user.
     * 
     * @throws GuacamoleException
     *     If history tracking is not implemented, if an error occurs while
     *     reading the history of this user, or if permission is denied.
     */
    default ActivityRecordSet<ActivityRecord> getUserHistory()
            throws GuacamoleException {
        throw new GuacamoleUnsupportedException("The default implementation of User does not provide login history.");
    }

    /**
     * Returns a set of all readable user groups of which this user is a member.
     * If permission is granted for the current user to modify the membership of
     * this user, then the returned set will be mutable, and any such
     * modifications should be made through changes to the returned set.
     *
     * @return
     *     The set of all readable user groups of which this user is a member.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the user groups.
     */
    RelatedObjectSet getUserGroups() throws GuacamoleException;

    /**
     * Returns a read-only view of all permissions granted to this user. The
     * exact semantics of what permissions are granted are up to the
     * implementation, and the permissions within this view may be implied,
     * derived dynamically, inherited through multiple levels of group
     * membership, etc.
     *
     * @return
     *     A read-only view of the permissions which are granted to this user.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions, or if reading all
     *     permissions is not allowed.
     */
    Permissions getEffectivePermissions() throws GuacamoleException;

}
