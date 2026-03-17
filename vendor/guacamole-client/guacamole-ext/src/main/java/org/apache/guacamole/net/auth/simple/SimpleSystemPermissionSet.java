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

package org.apache.guacamole.net.auth.simple;

import java.util.Collections;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.GuacamoleSecurityException;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.net.auth.permission.SystemPermissionSet;

/**
 * A read-only implementation of SystemPermissionSet which uses a backing Set
 * of Permissions to determine which permissions are present.
 */
public class SimpleSystemPermissionSet implements SystemPermissionSet {

    /**
     * The set of all permissions currently granted.
     */
    private Set<SystemPermission> permissions = Collections.emptySet();

    /**
     * Creates a new empty SimpleSystemPermissionSet. If you are not extending
     * SimpleSystemPermissionSet and only need an immutable, empty
     * SystemPermissionSet, consider using {@link SystemPermissionSet#EMPTY_SET}
     * instead.
     */
    public SimpleSystemPermissionSet() {
    }

    /**
     * Creates a new SimpleSystemPermissionSet which contains the permissions
     * within the given Set.
     *
     * @param permissions 
     *     The Set of permissions this SimpleSystemPermissionSet should
     *     contain.
     */
    public SimpleSystemPermissionSet(Set<SystemPermission> permissions) {
        this.permissions = permissions;
    }

    /**
     * Sets the Set which backs this SimpleSystemPermissionSet. Future function
     * calls on this SimpleSystemPermissionSet will use the provided Set.
     *
     * @param permissions 
     *     The Set of permissions this SimpleSystemPermissionSet should
     *     contain.
     */
    protected void setPermissions(Set<SystemPermission> permissions) {
        this.permissions = permissions;
    }

    @Override
    public Set<SystemPermission> getPermissions() {
        return permissions;
    }

    @Override
    public boolean hasPermission(SystemPermission.Type permission)
            throws GuacamoleException {

        SystemPermission systemPermission = new SystemPermission(permission);
        return permissions.contains(systemPermission);

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
    public void addPermissions(Set<SystemPermission> permissions)
            throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

    @Override
    public void removePermissions(Set<SystemPermission> permissions)
            throws GuacamoleException {
        throw new GuacamoleSecurityException("Permission denied.");
    }

}
