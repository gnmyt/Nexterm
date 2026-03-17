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
 * Service for operating on connections via the REST API.
 */
angular.module('rest').factory('connectionService', ['$injector',
        function connectionService($injector) {

    // Required services
    var authenticationService = $injector.get('authenticationService');
    var cacheService          = $injector.get('cacheService');
    
    var service = {};
    
    /**
     * Makes a request to the REST API to get a single connection, returning a
     * promise that provides the corresponding @link{Connection} if successful.
     * 
     * @param {String} id The ID of the connection.
     * 
     * @returns {Promise.<Connection>}
     *     A promise which will resolve with a @link{Connection} upon success.
     * 
     * @example
     * 
     * connectionService.getConnection('myConnection').then(function(connection) {
     *     // Do something with the connection
     * });
     */
    service.getConnection = function getConnection(dataSource, id) {

        // Retrieve connection
        return authenticationService.request({
            cache   : cacheService.connections,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connections/' + encodeURIComponent(id)
        });

    };

    /**
     * Makes a request to the REST API to get the usage history of a single
     * connection, returning a promise that provides the corresponding
     * array of @link{ConnectionHistoryEntry} objects if successful.
     * 
     * @param {String} id
     *     The identifier of the connection.
     * 
     * @returns {Promise.<ConnectionHistoryEntry[]>}
     *     A promise which will resolve with an array of
     *     @link{ConnectionHistoryEntry} objects upon success.
     */
    service.getConnectionHistory = function getConnectionHistory(dataSource, id) {

        // Retrieve connection history
        return authenticationService.request({
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connections/' + encodeURIComponent(id) + '/history'
        });
 
    };

    /**
     * Makes a request to the REST API to get the parameters of a single
     * connection, returning a promise that provides the corresponding
     * map of parameter name/value pairs if successful.
     * 
     * @param {String} id
     *     The identifier of the connection.
     * 
     * @returns {Promise.<Object.<String, String>>}
     *     A promise which will resolve with an map of parameter name/value
     *     pairs upon success.
     */
    service.getConnectionParameters = function getConnectionParameters(dataSource, id) {

        // Retrieve connection parameters
        return authenticationService.request({
            cache   : cacheService.connections,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connections/' + encodeURIComponent(id) + '/parameters'
        });
 
    };

    /**
     * Makes a request to the REST API to save a connection, returning a
     * promise that can be used for processing the results of the call. If the
     * connection is new, and thus does not yet have an associated identifier,
     * the identifier will be automatically set in the provided connection
     * upon success.
     * 
     * @param {Connection} connection The connection to update.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     save operation is successful.
     */
    service.saveConnection = function saveConnection(dataSource, connection) {
        
        // If connection is new, add it and set the identifier automatically
        if (!connection.identifier) {
            return authenticationService.request({
                method  : 'POST',
                url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connections',
                data    : connection
            })

            // Set the identifier on the new connection and clear the cache
            .then(function connectionCreated(newConnection){
                connection.identifier = newConnection.identifier;
                cacheService.connections.removeAll();

                // Clear users cache to force reload of permissions for this
                // newly created connection
                cacheService.users.removeAll();
            });
        }

        // Otherwise, update the existing connection
        else {
            return authenticationService.request({
                method  : 'PUT',
                url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connections/' + encodeURIComponent(connection.identifier),
                data    : connection
            })
            
            // Clear the cache
            .then(function connectionUpdated(){
                cacheService.connections.removeAll();

                // Clear users cache to force reload of permissions for this
                // newly updated connection
                cacheService.users.removeAll();
            });
        }

    };

    /**
     * Makes a request to the REST API to apply a supplied list of connection
     * patches, returning a promise that can be used for processing the results 
     * of the call. 
     * 
     * This operation is atomic - if any errors are encountered during the 
     * connection patching process, the entire request will fail, and no 
     * changes will be persisted.
     *
     * @param {String} dataSource
     *     The identifier of the data source associated with the connections to
     *     be patched.
     *
     * @param {DirectoryPatch.<Connection>[]} patches 
     *     An array of patches to apply.
     *
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     patch operation is successful.
     */
    service.patchConnections = function patchConnections(dataSource, patches) {

        // Make the PATCH request
        return authenticationService.request({
            method  : 'PATCH',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connections',
            data    : patches
        })

        // Clear the cache
        .then(function connectionsPatched(patchResponse){
            cacheService.connections.removeAll();

            // Clear users cache to force reload of permissions for any
            // newly created or replaced connections
            cacheService.users.removeAll();

            return patchResponse;
            
        });

    };
    
    /**
     * Makes a request to the REST API to delete a connection,
     * returning a promise that can be used for processing the results of the call.
     * 
     * @param {Connection} connection The connection to delete.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     delete operation is successful.
     */
    service.deleteConnection = function deleteConnection(dataSource, connection) {

        // Delete connection
        return authenticationService.request({
            method  : 'DELETE',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/connections/' + encodeURIComponent(connection.identifier)
        })

        // Clear the cache
        .then(function connectionDeleted(){
            cacheService.connections.removeAll();
        });

    };
    
    return service;
}]);
