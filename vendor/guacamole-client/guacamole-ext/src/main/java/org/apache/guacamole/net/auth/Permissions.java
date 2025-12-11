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
import org.apache.guacamole.net.auth.permission.ObjectPermissionSet;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * An object which may be granted permissions to access/manipulate various
 * other objects or aspects of the system. The permissions granted are exposed
 * through subclasses of PermissionSet, and may be mutable depending on the
 * access level of the current user.
 */
public interface Permissions {

    /**
     * Returns all permissions given to this object regarding currently-active
     * connections.
     *
     * @return
     *     An ObjectPermissionSet of all active connection permissions granted
     *     to this object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions, or if reading all
     *     permissions is not allowed.
     */
    ObjectPermissionSet getActiveConnectionPermissions()
            throws GuacamoleException;

    /**
     * Returns all connection group permissions given to this object.
     *
     * @return
     *     An ObjectPermissionSet of all connection group permissions granted
     *     to this object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions, or if reading all
     *     permissions is not allowed.
     */
    ObjectPermissionSet getConnectionGroupPermissions()
            throws GuacamoleException;

    /**
     * Returns all connection permissions given to this object.
     *
     * @return
     *     An ObjectPermissionSet of all connection permissions granted to this
     *     object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions, or if reading all
     *     permissions is not allowed.
     */
    ObjectPermissionSet getConnectionPermissions() throws GuacamoleException;

    /**
     * Returns all sharing profile permissions given to this object.
     *
     * @return
     *     An ObjectPermissionSet of all sharing profile permissions granted to
     *     this object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions, or if reading all
     *     permissions is not allowed.
     */
    ObjectPermissionSet getSharingProfilePermissions()
            throws GuacamoleException;

    /**
     * Returns all system-level permissions given to this object.
     *
     * @return
     *     A SystemPermissionSet of all system-level permissions granted to
     *     this object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions, or if reading all
     *     permissions is not allowed.
     */
    SystemPermissionSet getSystemPermissions() throws GuacamoleException;

    /**
     * Returns all user permissions given to this object.
     *
     * @return
     *     An ObjectPermissionSet of all user permissions granted to this
     *     object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions, or if reading all
     *     permissions is not allowed.
     */
    ObjectPermissionSet getUserPermissions() throws GuacamoleException;

    /**
     * Returns all user group permissions given to this object.
     *
     * @return
     *     An ObjectPermissionSet of all user group permissions granted to this
     *     object.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions, or if reading all
     *     permissions is not allowed.
     */
    ObjectPermissionSet getUserGroupPermissions() throws GuacamoleException;

}
