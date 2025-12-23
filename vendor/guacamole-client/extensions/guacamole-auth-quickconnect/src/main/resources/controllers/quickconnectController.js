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
 * The controller for making ad-hoc (quick) connections
 */
angular.module('guacQuickConnect').controller('quickconnectController', ['$scope', '$injector',
        function manageConnectionController($scope, $injector) {

    // Required types
    var ClientIdentifier    = $injector.get('ClientIdentifier');

    // Required services
    var $location            = $injector.get('$location');
    var guacNotification     = $injector.get('guacNotification');
    var quickConnectService  = $injector.get('quickConnectService');

    /**
     * The URI that will be passed in to the extension to create
     * the connection.
     */
    $scope.uri = null;

    /**
     * Saves the connection, creating a new connection or updating the existing
     * connection.
     */
    $scope.quickConnect = function quickConnect() {

        quickConnectService.createConnection($scope.uri)
        .then(function createdConnection(connectionId) {
            $location.url('/client/' + ClientIdentifier.toString({
                dataSource : 'quickconnect',
                type       : ClientIdentifier.Types.CONNECTION,
                id         : connectionId
            }));
        }, guacNotification.SHOW_REQUEST_ERROR);

        return;

    };

}]);
