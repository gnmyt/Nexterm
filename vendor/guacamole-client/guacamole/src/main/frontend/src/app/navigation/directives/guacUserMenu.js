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
 * A directive which provides a user-oriented menu containing options for
 * navigation and configuration.
 */
angular.module('navigation').directive('guacUserMenu', [function guacUserMenu() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * Optional array of actions which are specific to this particular
             * location, as these actions may not be appropriate for other
             * locations which contain the user menu.
             *
             * @type MenuAction[]
             */
            localActions : '='

        },

        templateUrl: 'app/navigation/templates/guacUserMenu.html',
        controller: ['$scope', '$injector',
            function guacUserMenuController($scope, $injector) {

            // Required types
            var User = $injector.get('User');

            // Get required services
            var $location             = $injector.get('$location');
            var $route                = $injector.get('$route');
            var authenticationService = $injector.get('authenticationService');
            var requestService        = $injector.get('requestService');
            var userService           = $injector.get('userService');
            var userPageService       = $injector.get('userPageService');

            /**
             * The username of the current user.
             *
             * @type String
             */
            $scope.username = authenticationService.getCurrentUsername();

            /**
             * The user's full name. If not yet available, or if not defined,
             * this will be null.
             *
             * @type String
             */
            $scope.fullName = null;

            /**
             * A URL pointing to relevant user information such as the user's
             * email address. If not yet available, or if no such URL can be
             * determined, this will be null.
             *
             * @type String
             */
            $scope.userURL = null;

            /**
             * The organization, company, group, etc. that the user belongs to.
             * If not yet available, or if not defined, this will be null.
             *
             * @type String
             */
            $scope.organization = null;

            /**
             * The role that the user has at the organization, company, group,
             * etc. they belong to. If not yet available, or if not defined,
             * this will be null.
             *
             * @type String
             */
            $scope.role = null;

            // Display user profile attributes if available
            userService.getUser(authenticationService.getDataSource(), $scope.username)
                    .then(function userRetrieved(user) {

                // Pull basic profile information
                $scope.fullName = user.attributes[User.Attributes.FULL_NAME];
                $scope.organization = user.attributes[User.Attributes.ORGANIZATION];
                $scope.role = user.attributes[User.Attributes.ORGANIZATIONAL_ROLE];

                // Link to email address if available
                var email = user.attributes[User.Attributes.EMAIL_ADDRESS];
                $scope.userURL = email ? 'mailto:' + email : null;

            }, requestService.IGNORE);

            /**
             * The available main pages for the current user.
             * 
             * @type Page[]
             */
            $scope.pages = null;

            // Retrieve the main pages from the user page service
            userPageService.getMainPages()
            .then(function retrievedMainPages(pages) {
                $scope.pages = pages;
            });

            /**
             * Returns whether the current user has authenticated anonymously.
             *
             * @returns {Boolean}
             *     true if the current user has authenticated anonymously, false
             *     otherwise.
             */
            $scope.isAnonymous = function isAnonymous() {
                return authenticationService.isAnonymous();
            };

            /**
             * Logs out the current user, redirecting them to back to the root
             * after logout completes.
             */
            $scope.logout = function logout() {
                authenticationService.logout()
                ['catch'](requestService.IGNORE);
            };

            /**
             * Action which logs out the current user, redirecting them to back
             * to the login screen after logout completes.
             */
            var LOGOUT_ACTION = {
                name      : 'USER_MENU.ACTION_LOGOUT',
                className : 'logout',
                callback  : $scope.logout
            };

            /**
             * All available actions for the current user.
             */
            $scope.actions = [ LOGOUT_ACTION ];

        }] // end controller

    };
}]);
