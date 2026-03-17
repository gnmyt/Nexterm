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

import java.util.List;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.PATCH;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import org.apache.guacamole.GuacamoleClientException;
import org.apache.guacamole.GuacamoleException;
import org.apache.guacamole.net.auth.Permissions;
import org.apache.guacamole.net.auth.permission.ObjectPermission;
import org.apache.guacamole.net.auth.permission.Permission;
import org.apache.guacamole.net.auth.permission.SystemPermission;
import org.apache.guacamole.rest.jsonpatch.APIPatch;

/**
 * A REST resource which abstracts the operations available on the permissions
 * granted to an existing User or UserGroup.
 */
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class PermissionSetResource {

    /**
     * The prefix of any path within an operation of a JSON patch which modifies
     * the permissions of a user or user group regarding a specific connection.
     */
    private static final String CONNECTION_PERMISSION_PATCH_PATH_PREFIX = "/connectionPermissions/";

    /**
     * The prefix of any path within an operation of a JSON patch which modifies
     * the permissions of a user or user group regarding a specific connection
     * group.
     */
    private static final String CONNECTION_GROUP_PERMISSION_PATCH_PATH_PREFIX = "/connectionGroupPermissions/";

    /**
     * The prefix of any path within an operation of a JSON patch which modifies
     * the permissions of a user or user group regarding a specific sharing
     * profile.
     */
    private static final String SHARING_PROFILE_PERMISSION_PATCH_PATH_PREFIX = "/sharingProfilePermissions/";

    /**
     * The prefix of any path within an operation of a JSON patch which modifies
     * the permissions of a user or user group regarding a specific active
     * connection.
     */
    private static final String ACTIVE_CONNECTION_PERMISSION_PATCH_PATH_PREFIX = "/activeConnectionPermissions/";

    /**
     * The prefix of any path within an operation of a JSON patch which modifies
     * the permissions of a user or user group regarding a specific user.
     */
    private static final String USER_PERMISSION_PATCH_PATH_PREFIX = "/userPermissions/";

    /**
     * The prefix of any path within an operation of a JSON patch which modifies
     * the permissions of a user or user group regarding a specific user group.
     */
    private static final String USER_GROUP_PERMISSION_PATCH_PATH_PREFIX = "/userGroupPermissions/";

    /**
     * The path of any operation within a JSON patch which modifies the
     * permissions of a user or user group regarding the entire system.
     */
    private static final String SYSTEM_PERMISSION_PATCH_PATH = "/systemPermissions";

    /**
     * The permissions represented by this PermissionSetResource.
     */
    private final Permissions permissions;

    /**
     * Creates a new PermissionSetResource which exposes the operations and
     * subresources available for the given Permissions object.
     *
     * @param permissions
     *     The permissions that should be represented by this
     *     PermissionSetResource.
     */
    public PermissionSetResource(Permissions permissions) {
        this.permissions = permissions;
    }

    /**
     * Gets a list of all permissions granted to the user or user group
     * associated with this PermissionSetResource.
     *
     * @return
     *     A list of all permissions granted to the user or user group
     *     associated with this PermissionSetResource.
     *
     * @throws GuacamoleException
     *     If an error occurs while retrieving permissions.
     */
    @GET
    public APIPermissionSet getPermissions() throws GuacamoleException {
        return new APIPermissionSet(permissions);
    }

    /**
     * Updates the given permission set patch by queuing an add or remove
     * operation for the given permission based on the given patch operation.
     *
     * @param <PermissionType>
     *     The type of permission stored within the permission set.
     *
     * @param operation
     *     The patch operation to perform.
     *
     * @param permissionSetPatch
     *     The permission set patch being modified.
     *
     * @param permission
     *     The permission being added or removed from the set.
     *
     * @throws GuacamoleException
     *     If the requested patch operation is not supported.
     */
    private <PermissionType extends Permission> void updatePermissionSet(
            APIPatch.Operation operation,
            PermissionSetPatch<PermissionType> permissionSetPatch,
            PermissionType permission) throws GuacamoleException {

        // Add or remove permission based on operation
        switch (operation) {

            // Add permission
            case add:
                permissionSetPatch.addPermission(permission);
                break;

            // Remove permission
            case remove:
                permissionSetPatch.removePermission(permission);
                break;

            // Unsupported patch operation
            default:
                throw new GuacamoleClientException("Unsupported patch operation: \"" + operation + "\"");

        }

    }

    /**
     * Applies a given list of permission patches. Each patch specifies either
     * an "add" or a "remove" operation for a permission type, represented by
     * a string. Valid permission types depend on the path of each patch
     * operation, as the path dictates the permission being modified, such as
     * "/connectionPermissions/42" or "/systemPermissions".
     *
     * @param patches
     *     The permission patches to apply for this request.
     *
     * @throws GuacamoleException
     *     If a problem is encountered while modifying permissions.
     */
    @PATCH
    public void patchPermissions(List<APIPatch<String>> patches)
            throws GuacamoleException {

        // Permission patches for all types of permissions
        PermissionSetPatch<ObjectPermission> connectionPermissionPatch       = new PermissionSetPatch<ObjectPermission>();
        PermissionSetPatch<ObjectPermission> connectionGroupPermissionPatch  = new PermissionSetPatch<ObjectPermission>();
        PermissionSetPatch<ObjectPermission> sharingProfilePermissionPatch   = new PermissionSetPatch<ObjectPermission>();
        PermissionSetPatch<ObjectPermission> activeConnectionPermissionPatch = new PermissionSetPatch<ObjectPermission>();
        PermissionSetPatch<ObjectPermission> userPermissionPatch             = new PermissionSetPatch<ObjectPermission>();
        PermissionSetPatch<ObjectPermission> userGroupPermissionPatch        = new PermissionSetPatch<ObjectPermission>();
        PermissionSetPatch<SystemPermission> systemPermissionPatch           = new PermissionSetPatch<SystemPermission>();

        // Apply all patch operations individually
        for (APIPatch<String> patch : patches) {

            String path = patch.getPath();

            // Create connection permission if path has connection prefix
            if (path.startsWith(CONNECTION_PERMISSION_PATCH_PATH_PREFIX)) {

                // Get identifier and type from patch operation
                String identifier = path.substring(CONNECTION_PERMISSION_PATCH_PATH_PREFIX.length());
                ObjectPermission.Type type = ObjectPermission.Type.valueOf(patch.getValue());

                // Create and update corresponding permission
                ObjectPermission permission = new ObjectPermission(type, identifier);
                updatePermissionSet(patch.getOp(), connectionPermissionPatch, permission);

            }

            // Create connection group permission if path has connection group prefix
            else if (path.startsWith(CONNECTION_GROUP_PERMISSION_PATCH_PATH_PREFIX)) {

                // Get identifier and type from patch operation
                String identifier = path.substring(CONNECTION_GROUP_PERMISSION_PATCH_PATH_PREFIX.length());
                ObjectPermission.Type type = ObjectPermission.Type.valueOf(patch.getValue());

                // Create and update corresponding permission
                ObjectPermission permission = new ObjectPermission(type, identifier);
                updatePermissionSet(patch.getOp(), connectionGroupPermissionPatch, permission);

            }

            // Create sharing profile permission if path has sharing profile prefix
            else if (path.startsWith(SHARING_PROFILE_PERMISSION_PATCH_PATH_PREFIX)) {

                // Get identifier and type from patch operation
                String identifier = path.substring(SHARING_PROFILE_PERMISSION_PATCH_PATH_PREFIX.length());
                ObjectPermission.Type type = ObjectPermission.Type.valueOf(patch.getValue());

                // Create and update corresponding permission
                ObjectPermission permission = new ObjectPermission(type, identifier);
                updatePermissionSet(patch.getOp(), sharingProfilePermissionPatch, permission);

            }

            // Create active connection permission if path has active connection prefix
            else if (path.startsWith(ACTIVE_CONNECTION_PERMISSION_PATCH_PATH_PREFIX)) {

                // Get identifier and type from patch operation
                String identifier = path.substring(ACTIVE_CONNECTION_PERMISSION_PATCH_PATH_PREFIX.length());
                ObjectPermission.Type type = ObjectPermission.Type.valueOf(patch.getValue());

                // Create and update corresponding permission
                ObjectPermission permission = new ObjectPermission(type, identifier);
                updatePermissionSet(patch.getOp(), activeConnectionPermissionPatch, permission);

            }

            // Create user permission if path has user prefix
            else if (path.startsWith(USER_PERMISSION_PATCH_PATH_PREFIX)) {

                // Get identifier and type from patch operation
                String identifier = path.substring(USER_PERMISSION_PATCH_PATH_PREFIX.length());
                ObjectPermission.Type type = ObjectPermission.Type.valueOf(patch.getValue());

                // Create and update corresponding permission
                ObjectPermission permission = new ObjectPermission(type, identifier);
                updatePermissionSet(patch.getOp(), userPermissionPatch, permission);

            }

            // Create user group permission if path has user group prefix
            else if (path.startsWith(USER_GROUP_PERMISSION_PATCH_PATH_PREFIX)) {

                // Get identifier and type from patch operation
                String identifier = path.substring(USER_GROUP_PERMISSION_PATCH_PATH_PREFIX.length());
                ObjectPermission.Type type = ObjectPermission.Type.valueOf(patch.getValue());

                // Create and update corresponding permission
                ObjectPermission permission = new ObjectPermission(type, identifier);
                updatePermissionSet(patch.getOp(), userGroupPermissionPatch, permission);

            }

            // Create system permission if path is system path
            else if (path.equals(SYSTEM_PERMISSION_PATCH_PATH)) {

                // Get identifier and type from patch operation
                SystemPermission.Type type = SystemPermission.Type.valueOf(patch.getValue());

                // Create and update corresponding permission
                SystemPermission permission = new SystemPermission(type);
                updatePermissionSet(patch.getOp(), systemPermissionPatch, permission);

            }

            // Otherwise, the path is not supported
            else
                throw new GuacamoleClientException("Unsupported patch path: \"" + path + "\"");

        } // end for each patch operation

        // Save the permission changes
        connectionPermissionPatch.apply(permissions.getConnectionPermissions());
        connectionGroupPermissionPatch.apply(permissions.getConnectionGroupPermissions());
        sharingProfilePermissionPatch.apply(permissions.getSharingProfilePermissions());
        activeConnectionPermissionPatch.apply(permissions.getActiveConnectionPermissions());
        userPermissionPatch.apply(permissions.getUserPermissions());
        userGroupPermissionPatch.apply(permissions.getUserGroupPermissions());
        systemPermissionPatch.apply(permissions.getSystemPermissions());

    }

}
