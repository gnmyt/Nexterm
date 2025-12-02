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
 * A directive which graphically represents an individual user.
 */
angular.module('list').directive('guacUserItem', [function guacUserItem() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The username of the user represented by this guacUserItem.
             *
             * @type String
             */
            username : '='

        },

        templateUrl: 'app/list/templates/guacUserItem.html',
        controller: ['$scope', '$injector',
            function guacUserItemController($scope, $injector) {

            // Required types
            var AuthenticationResult = $injector.get('AuthenticationResult');

            // Required services
            var $translate = $injector.get('$translate');

            /**
             * The string to display when listing the user having the provided
             * username. Generally, this will be the username itself, but can
             * also be an arbitrary human-readable representation of the user,
             * or null if the display name is not yet determined.
             *
             * @type String
             */
            $scope.displayName = null;

            /**
             * Returns whether the username provided to this directive denotes
             * a user that authenticated anonymously.
             *
             * @returns {Boolean}
             *     true if the username provided represents an anonymous user,
             *     false otherwise.
             */
            $scope.isAnonymous = function isAnonymous() {
                return $scope.username === AuthenticationResult.ANONYMOUS_USERNAME;
            };

            // Update display name whenever provided username changes
            $scope.$watch('username', function updateDisplayName(username) {

                // If the user is anonymous, pull the display name for anonymous
                // users from the translation service
                if ($scope.isAnonymous()) {
                    $translate('LIST.TEXT_ANONYMOUS_USER')
                    .then(function retrieveAnonymousDisplayName(anonymousDisplayName) {
                        $scope.displayName = anonymousDisplayName;
                    }, angular.noop);
                }

                // For all other users, use the username verbatim
                else
                    $scope.displayName = username;

            });

        }] // end controller

    };
}]);
