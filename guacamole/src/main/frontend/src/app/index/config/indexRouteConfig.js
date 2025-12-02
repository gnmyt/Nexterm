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
 * The config block for setting up all the url routing.
 */
angular.module('index').config(['$routeProvider', '$locationProvider', 
        function indexRouteConfig($routeProvider, $locationProvider) {

    // Disable HTML5 mode (use # for routing)
    $locationProvider.html5Mode(false);

    // Clear hash prefix to keep /#/thing/bat URL style
    $locationProvider.hashPrefix('');

    /**
     * Attempts to re-authenticate with the Guacamole server, sending any
     * query parameters in the URL, along with the current auth token, and
     * updating locally stored token if necessary.
     *
     * @param {Service} $injector
     *     The Angular $injector service.
     * 
     * @returns {Promise}
     *     A promise which resolves successfully only after an attempt to
     *     re-authenticate has been made. If the authentication attempt fails,
     *     the promise will be rejected.
     */
    var updateCurrentToken = ['$injector', function updateCurrentToken($injector) {

        // Required services
        var $location             = $injector.get('$location');
        var authenticationService = $injector.get('authenticationService');

        // Re-authenticate including any parameters in URL
        return authenticationService.updateCurrentToken($location.search());

    }];

    /**
     * Redirects the user to their home page. This necessarily requires
     * attempting to re-authenticate with the Guacamole server, as the user's
     * credentials may have changed, and thus their most-appropriate home page
     * may have changed as well.
     *
     * @param {Service} $injector
     *     The Angular $injector service.
     * 
     * @returns {Promise}
     *     A promise which resolves successfully only after an attempt to
     *     re-authenticate and determine the user's proper home page has been
     *     made.
     */
    var routeToUserHomePage = ['$injector', function routeToUserHomePage($injector) {

        // Required services
        var $location       = $injector.get('$location');
        var $q              = $injector.get('$q');
        var userPageService = $injector.get('userPageService');

        // Promise for routing attempt
        var route = $q.defer();

        // Re-authenticate including any parameters in URL
        $injector.invoke(updateCurrentToken)
        .then(function tokenUpdateComplete() {

            // Redirect to home page
            userPageService.getHomePage()
            .then(function homePageRetrieved(homePage) {

                // If home page is the requested location, allow through
                if ($location.path() === homePage.url)
                    route.resolve();

                // Otherwise, reject and reroute
                else {
                    $location.path(homePage.url);
                    route.reject();
                }

            })

            // If retrieval of home page fails, assume requested page is OK
            ['catch'](function homePageFailed() {
                route.resolve();
            });

        })

        ['catch'](function tokenUpdateFailed() {
            route.reject();
        });

        // Return promise that will resolve only if the requested page is the
        // home page
        return route.promise;

    }];

    // Configure each possible route
    $routeProvider

        // Home screen
        .when('/', {
            title         : 'APP.NAME',
            bodyClassName : 'home',
            templateUrl   : 'app/home/templates/home.html',
            controller    : 'homeController',
            resolve       : { routeToUserHomePage: routeToUserHomePage }
        })

        // Connection import page
        .when('/import/:dataSource/connection', {
            title         : 'APP.NAME',
            bodyClassName : 'settings',
            templateUrl   : 'app/import/templates/connectionImport.html',
            controller    : 'importConnectionsController',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // Connection import file format help page
        .when('/import/connection/file-format-help', {
            title         : 'APP.NAME',
            bodyClassName : 'settings',
            templateUrl   : 'app/import/templates/connectionImportFileHelp.html',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // Management screen
        .when('/settings/:dataSource?/:tab', {
            title         : 'APP.NAME',
            bodyClassName : 'settings',
            templateUrl   : 'app/settings/templates/settings.html',
            controller    : 'settingsController',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // Connection editor
        .when('/manage/:dataSource/connections/:id*?', {
            title         : 'APP.NAME',
            bodyClassName : 'manage',
            templateUrl   : 'app/manage/templates/manageConnection.html',
            controller    : 'manageConnectionController',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // Sharing profile editor
        .when('/manage/:dataSource/sharingProfiles/:id*?', {
            title         : 'APP.NAME',
            bodyClassName : 'manage',
            templateUrl   : 'app/manage/templates/manageSharingProfile.html',
            controller    : 'manageSharingProfileController',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // Connection group editor
        .when('/manage/:dataSource/connectionGroups/:id*?', {
            title         : 'APP.NAME',
            bodyClassName : 'manage',
            templateUrl   : 'app/manage/templates/manageConnectionGroup.html',
            controller    : 'manageConnectionGroupController',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // User editor
        .when('/manage/:dataSource/users/:id*?', {
            title         : 'APP.NAME',
            bodyClassName : 'manage',
            templateUrl   : 'app/manage/templates/manageUser.html',
            controller    : 'manageUserController',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // User group editor
        .when('/manage/:dataSource/userGroups/:id*?', {
            title         : 'APP.NAME',
            bodyClassName : 'manage',
            templateUrl   : 'app/manage/templates/manageUserGroup.html',
            controller    : 'manageUserGroupController',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // Recording player
        .when('/settings/:dataSource/recording/:identifier/:name', {
            title         : 'APP.NAME',
            bodyClassName : 'settings',
            templateUrl   : 'app/settings/templates/settingsConnectionHistoryPlayer.html',
            controller    : 'connectionHistoryPlayerController',
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // Client view
        .when('/client/:id', {
            bodyClassName : 'client',
            templateUrl   : 'app/client/templates/client.html',
            controller    : 'clientController',
            reloadOnUrl   : false,
            resolve       : { updateCurrentToken: updateCurrentToken }
        })

        // Redirect to home screen if page not found
        .otherwise({
            resolve : { routeToUserHomePage: routeToUserHomePage }
        });

}]);
