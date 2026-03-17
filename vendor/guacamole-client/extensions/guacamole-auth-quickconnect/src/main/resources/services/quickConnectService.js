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
 * Service for managing quickConnect extension.
 */
angular.module('guacQuickConnect').factory('quickConnectService', ['$injector',
        function quickConnectService($injector) {

    // Required services
    var authenticationService = $injector.get('authenticationService');
    var cacheService          = $injector.get('cacheService');
    var requestService        = $injector.get('requestService');
    
    var service = {};
    
    /**
     * Makes a request to the REST API to create a connection, returning a
     * promise that can be used for processing the results of the call.
     * 
     * @param {uri} The URI of the connection to create.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     save operation is successful.
     */
    service.createConnection = function createConnection(uri) {
        
        // Build HTTP parameters set
        var httpParameters = {
            token : authenticationService.getCurrentToken()
        };

        return requestService({
            method  : 'POST',
            url     : 'api/session/ext/quickconnect/create',
            params  : httpParameters,
            data    : $.param({uri: uri}),
            headers : {'Content-Type': 'application/x-www-form-urlencoded'}
        })
        .then(function connectionCreated(connectionId) {
            // Clear connections and users from cache.
            cacheService.connections.removeAll();
            cacheService.users.removeAll();

            // Pass on the connection identifier
            return connectionId.identifier;
        });

    };
    
    return service;
}]);
