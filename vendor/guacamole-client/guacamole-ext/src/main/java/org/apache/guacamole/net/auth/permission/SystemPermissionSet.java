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

import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;


/**
 * A set of permissions which affects the system as a whole.
 */
public interface SystemPermissionSet extends PermissionSet<SystemPermission> {

    /**
     * Tests whether the permission of the given type is granted.
     *
     * @param permission
     *     The permission to check.
     *
     * @return
     *     true if the permission is granted, false otherwise.
     *
     * @throws GuacamoleException
     *     If an error occurs while checking permissions, or if permissions
     *     cannot be checked due to lack of permissions to do so.
     */
    boolean hasPermission(SystemPermission.Type permission)
            throws GuacamoleException;

    /**
     * Adds the specified permission.
     *
     * @param permission
     *     The permission to add.
     *
     * @throws GuacamoleException
     *     If an error occurs while adding the permission, or if permission to
     *     add permissions is denied.
     */
    void addPermission(SystemPermission.Type permission)
            throws GuacamoleException;

    /**
     * Removes the specified permission.
     *
     * @param permission
     *     The permission to remove.
     *
     * @throws GuacamoleException
     *     If an error occurs while removing the permission, or if permission
     *     to remove permissions is denied.
     */
    void removePermission(SystemPermission.Type permission)
            throws GuacamoleException;

    @Override
    Set<SystemPermission> getPermissions() throws GuacamoleException;

    @Override
    void addPermissions(Set<SystemPermission> permissions)
            throws GuacamoleException;

    @Override
    void removePermissions(Set<SystemPermission> permissions)
            throws GuacamoleException;

    /**
     * An immutable instance of SystemPermissionSet which contains no
     * permissions.
     */
    static final SystemPermissionSet EMPTY_SET = new SystemPermissionSet() {

        @Override
        public boolean hasPermission(SystemPermission.Type permission)
                throws GuacamoleException {
            return false;
        }

        @Override
        public void addPermission(SystemPermission.Type permission)
                throws GuacamoleException {
            throw new GuacamoleSecurityException("Permission denied.");
        }

        @Override
        public void removePermission(SystemPermission.Type permission)
                throws GuacamoleException {
            throw new GuacamoleSecurityException("Permission denied.");
        }

        @Override
        public Set<SystemPermission> getPermissions()
                throws GuacamoleException {
            return Collections.emptySet();
        }

        @Override
        public void addPermissions(Set<SystemPermission> permissions)
                throws GuacamoleException {
            throw new GuacamoleSecurityException("Permission denied.");
        }

        @Override
        public void removePermissions(Set<SystemPermission> permissions)
                throws GuacamoleException {
            throw new GuacamoleSecurityException("Permission denied.");
        }

    };

}
