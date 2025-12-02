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
 * A directive for managing all users in the system.
 */
angular.module('settings').directive('guacSettingsUsers', [function guacSettingsUsers() {
    
    return {
        // Element only
        restrict: 'E',
        replace: true,

        scope: {
        },

        templateUrl: 'app/settings/templates/settingsUsers.html',
        controller: ['$scope', '$injector', function settingsUsersController($scope, $injector) {

            // Required types
            var ManageableUser  = $injector.get('ManageableUser');
            var PermissionSet   = $injector.get('PermissionSet');
            var SortOrder       = $injector.get('SortOrder');

            // Required services
            var $location              = $injector.get('$location');
            var $translate             = $injector.get('$translate');
            var authenticationService  = $injector.get('authenticationService');
            var dataSourceService      = $injector.get('dataSourceService');
            var permissionService      = $injector.get('permissionService');
            var requestService         = $injector.get('requestService');
            var userService            = $injector.get('userService');

            // Identifier of the current user
            var currentUsername = authenticationService.getCurrentUsername();

            /**
             * The identifiers of all data sources accessible by the current
             * user.
             *
             * @type String[]
             */
            var dataSources = authenticationService.getAvailableDataSources();

            /**
             * All visible users, along with their corresponding data sources.
             *
             * @type ManageableUser[]
             */
            $scope.manageableUsers = null;

            /**
             * The name of the new user to create, if any, when user creation
             * is requested via newUser().
             *
             * @type String
             */
            $scope.newUsername = "";

            /**
             * Map of data source identifiers to all permissions associated
             * with the current user within that data source, or null if the
             * user's permissions have not yet been loaded.
             *
             * @type Object.<String, PermissionSet>
             */
            $scope.permissions = null;

            /**
             * Array of all user properties that are filterable.
             *
             * @type String[]
             */
            $scope.filteredUserProperties = [
                'user.attributes["guac-full-name"]',
                'user.attributes["guac-organization"]',
                'user.lastActive',
                'user.username'
            ];

            /**
             * The date format for use for the last active date.
             *
             * @type String
             */
            $scope.dateFormat = null;

            /**
             * SortOrder instance which stores the sort order of the listed
             * users.
             *
             * @type SortOrder
             */
            $scope.order = new SortOrder([
                'user.username',
                '-user.lastActive',
                'user.attributes["guac-organization"]',
                'user.attributes["guac-full-name"]'
            ]);

            // Get session date format
            $translate('SETTINGS_USERS.FORMAT_DATE')
            .then(function dateFormatReceived(retrievedDateFormat) {

                // Store received date format
                $scope.dateFormat = retrievedDateFormat;

            }, angular.noop);

            /**
             * Returns whether critical data has completed being loaded.
             *
             * @returns {Boolean}
             *     true if enough data has been loaded for the user interface
             *     to be useful, false otherwise.
             */
            $scope.isLoaded = function isLoaded() {

                return $scope.dateFormat      !== null
                    && $scope.manageableUsers !== null
                    && $scope.permissions     !== null;

            };

            /**
             * Returns the identifier of the data source that should be used by
             * default when creating a new user.
             *
             * @return {String}
             *     The identifier of the data source that should be used by
             *     default when creating a new user, or null if user creation
             *     is not allowed.
             */
            $scope.getDefaultDataSource = function getDefaultDataSource() {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return null;

                // For each data source
                var dataSources = _.keys($scope.permissions).sort();
                for (var i = 0; i < dataSources.length; i++) {

                    // Retrieve corresponding permission set
                    var dataSource = dataSources[i];
                    var permissionSet = $scope.permissions[dataSource];

                    // Can create users if adminstrator or have explicit permission
                    if (PermissionSet.hasSystemPermission(permissionSet, PermissionSet.SystemPermissionType.ADMINISTER)
                     || PermissionSet.hasSystemPermission(permissionSet, PermissionSet.SystemPermissionType.CREATE_USER))
                        return dataSource;

                }

                // No data sources allow user creation
                return null;

            };

            /**
             * Returns whether the current user can create new users within at
             * least one data source.
             *
             * @return {Boolean}
             *     true if the current user can create new users within at
             *     least one data source, false otherwise.
             */
            $scope.canCreateUsers = function canCreateUsers() {
                return $scope.getDefaultDataSource() !== null;
            };

            /**
             * Returns whether the current user can create new users or make
             * changes to existing users within at least one data source. The
             * user management interface as a whole is useless if this function
             * returns false.
             *
             * @return {Boolean}
             *     true if the current user can create new users or make
             *     changes to existing users within at least one data source,
             *     false otherwise.
             */
            var canManageUsers = function canManageUsers() {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return false;

                // Creating users counts as management
                if ($scope.canCreateUsers())
                    return true;

                // For each data source
                for (var dataSource in $scope.permissions) {

                    // Retrieve corresponding permission set
                    var permissionSet = $scope.permissions[dataSource];

                    // Can manage users if granted explicit update or delete
                    if (PermissionSet.hasUserPermission(permissionSet, PermissionSet.ObjectPermissionType.UPDATE)
                     || PermissionSet.hasUserPermission(permissionSet, PermissionSet.ObjectPermissionType.DELETE))
                        return true;

                }

                // No data sources allow management of users
                return false;

            };

            // Retrieve current permissions
            dataSourceService.apply(
                permissionService.getEffectivePermissions,
                dataSources,
                currentUsername
            )
            .then(function permissionsRetrieved(permissions) {

                // Store retrieved permissions
                $scope.permissions = permissions;

                // Return to home if there's nothing to do here
                if (!canManageUsers())
                    $location.path('/');

                var userPromise;

                // If users can be created, list all readable users
                if ($scope.canCreateUsers())
                    userPromise = dataSourceService.apply(userService.getUsers, dataSources);

                // Otherwise, list only updateable/deletable users
                else
                    userPromise = dataSourceService.apply(userService.getUsers, dataSources, [
                        PermissionSet.ObjectPermissionType.UPDATE,
                        PermissionSet.ObjectPermissionType.DELETE
                    ]);

                userPromise.then(function usersReceived(allUsers) {

                    var addedUsers = {};
                    $scope.manageableUsers = [];

                    // For each user in each data source
                    angular.forEach(dataSources, function addUserList(dataSource) {
                        angular.forEach(allUsers[dataSource], function addUser(user) {

                            // Do not add the same user twice
                            if (addedUsers[user.username])
                                return;

                            // Link to default creation data source if we cannot manage this user
                            if (!PermissionSet.hasSystemPermission(permissions[dataSource], PermissionSet.ObjectPermissionType.ADMINISTER)
                             && !PermissionSet.hasUserPermission(permissions[dataSource], PermissionSet.ObjectPermissionType.UPDATE, user.username)
                             && !PermissionSet.hasUserPermission(permissions[dataSource], PermissionSet.ObjectPermissionType.DELETE, user.username))
                                dataSource = $scope.getDefaultDataSource();

                            // Add user to overall list
                            addedUsers[user.username] = user;
                            $scope.manageableUsers.push(new ManageableUser ({
                                'dataSource' : dataSource,
                                'user'       : user
                            }));

                        });
                    });

                }, requestService.DIE);

            }, requestService.DIE);
            
        }]
    };
    
}]);
