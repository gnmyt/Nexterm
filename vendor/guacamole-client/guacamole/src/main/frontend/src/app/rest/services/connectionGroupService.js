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
 * Service for operating on connection groups via the REST API.
 */
angular.module('rest').factory('connectionGroupService', ['$injector',
        function connectionGroupService($injector) {

    // Required services
    var requestService        = $injector.get('requestService');
    var authenticationService = $injector.get('authenticationService');
    var cacheService          = $injector.get('cacheService');
    
    // Required types
    var ConnectionGroup = $injector.get('ConnectionGroup');

    var service = {};
    
    /**
     * Makes a request to the REST API to get an individual connection group
     * and all descendants, returning a promise that provides the corresponding
     * @link{ConnectionGroup} if successful. Descendant groups and connections
     * will be stored as children of that connection group. If a permission
     * type is specified, the result will be filtering by that permission.
     * 
     * @param {String} [connectionGroupID=ConnectionGroup.ROOT_IDENTIFIER]
     *     The ID of the connection group to retrieve. If not provided, the
     *     root connection group will be retrieved by default.
     *     
     * @param {String[]} [permissionTypes]
     *     The set of permissions to filter with. A user must have one or more
     *     of these permissions for a connection to appear in the result. 
     *     If null, no filtering will be performed. Valid values are listed
     *     within PermissionSet.ObjectType.
     *
     * @returns {Promise.ConnectionGroup}
     *     A promise which will resolve with a @link{ConnectionGroup} upon
     *     success.
     */
    service.getConnectionGroupTree = function getConnectionGroupTree(dataSource, connectionGroupID, permissionTypes) {
        
        // Use the root connection group ID if no ID is passed in
        connectionGroupID = connectionGroupID || ConnectionGroup.ROOT_IDENTIFIER;

        // Add permission filter if specified
        var httpParameters = {};
        if (permissionTypes)
            httpParameters.permission = permissionTypes;

        // Retrieve connection group 
        return authenticationService.request({
            cache   : cacheService.connections,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connectionGroups/' + encodeURIComponent(connectionGroupID) + '/tree',
            params  : httpParameters
        });
       
    };

    /**
     * Makes a request to the REST API to get an individual connection group,
     * returning a promise that provides the corresponding
     * @link{ConnectionGroup} if successful.
     *
     * @param {String} [connectionGroupID=ConnectionGroup.ROOT_IDENTIFIER]
     *     The ID of the connection group to retrieve. If not provided, the
     *     root connection group will be retrieved by default.
     *     
     * @returns {Promise.<ConnectionGroup>} A promise for the HTTP call.
     *     A promise which will resolve with a @link{ConnectionGroup} upon
     *     success.
     */
    service.getConnectionGroup = function getConnectionGroup(dataSource, connectionGroupID) {
        
        // Use the root connection group ID if no ID is passed in
        connectionGroupID = connectionGroupID || ConnectionGroup.ROOT_IDENTIFIER;
        
        // Retrieve connection group
        return authenticationService.request({
            cache   : cacheService.connections,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connectionGroups/' + encodeURIComponent(connectionGroupID)
        });

    };
    
    /**
     * Makes a request to the REST API to save a connection group, returning a
     * promise that can be used for processing the results of the call. If the
     * connection group is new, and thus does not yet have an associated
     * identifier, the identifier will be automatically set in the provided
     * connection group upon success.
     * 
     * @param {ConnectionGroup} connectionGroup The connection group to update.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     save operation is successful.
     */
    service.saveConnectionGroup = function saveConnectionGroup(dataSource, connectionGroup) {

        // If connection group is new, add it and set the identifier automatically
        if (!connectionGroup.identifier) {
            return authenticationService.request({
                method  : 'POST',
                url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connectionGroups',
                data    : connectionGroup
            })

            // Set the identifier on the new connection group and clear the cache
            .then(function connectionGroupCreated(newConnectionGroup){
                connectionGroup.identifier = newConnectionGroup.identifier;
                cacheService.connections.removeAll();

                // Clear users cache to force reload of permissions for this
                // newly created connection group
                cacheService.users.removeAll();
            });
        }

        // Otherwise, update the existing connection group
        else {
            return authenticationService.request({
                method  : 'PUT',
                url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connectionGroups/' + encodeURIComponent(connectionGroup.identifier),
                data    : connectionGroup
            })

            // Clear the cache
            .then(function connectionGroupUpdated(){
                cacheService.connections.removeAll();

                // Clear users cache to force reload of permissions for this
                // newly updated connection group
                cacheService.users.removeAll();
            });
        }

    };
    
    /**
     * Makes a request to the REST API to delete a connection group, returning
     * a promise that can be used for processing the results of the call.
     * 
     * @param {ConnectionGroup} connectionGroup The connection group to delete.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     delete operation is successful.
     */
    service.deleteConnectionGroup = function deleteConnectionGroup(dataSource, connectionGroup) {

        // Delete connection group
        return authenticationService.request({
            method  : 'DELETE',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connectionGroups/' + encodeURIComponent(connectionGroup.identifier)
        })

        // Clear the cache
        .then(function connectionGroupDeleted(){
            cacheService.connections.removeAll();
        });

    };
    
    return service;
}]);
