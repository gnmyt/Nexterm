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
 * A directive which displays frame rendering performance statistics for a
 * Guacamole client.
 */
angular.module('client').directive('guacClientStatistics', [function guacClientStatistics() {

    const directive = {
        restrict: 'E',
        templateUrl: 'app/ext/display-stats/templates/guacClientStatistics.html',
    };

    directive.scope = {

        /**
         * The Guacamole client to display frame rendering statistics for.
         *
         * @type ManagedClient
         */
        client : '='

    };

    directive.controller = ['$scope', function guacClientStatisticsController($scope) {

        /**
         * Updates the displayed frame rendering statistics to the values
         * within the given statistics object.
         *
         * @param {!Guacamole.Display.Statistics} stats
         *     An object containing general rendering performance statistics for
         *     the remote desktop, Guacamole server, and Guacamole client.
         */
        var updateStatistics = function updateStatistics(stats) {
            $scope.$apply(function statisticsChanged() {
                $scope.statistics = stats;
            });
        };

        /**
         * Returns whether the given value is a defined value that should be
         * rendered within the statistics toolbar.
         *
         * @param {number} value
         *     The value to test.
         *
         * @returns {!boolean}
         *     true if the given value should be rendered within the statistics
         *     toolbar, false otherwise.
         */
        $scope.hasValue = function hasValue(value) {
            return value || value === 0;
        };

        /**
         * Rounds the given numeric value to the nearest hundredth (two decimal places).
         *
         * @param {!number} value
         *     The value to round.
         *
         * @param {!number}
         *     The given value, rounded to the nearest hundredth.
         */
        $scope.round = function round(value) {
            return Math.round(value * 100) / 100;
        };

        // Assign/remove onstatistics handlers to track the statistics of the
        // current client
        $scope.$watch('client', function clientChanged(client, oldClient) {

            if (oldClient)
                oldClient.managedDisplay.display.onstatistics = null;

            client.managedDisplay.display.statisticWindow = 1000;
            client.managedDisplay.display.onstatistics = updateStatistics;

        });

        // Clear onstatistics handler when directive is being unloaded
        $scope.$on('$destroy', function scopeDestroyed() {
            if ($scope.client)
                $scope.client.managedDisplay.display.onstatistics = null;
        });

    }];

    return directive;

}]);
