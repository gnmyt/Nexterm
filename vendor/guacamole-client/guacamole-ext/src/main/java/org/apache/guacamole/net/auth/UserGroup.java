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

import org.apache.guacamole.GuacamoleException;

/**
 * A user group of the Guacamole web application. Each user group may contain
 * any number of Guacamole users and other user groups, and defines the
 * permissions implicitly granted to its members.
 */
public interface UserGroup extends Disableable, Identifiable, Attributes, Permissions {

    /**
     * Returns a set of all readable user groups of which this user group is a
     * member. If permission is granted for the current user to modify the
     * membership of this user group, then the returned set will be mutable,
     * and any such modifications should be made through changes to the
     * returned set.
     *
     * @return
     *     The set of all readable user groups of which this user group is a
     *     member.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the user groups.
     */
    RelatedObjectSet getUserGroups() throws GuacamoleException;

    /**
     * Returns a set of all readable users that are members of this user group.
     * If permission is granted for the current user to modify the members of
     * this group, then the returned set will be mutable, and any such
     * modifications should be made through changes to the returned set.
     *
     * @return
     *     The set all readable users that are members of this user group,
     *     which may be mutable.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the users.
     */
    RelatedObjectSet getMemberUsers() throws GuacamoleException;

    /**
     * Returns a set of all readable user groups that are members of this user
     * group. If permission is granted for the current user to modify the
     * members of this group, then the returned set will be mutable, and any
     * such modifications should be made through changes to the returned set.
     *
     * @return
     *     The set of all readable user groups that are members of this user
     *     group, which may be mutable.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving the user groups.
     */
    RelatedObjectSet getMemberUserGroups() throws GuacamoleException;

}
