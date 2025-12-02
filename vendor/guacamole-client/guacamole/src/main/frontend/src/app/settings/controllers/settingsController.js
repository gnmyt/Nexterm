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
 * The controller for the general settings page.
 */
angular.module('settings').controller('settingsController', ['$scope', '$injector',
        function settingsController($scope, $injector) {

    // Required services
    var $routeParams    = $injector.get('$routeParams');
    var userPageService = $injector.get('userPageService');

    /**
     * The array of settings pages available to the current user, or null if
     * not yet known.
     *
     * @type Page[]
     */
    $scope.settingsPages = null;

    /**
     * The currently-selected settings tab. This may be 'users', 'userGroups',
     * 'connections', 'history', 'preferences', or 'sessions'.
     *
     * @type String
     */
    $scope.activeTab = $routeParams.tab;

    // Retrieve settings pages
    userPageService.getSettingsPages()
    .then(function settingsPagesRetrieved(pages) {
        $scope.settingsPages = pages;
    });

}]);
