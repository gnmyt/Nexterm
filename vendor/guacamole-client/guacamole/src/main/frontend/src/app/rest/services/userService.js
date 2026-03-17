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
 * Service for operating on users via the REST API.
 */
angular.module('rest').factory('userService', ['$injector',
        function userService($injector) {

    // Required services
    var requestService        = $injector.get('requestService');
    var authenticationService = $injector.get('authenticationService');
    var cacheService          = $injector.get('cacheService');

    // Get required types
    var UserPasswordUpdate = $injector.get("UserPasswordUpdate");
            
    var service = {};
    
    /**
     * Makes a request to the REST API to get the list of users,
     * returning a promise that provides an array of @link{User} objects if
     * successful.
     * 
     * @param {String} dataSource
     *     The unique identifier of the data source containing the users to be
     *     retrieved. This identifier corresponds to an AuthenticationProvider
     *     within the Guacamole web application.
     *
     * @param {String[]} [permissionTypes]
     *     The set of permissions to filter with. A user must have one or more
     *     of these permissions for a user to appear in the result. 
     *     If null, no filtering will be performed. Valid values are listed
     *     within PermissionSet.ObjectType.
     *                          
     * @returns {Promise.<Object.<String, User>>}
     *     A promise which will resolve with a map of @link{User} objects
     *     where each key is the identifier (username) of the corresponding
     *     user.
     */
    service.getUsers = function getUsers(dataSource, permissionTypes) {

        // Add permission filter if specified
        var httpParameters = {};
        if (permissionTypes)
            httpParameters.permission = permissionTypes;

        // Retrieve users
        return authenticationService.request({
            cache   : cacheService.users,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/users',
            params  : httpParameters
        });

    };

    /**
     * Makes a request to the REST API to get the user having the given
     * username, returning a promise that provides the corresponding
     * @link{User} if successful.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user to be
     *     retrieved. This identifier corresponds to an AuthenticationProvider
     *     within the Guacamole web application.
     *
     * @param {String} username
     *     The username of the user to retrieve.
     * 
     * @returns {Promise.<User>}
     *     A promise which will resolve with a @link{User} upon success.
     */
    service.getUser = function getUser(dataSource, username) {

        // Retrieve user
        return authenticationService.request({
            cache   : cacheService.users,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/users/' + encodeURIComponent(username)
        });

    };
    
    /**
     * Makes a request to the REST API to delete a user, returning a promise
     * that can be used for processing the results of the call.
     * 
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user to be
     *     deleted. This identifier corresponds to an AuthenticationProvider
     *     within the Guacamole web application.
     *
     * @param {User} user
     *     The user to delete.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     delete operation is successful.
     */
    service.deleteUser = function deleteUser(dataSource, user) {

        // Delete user
        return authenticationService.request({
            method  : 'DELETE',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/users/' + encodeURIComponent(user.username)
        })

        // Clear the cache
        .then(function userDeleted(){
            cacheService.users.removeAll();
        });


    };
    
    /**
     * Makes a request to the REST API to create a user, returning a promise
     * that can be used for processing the results of the call.
     * 
     * @param {String} dataSource
     *     The unique identifier of the data source in which the user should be
     *     created. This identifier corresponds to an AuthenticationProvider
     *     within the Guacamole web application.
     *
     * @param {User} user
     *     The user to create.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     create operation is successful.
     */
    service.createUser = function createUser(dataSource, user) {

        // Create user
        return authenticationService.request({
            method  : 'POST',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/users',
            data    : user
        })

        // Clear the cache
        .then(function userCreated(){
            cacheService.users.removeAll();
        });

    };
    
    /**
     * Makes a request to the REST API to save a user, returning a promise that
     * can be used for processing the results of the call.
     * 
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user to be
     *     updated. This identifier corresponds to an AuthenticationProvider
     *     within the Guacamole web application.
     *
     * @param {User} user
     *     The user to update.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     save operation is successful.
     */
    service.saveUser = function saveUser(dataSource, user) {

        // Update user
        return authenticationService.request({
            method  : 'PUT',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/users/' + encodeURIComponent(user.username),
            data    : user
        })

        // Clear the cache
        .then(function userUpdated(){
            cacheService.users.removeAll();
        });

    };
    
    /**
     * Makes a request to the REST API to update the password for a user, 
     * returning a promise that can be used for processing the results of the call.
     * 
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user to be
     *     updated. This identifier corresponds to an AuthenticationProvider
     *     within the Guacamole web application.
     *
     * @param {String} username
     *     The username of the user to update.
     *     
     * @param {String} oldPassword
     *     The exiting password of the user to update.
     *     
     * @param {String} newPassword
     *     The new password of the user to update.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     password update operation is successful.
     */
    service.updateUserPassword = function updateUserPassword(dataSource, username,
            oldPassword, newPassword) {

        // Update user password
        return authenticationService.request({
            method  : 'PUT',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/users/' + encodeURIComponent(username) + '/password',
            data    : new UserPasswordUpdate({
                oldPassword : oldPassword,
                newPassword : newPassword
            })
        })

        // Clear the cache
        .then(function passwordChanged(){
            cacheService.users.removeAll();
        });

    };

    /**
     * Makes a request to the REST API to apply a supplied list of user patches,
     * returning a promise that can be used for processing the results of the
     * call.
     *
     * This operation is atomic - if any errors are encountered during the
     * connection patching process, the entire request will fail, and no
     * changes will be persisted.
     *
     * @param {String} dataSource
     *     The identifier of the data source associated with the users to be
     *     patched.
     *
     * @param {DirectoryPatch.<User>[]} patches
     *     An array of patches to apply.
     *
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     patch operation is successful.
     */
    service.patchUsers = function patchUsers(dataSource, patches) {

        // Make the PATCH request
        return authenticationService.request({
            method  : 'PATCH',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/users',
            data    : patches
        })

        // Clear the cache
        .then(function usersPatched(patchResponse){
            cacheService.users.removeAll();
            return patchResponse;
        });

    };
    
    return service;

}]);
