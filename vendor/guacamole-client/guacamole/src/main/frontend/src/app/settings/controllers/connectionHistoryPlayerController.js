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
 * The controller for the session recording player page.
 */
angular.module('settings').controller('connectionHistoryPlayerController', ['$scope', '$injector',
        function connectionHistoryPlayerController($scope, $injector) {

    // Required services
    const authenticationService = $injector.get('authenticationService');
    const $routeParams          = $injector.get('$routeParams');

    /**
     * The URL of the REST API resource exposing the requested session
     * recording.
     *
     * @type {!string}
     */
    const recordingURL = 'api/session/data/' + encodeURIComponent($routeParams.dataSource)
            + '/history/connections/' + encodeURIComponent($routeParams.identifier)
            + '/logs/' + encodeURIComponent($routeParams.name);

    /**
     * The tunnel which should be used to download the Guacamole session
     * recording.
     *
     * @type Guacamole.Tunnel
     */
    $scope.tunnel = new Guacamole.StaticHTTPTunnel(recordingURL, false, {
        'Guacamole-Token' : authenticationService.getCurrentToken()
    });

}]);
