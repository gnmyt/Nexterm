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
 * A directive for the guacamole client.
 */
angular.module('notification').directive('guacNotification', [function guacNotification() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The notification to display.
             *
             * @type Notification|Object 
             */
            notification : '='

        },

        templateUrl: 'app/notification/templates/guacNotification.html',
        controller: ['$scope', '$interval', function guacNotificationController($scope, $interval) {

            // Update progress bar if end known
            $scope.$watch("notification.progress.ratio", function updateProgress(ratio) {
                $scope.progressPercent = ratio * 100;
            });

            $scope.$watch("notification", function resetTimeRemaining(notification) {

                var countdown = notification.countdown;

                // Clean up any existing interval
                if ($scope.interval)
                    $interval.cancel($scope.interval);

                // Update and handle countdown, if provided
                if (countdown) {

                    $scope.timeRemaining = countdown.remaining;

                    $scope.interval = $interval(function updateTimeRemaining() {

                        // Update time remaining
                        $scope.timeRemaining--;

                        // Call countdown callback when time remaining expires
                        if ($scope.timeRemaining === 0 && countdown.callback)
                            countdown.callback();

                    }, 1000, $scope.timeRemaining);

                }

            });

            // Clean up interval upon destruction
            $scope.$on("$destroy", function destroyNotification() {

                if ($scope.interval)
                    $interval.cancel($scope.interval);

            });

        }]

    };
}]);
