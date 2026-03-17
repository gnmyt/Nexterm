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

/**
 * Service for operating on user permissions via the REST API.
 */
angular.module('rest').factory('permissionService', ['$injector',
        function permissionService($injector) {

    // Required services
    var requestService        = $injector.get('requestService');
    var authenticationService = $injector.get('authenticationService');
    var cacheService          = $injector.get('cacheService');
    
    // Required types
    var PermissionPatch = $injector.get('PermissionPatch');

    var service = {};

    /**
     * Returns the URL for the REST resource most appropriate for accessing
     * the effective permissions of the user having the given username.
     * Effective permissions differ from the permissions returned via
     * getPermissions() in that permissions which are not directly granted to
     * the user are included.
     *
     * It is important to note that a particular data source can authenticate
     * and provide permissions for a user, even if that user does not exist
     * within that data source (and thus cannot be found beneath
     * "api/session/data/{dataSource}/users")
     *
     * NOTE: Unlike getPermissionsResourceURL(),
     * getEffectivePermissionsResourceURL() CANNOT be applied to user groups.
     * Only users have retrievable effective permissions as far as the REST API
     * is concerned.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user whose
     *     permissions should be retrieved. This identifier corresponds to an
     *     AuthenticationProvider within the Guacamole web application.
     *
     * @param {String} username
     *     The username of the user for which the URL of the proper REST
     *     resource should be derived.
     *
     * @returns {String}
     *     The URL for the REST resource representing the user having the given
     *     username.
     */
    var getEffectivePermissionsResourceURL = function getEffectivePermissionsResourceURL(dataSource, username) {

        // Create base URL for data source
        var base = 'api/session/data/' + encodeURIComponent(dataSource);

        // If the username is that of the current user, do not rely on the
        // user actually existing (they may not). Access their permissions via
        // "self" rather than the collection of defined users.
        if (username === authenticationService.getCurrentUsername())
            return base + '/self/effectivePermissions';

        // Otherwise, the user must exist for their permissions to be
        // accessible. Use the collection of defined users.
        return base + '/users/' + encodeURIComponent(username) + '/effectivePermissions';

    };

    /**
     * Makes a request to the REST API to get the list of effective permissions
     * for a given user, returning a promise that provides an array of
     * @link{Permission} objects if successful. Effective permissions differ
     * from the permissions returned via getPermissions() in that permissions
     * which are not directly granted to the user are included.
     *
     * NOTE: Unlike getPermissions(), getEffectivePermissions() CANNOT be
     * applied to user groups. Only users have retrievable effective
     * permissions as far as the REST API is concerned.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user whose
     *     permissions should be retrieved. This identifier corresponds to an
     *     AuthenticationProvider within the Guacamole web application.
     *
     * @param {String} userID
     *     The ID of the user to retrieve the permissions for.
     *
     * @returns {Promise.<PermissionSet>}
     *     A promise which will resolve with a @link{PermissionSet} upon
     *     success.
     */
    service.getEffectivePermissions = function getEffectivePermissions(dataSource, userID) {

        // Retrieve user permissions
        return authenticationService.request({
            cache   : cacheService.users,
            method  : 'GET',
            url     : getEffectivePermissionsResourceURL(dataSource, userID)
        });

    };

    /**
     * Returns the URL for the REST resource most appropriate for accessing
     * the permissions of the user or group having the given identifier. The
     * permissions retrieved differ from effective permissions (those returned
     * by getEffectivePermissions()) in that only permissions which are directly
     * granted to the user or group are included.
     * 
     * It is important to note that a particular data source can authenticate
     * and provide permissions for a user, even if that user does not exist
     * within that data source (and thus cannot be found beneath
     * "api/session/data/{dataSource}/users")
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user whose
     *     permissions should be retrieved. This identifier corresponds to an
     *     AuthenticationProvider within the Guacamole web application.
     *
     * @param {String} identifier
     *     The identifier of the user or group for which the URL of the proper
     *     REST resource should be derived.
     *
     * @param {Boolean} [group]
     *     Whether the provided identifier refers to a user group. If false or
     *     omitted, the identifier given is assumed to refer to a user.
     *
     * @returns {String}
     *     The URL for the REST resource representing the user or group having
     *     the given identifier.
     */
    var getPermissionsResourceURL = function getPermissionsResourceURL(dataSource, identifier, group) {

        // Create base URL for data source
        var base = 'api/session/data/' + encodeURIComponent(dataSource);

        // Access group permissions directly (there is no "self" for user groups
        // as there is for users)
        if (group)
            return base + '/userGroups/' + encodeURIComponent(identifier) + '/permissions';

        // If the username is that of the current user, do not rely on the
        // user actually existing (they may not). Access their permissions via
        // "self" rather than the collection of defined users.
        if (identifier === authenticationService.getCurrentUsername())
            return base + '/self/permissions';

        // Otherwise, the user must exist for their permissions to be
        // accessible. Use the collection of defined users.
        return base + '/users/' + encodeURIComponent(identifier) + '/permissions';

    };

    /**
     * Makes a request to the REST API to get the list of permissions for a
     * given user or user group, returning a promise that provides an array of
     * @link{Permission} objects if successful. The permissions retrieved
     * differ from effective permissions (those returned by
     * getEffectivePermissions()) in that both users and groups may be queried,
     * and only permissions which are directly granted to the user or group are
     * included.
     * 
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user or group
     *     whose permissions should be retrieved. This identifier corresponds to
     *     an AuthenticationProvider within the Guacamole web application.
     *
     * @param {String} identifier
     *     The identifier of the user or group to retrieve the permissions for.
     *
     * @param {Boolean} [group]
     *     Whether the provided identifier refers to a user group. If false or
     *     omitted, the identifier given is assumed to refer to a user.
     *
     * @returns {Promise.<PermissionSet>}
     *     A promise which will resolve with a @link{PermissionSet} upon
     *     success.
     */
    service.getPermissions = function getPermissions(dataSource, identifier, group) {

        // Retrieve user/group permissions
        return authenticationService.request({
            cache   : cacheService.users,
            method  : 'GET',
            url     : getPermissionsResourceURL(dataSource, identifier, group)
        });

    };

    /**
     * Adds patches for modifying the permissions associated with specific
     * objects to the given array of patches.
     *
     * @param {PermissionPatch[]} patch
     *     The array of patches to add new patches to.
     *
     * @param {String} operation
     *     The operation to specify within each of the patches. Valid values
     *     for this are defined within PermissionPatch.Operation.
     *     
     * @param {String} path
     *     The path of the permissions being patched. The path is a JSON path
     *     describing the position of the permissions within a PermissionSet.
     *
     * @param {Object.<String, String[]>} permissions
     *     A map of object identifiers to arrays of permission type strings,
     *     where each type string is a value from
     *     PermissionSet.ObjectPermissionType.
     */
    var addObjectPatchOperations = function addObjectPatchOperations(patch, operation, path, permissions) {

        // Add object permission operations to patch
        for (var identifier in permissions) {
            permissions[identifier].forEach(function addObjectPatch(type) {
                patch.push({
                    op    : operation,
                    path  : path + "/" + identifier,
                    value : type
                });
            });
        }

    };

    /**
     * Adds patches for modifying any permission that can be stored within a
     * @link{PermissionSet}.
     * 
     * @param {PermissionPatch[]} patch
     *     The array of patches to add new patches to.
     *
     * @param {String} operation
     *     The operation to specify within each of the patches. Valid values
     *     for this are defined within PermissionPatch.Operation.
     *
     * @param {PermissionSet} permissions
     *     The set of permissions for which patches should be added.
     */
    var addPatchOperations = function addPatchOperations(patch, operation, permissions) {

        // Add connection permission operations to patch
        addObjectPatchOperations(patch, operation, "/connectionPermissions",
            permissions.connectionPermissions);

        // Add connection group permission operations to patch
        addObjectPatchOperations(patch, operation, "/connectionGroupPermissions",
            permissions.connectionGroupPermissions);

        // Add sharing profile permission operations to patch
        addObjectPatchOperations(patch, operation, "/sharingProfilePermissions",
            permissions.sharingProfilePermissions);

        // Add active connection permission operations to patch
        addObjectPatchOperations(patch, operation, "/activeConnectionPermissions",
            permissions.activeConnectionPermissions);

        // Add user permission operations to patch
        addObjectPatchOperations(patch, operation, "/userPermissions",
            permissions.userPermissions);

        // Add user group permission operations to patch
        addObjectPatchOperations(patch, operation, "/userGroupPermissions",
            permissions.userGroupPermissions);

        // Add system operations to patch
        permissions.systemPermissions.forEach(function addSystemPatch(type) {
            patch.push({
                op    : operation,
                path  : "/systemPermissions",
                value : type
            });
        });

    };
            
    /**
     * Makes a request to the REST API to modify the permissions for a given
     * user or group, returning a promise that can be used for processing the
     * results of the call. This request affects only the permissions directly
     * granted to the user or group, and may not affect permissions inherited
     * through other means (effective permissions).
     * 
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user or group
     *     whose permissions should be modified. This identifier corresponds to
     *     an AuthenticationProvider within the Guacamole web application.
     *
     * @param {String} identifier
     *     The identifier of the user or group to modify the permissions of.
     *                          
     * @param {PermissionSet} [permissionsToAdd]
     *     The set of permissions to add, if any.
     *
     * @param {PermissionSet} [permissionsToRemove]
     *     The set of permissions to remove, if any.
     *
     * @param {Boolean} [group]
     *     Whether the provided identifier refers to a user group. If false or
     *     omitted, the identifier given is assumed to refer to a user.
     *
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     patch operation is successful.
     */
    service.patchPermissions = function patchPermissions(dataSource, identifier,
            permissionsToAdd, permissionsToRemove, group) {

        var permissionPatch = [];
        
        // Add all the add operations to the patch
        addPatchOperations(permissionPatch, PermissionPatch.Operation.ADD, permissionsToAdd);

        // Add all the remove operations to the patch
        addPatchOperations(permissionPatch, PermissionPatch.Operation.REMOVE, permissionsToRemove);

        // Patch user/group permissions
        return authenticationService.request({
            method  : 'PATCH', 
            url     : getPermissionsResourceURL(dataSource, identifier, group),
            data    : permissionPatch
        })
        
        // Clear the cache
        .then(function permissionsPatched(){
            cacheService.users.removeAll();
        });
    };
    
    return service;

}]);
