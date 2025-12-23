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
 * A directive for managing all user groups in the system.
 */
angular.module('settings').directive('guacSettingsUserGroups', ['$injector',
    function guacSettingsUserGroups($injector) {

    // Required types
    var ManageableUserGroup = $injector.get('ManageableUserGroup');
    var PermissionSet       = $injector.get('PermissionSet');
    var SortOrder           = $injector.get('SortOrder');

    // Required services
    var $location              = $injector.get('$location');
    var authenticationService  = $injector.get('authenticationService');
    var dataSourceService      = $injector.get('dataSourceService');
    var permissionService      = $injector.get('permissionService');
    var requestService         = $injector.get('requestService');
    var userGroupService       = $injector.get('userGroupService');

    var directive = {
        restrict    : 'E',
        replace     : true,
        templateUrl : 'app/settings/templates/settingsUserGroups.html',
        scope       : {}
    };

    directive.controller = ['$scope', function settingsUserGroupsController($scope) {

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
         * Map of data source identifiers to all permissions associated
         * with the current user within that data source, or null if the
         * user's permissions have not yet been loaded.
         *
         * @type Object.<String, PermissionSet>
         */
        var permissions = null;

        /**
         * All visible user groups, along with their corresponding data
         * sources.
         *
         * @type ManageableUserGroup[]
         */
        $scope.manageableUserGroups = null;

        /**
         * Array of all user group properties that are filterable.
         *
         * @type String[]
         */
        $scope.filteredUserGroupProperties = [
            'userGroup.identifier'
        ];

        /**
         * SortOrder instance which stores the sort order of the listed
         * user groups.
         *
         * @type SortOrder
         */
        $scope.order = new SortOrder([
            'userGroup.identifier'
        ]);

        /**
         * Returns whether critical data has completed being loaded.
         *
         * @returns {Boolean}
         *     true if enough data has been loaded for the user group
         *     interface to be useful, false otherwise.
         */
        $scope.isLoaded = function isLoaded() {
            return $scope.manageableUserGroups !== null;
        };

        /**
         * Returns the identifier of the data source that should be used by
         * default when creating a new user group.
         *
         * @return {String}
         *     The identifier of the data source that should be used by
         *     default when creating a new user group, or null if user group
         *     creation is not allowed.
         */
        $scope.getDefaultDataSource = function getDefaultDataSource() {

            // Abort if permissions have not yet loaded
            if (!permissions)
                return null;

            // For each data source
            var dataSources = _.keys(permissions).sort();
            for (var i = 0; i < dataSources.length; i++) {

                // Retrieve corresponding permission set
                var dataSource = dataSources[i];
                var permissionSet = permissions[dataSource];

                // Can create user groups if adminstrator or have explicit permission
                if (PermissionSet.hasSystemPermission(permissionSet, PermissionSet.SystemPermissionType.ADMINISTER)
                 || PermissionSet.hasSystemPermission(permissionSet, PermissionSet.SystemPermissionType.CREATE_USER_GROUP))
                    return dataSource;

            }

            // No data sources allow user group creation
            return null;

        };

        /**
         * Returns whether the current user can create new user groups
         * within at least one data source.
         *
         * @return {Boolean}
         *     true if the current user can create new user groups within at
         *     least one data source, false otherwise.
         */
        $scope.canCreateUserGroups = function canCreateUserGroups() {
            return $scope.getDefaultDataSource() !== null;
        };

        /**
         * Returns whether the current user can create new user groups or
         * make changes to existing user groups within at least one data
         * source. The user group management interface as a whole is useless
         * if this function returns false.
         *
         * @return {Boolean}
         *     true if the current user can create new user groups or make
         *     changes to existing user groups within at least one data
         *     source, false otherwise.
         */
        var canManageUserGroups = function canManageUserGroups() {

            // Abort if permissions have not yet loaded
            if (!permissions)
                return false;

            // Creating user groups counts as management
            if ($scope.canCreateUserGroups())
                return true;

            // For each data source
            for (var dataSource in permissions) {

                // Retrieve corresponding permission set
                var permissionSet = permissions[dataSource];

                // Can manage user groups if granted explicit update or delete
                if (PermissionSet.hasUserGroupPermission(permissionSet, PermissionSet.ObjectPermissionType.UPDATE)
                 || PermissionSet.hasUserGroupPermission(permissionSet, PermissionSet.ObjectPermissionType.DELETE))
                    return true;

            }

            // No data sources allow management of user groups
            return false;

        };

        /**
         * Sets the displayed list of user groups. If any user groups are
         * already shown within the interface, those user groups are replaced
         * with the given user groups.
         *
         * @param {Object.<String, PermissionSet>} permissions
         *     A map of data source identifiers to all permissions associated
         *     with the current user within that data source.
         *
         * @param {Object.<String, Object.<String, UserGroup>>} userGroups
         *     A map of all user groups which should be displayed, where each
         *     key is the data source identifier from which the user groups
         *     were retrieved and each value is a map of user group identifiers
         *     to their corresponding @link{UserGroup} objects.
         */
        var setDisplayedUserGroups = function setDisplayedUserGroups(permissions, userGroups) {

            var addedUserGroups = {};
            $scope.manageableUserGroups = [];

            // For each user group in each data source
            angular.forEach(dataSources, function addUserGroupList(dataSource) {
                angular.forEach(userGroups[dataSource], function addUserGroup(userGroup) {

                    // Do not add the same user group twice
                    if (addedUserGroups[userGroup.identifier])
                        return;

                    // Link to default creation data source if we cannot manage this user
                    if (!PermissionSet.hasSystemPermission(permissions[dataSource], PermissionSet.ObjectPermissionType.ADMINISTER)
                     && !PermissionSet.hasUserGroupPermission(permissions[dataSource], PermissionSet.ObjectPermissionType.UPDATE, userGroup.identifier)
                     && !PermissionSet.hasUserGroupPermission(permissions[dataSource], PermissionSet.ObjectPermissionType.DELETE, userGroup.identifier))
                        dataSource = $scope.getDefaultDataSource();

                    // Add user group to overall list
                    addedUserGroups[userGroup.identifier] = userGroup;
                    $scope.manageableUserGroups.push(new ManageableUserGroup ({
                        'dataSource' : dataSource,
                        'userGroup'  : userGroup
                    }));

                });
            });

        };

        // Retrieve current permissions
        dataSourceService.apply(
            permissionService.getEffectivePermissions,
            dataSources,
            currentUsername
        )
        .then(function permissionsRetrieved(retrievedPermissions) {

            // Store retrieved permissions
            permissions = retrievedPermissions;

            // Return to home if there's nothing to do here
            if (!canManageUserGroups())
                $location.path('/');

            // If user groups can be created, list all readable user groups
            if ($scope.canCreateUserGroups())
                return dataSourceService.apply(userGroupService.getUserGroups, dataSources);

            // Otherwise, list only updateable/deletable users
            return dataSourceService.apply(userGroupService.getUserGroups, dataSources, [
                PermissionSet.ObjectPermissionType.UPDATE,
                PermissionSet.ObjectPermissionType.DELETE
            ]);

        })
        .then(function userGroupsReceived(userGroups) {
            setDisplayedUserGroups(permissions, userGroups);
        }, requestService.WARN);

    }];

    return directive;
    
}]);
