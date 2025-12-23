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
 * A directive for controlling the zoom level and scale-to-fit behavior of a
 * a single Guacamole client.
 */
angular.module('client').directive('guacClientZoom', [function guacClientZoom() {

    const directive = {
        restrict: 'E',
        replace: true,
        templateUrl: 'app/client/templates/guacClientZoom.html'
    };

    directive.scope = {

        /**
         * The client to control the zoom/autofit of.
         *
         * @type ManagedClient
         */
        client : '='

    };

    directive.controller = ['$scope', '$injector', '$element',
            function guacClientZoomController($scope, $injector, $element) {

        /**
         * Zooms in by 10%, automatically disabling autofit.
         */
        $scope.zoomIn = function zoomIn() {
            $scope.client.clientProperties.autoFit = false;
            $scope.client.clientProperties.scale += 0.1;
        };

        /**
         * Zooms out by 10%, automatically disabling autofit.
         */
        $scope.zoomOut = function zoomOut() {
            $scope.client.clientProperties.autoFit = false;
            $scope.client.clientProperties.scale -= 0.1;
        };

        /**
         * Resets the client autofit setting to false.
         */
        $scope.clearAutoFit = function clearAutoFit() {
            $scope.client.clientProperties.autoFit = false;
        };

        /**
         * Notifies that the autofit setting has been manually changed by the
         * user.
         */
        $scope.autoFitChanged = function autoFitChanged() {

            // Reset to 100% scale when autofit is first disabled
            if (!$scope.client.clientProperties.autoFit)
                $scope.client.clientProperties.scale = 1;

        };

    }];

    return directive;

}]);