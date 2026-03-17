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

package org.apache.guacamole.rest.permission;

import java.util.HashSet;
import java.util.Set;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.permission.Permission;
import org.apache.guacamole.net.auth.permission.PermissionSet;

/**
 * A set of changes to be applied to a PermissionSet, describing the set of
 * permissions being added and removed.
 * 
 * @param <PermissionType>
 *     The type of permissions being added and removed.
 */
public class PermissionSetPatch<PermissionType extends Permission> {

    /**
     * The set of all permissions being added.
     */
    private final Set<PermissionType> addedPermissions =
            new HashSet<PermissionType>();
    
    /**
     * The set of all permissions being removed.
     */
    private final Set<PermissionType> removedPermissions =
            new HashSet<PermissionType>();

    /**
     * Queues the given permission to be added. The add operation will be
     * performed only when apply() is called.
     *
     * @param permission
     *     The permission to add.
     */
    public void addPermission(PermissionType permission) {
        addedPermissions.add(permission);
    }
    
    /**
     * Queues the given permission to be removed. The remove operation will be
     * performed only when apply() is called.
     *
     * @param permission
     *     The permission to remove.
     */
    public void removePermission(PermissionType permission) {
        removedPermissions.add(permission);
    }

    /**
     * Applies all queued changes to the given permission set.
     *
     * @param permissionSet
     *     The permission set to add and remove permissions from.
     *
     * @throws GuacamoleException
     *     If an error occurs while manipulating the permissions of the given
     *     permission set.
     */
    public void apply(PermissionSet<PermissionType> permissionSet)
        throws GuacamoleException {

        // Add any added permissions
        if (!addedPermissions.isEmpty())
            permissionSet.addPermissions(addedPermissions);

        // Remove any removed permissions
        if (!removedPermissions.isEmpty())
            permissionSet.removePermissions(removedPermissions);

    }
    
}
