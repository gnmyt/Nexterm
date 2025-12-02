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

package org.apache.guacamole.net.auth.permission;

import java.util.Set;
import org.apache.guacamole.GuacamoleException;


/**
 * An arbitrary set of permissions.
 *
 * @param <PermissionType>
 *     The type of permission stored within this PermissionSet.
 */
public interface PermissionSet<PermissionType extends Permission> {

    /**
     * Returns a Set which contains all permissions granted within this
     * permission set.
     *
     * @return
     *     A Set containing all permissions granted within this permission set.
     *
     * @throws GuacamoleException 
     *     If an error occurs while retrieving permissions, or if permissions
     *     cannot be retrieved due to lack of permissions to do so.
     */
    Set<PermissionType> getPermissions() throws GuacamoleException;

    /**
     * Adds the specified permissions, if not already granted. If a specified
     * permission is already granted, no operation is performed regarding that
     * permission.
     *
     * @param permissions
     *     The permissions to add.
     *
     * @throws GuacamoleException
     *     If an error occurs while adding the permissions, or if permission to
     *     add permissions is denied.
     */
    void addPermissions(Set<PermissionType> permissions)
            throws GuacamoleException;

    /**
     * Removes each of the specified permissions, if granted. If a specified
     * permission is not granted, no operation is performed regarding that
     * permission.
     *
     * @param permissions
     *     The permissions to remove.
     *
     * @throws GuacamoleException
     *     If an error occurs while removing the permissions, or if permission
     *     to remove permissions is denied.
     */
    void removePermissions(Set<PermissionType> permissions)
            throws GuacamoleException;


}
