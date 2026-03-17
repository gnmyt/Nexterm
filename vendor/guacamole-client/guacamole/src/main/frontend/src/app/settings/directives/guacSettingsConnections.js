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
 * A directive for managing all connections and connection groups in the system.
 */
angular.module('settings').directive('guacSettingsConnections', [function guacSettingsConnections() {
    
    return {
        // Element only
        restrict: 'E',
        replace: true,

        scope: {
        },

        templateUrl: 'app/settings/templates/settingsConnections.html',
        controller: ['$scope', '$injector', function settingsConnectionsController($scope, $injector) {

            // Required types
            var ConnectionGroup = $injector.get('ConnectionGroup');
            var GroupListItem   = $injector.get('GroupListItem');
            var PermissionSet   = $injector.get('PermissionSet');

            // Required services
            var $location              = $injector.get('$location');
            var $routeParams           = $injector.get('$routeParams');
            var authenticationService  = $injector.get('authenticationService');
            var connectionGroupService = $injector.get('connectionGroupService');
            var dataSourceService      = $injector.get('dataSourceService');
            var guacNotification       = $injector.get('guacNotification');
            var permissionService      = $injector.get('permissionService');
            var requestService         = $injector.get('requestService');

            /**
             * The identifier of the current user.
             *
             * @type String
             */
            var currentUsername = authenticationService.getCurrentUsername();

            /**
             * The identifier of the currently-selected data source.
             *
             * @type String
             */
            $scope.dataSource = $routeParams.dataSource;

            /**
             * The root connection group of the connection group hierarchy.
             *
             * @type Object.<String, ConnectionGroup>
             */
            $scope.rootGroups = null;

            /**
             * All permissions associated with the current user, or null if the
             * user's permissions have not yet been loaded.
             *
             * @type PermissionSet
             */
            $scope.permissions = null;

            /**
             * Array of all connection properties that are filterable.
             *
             * @type String[]
             */
            $scope.filteredConnectionProperties = [
                'name',
                'protocol'
            ];

            /**
             * Array of all connection group properties that are filterable.
             *
             * @type String[]
             */
            $scope.filteredConnectionGroupProperties = [
                'name'
            ];

            /**
             * Returns whether critical data has completed being loaded.
             *
             * @returns {Boolean}
             *     true if enough data has been loaded for the user interface
             *     to be useful, false otherwise.
             */
            $scope.isLoaded = function isLoaded() {

                return $scope.rootGroup   !== null
                    && $scope.permissions !== null;

            };

            /**
             * Returns whether the current user has the ADMINISTER system
             * permission (i.e. they are an administrator).
             *
             * @return {Boolean}
             *     true if the current user is an administrator.
             */
            $scope.canAdminister = function canAdminister() {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return false;

                // Return whether the current user is an administrator
                return PermissionSet.hasSystemPermission(
                        $scope.permissions, PermissionSet.SystemPermissionType.ADMINISTER);
            };

            /**
             * Returns whether the current user can create new connections
             * within the current data source.
             *
             * @return {Boolean}
             *     true if the current user can create new connections within
             *     the current data source, false otherwise.
             */
            $scope.canCreateConnections = function canCreateConnections() {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return false;

                // Can create connections if adminstrator or have explicit permission
                if (PermissionSet.hasSystemPermission($scope.permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                 || PermissionSet.hasSystemPermission($scope.permissions, PermissionSet.SystemPermissionType.CREATE_CONNECTION))
                     return true;

                // No data sources allow connection creation
                return false;

            };

            /**
             * Returns whether the current user can create new connection
             * groups within the current data source.
             *
             * @return {Boolean}
             *     true if the current user can create new connection groups
             *     within the current data source, false otherwise.
             */
            $scope.canCreateConnectionGroups = function canCreateConnectionGroups() {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return false;

                // Can create connections groups if adminstrator or have explicit permission
                if (PermissionSet.hasSystemPermission($scope.permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                 || PermissionSet.hasSystemPermission($scope.permissions, PermissionSet.SystemPermissionType.CREATE_CONNECTION_GROUP))
                     return true;

                // No data sources allow connection group creation
                return false;

            };

            /**
             * Returns whether the current user can create new sharing profiles
             * within the current data source.
             *
             * @return {Boolean}
             *     true if the current user can create new sharing profiles
             *     within the current data source, false otherwise.
             */
            $scope.canCreateSharingProfiles = function canCreateSharingProfiles() {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return false;

                // Can create sharing profiles if adminstrator or have explicit permission
                if (PermissionSet.hasSystemPermission($scope.permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                 || PermissionSet.hasSystemPermission($scope.permissions, PermissionSet.SystemPermissionType.CREATE_SHARING_PROFILE))
                     return true;

                // Current data source does not allow sharing profile creation
                return false;

            };

            /**
             * Returns whether the current user can create new connections or
             * connection groups or make changes to existing connections or
             * connection groups within the current data source. The
             * connection management interface as a whole is useless if this
             * function returns false.
             *
             * @return {Boolean}
             *     true if the current user can create new connections/groups
             *     or make changes to existing connections/groups within the
             *     current data source, false otherwise.
             */
            $scope.canManageConnections = function canManageConnections() {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return false;

                // Creating connections/groups counts as management
                if ($scope.canCreateConnections()
                        || $scope.canCreateConnectionGroups()
                        || $scope.canCreateSharingProfiles())
                    return true;

                // Can manage connections if granted explicit update or delete
                if (PermissionSet.hasConnectionPermission($scope.permissions, PermissionSet.ObjectPermissionType.UPDATE)
                 || PermissionSet.hasConnectionPermission($scope.permissions, PermissionSet.ObjectPermissionType.DELETE))
                    return true;

                // Can manage connections groups if granted explicit update or delete
                if (PermissionSet.hasConnectionGroupPermission($scope.permissions, PermissionSet.ObjectPermissionType.UPDATE)
                 || PermissionSet.hasConnectionGroupPermission($scope.permissions, PermissionSet.ObjectPermissionType.DELETE))
                    return true;

                // No data sources allow management of connections or groups
                return false;

            };

            /**
             * Returns whether the current user can update the connection having
             * the given identifier within the current data source.
             *
             * @param {String} identifier
             *     The identifier of the connection to check.
             *
             * @return {Boolean}
             *     true if the current user can update the connection having the
             *     given identifier within the current data source, false
             *     otherwise.
             */
            $scope.canUpdateConnection = function canUpdateConnection(identifier) {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return false;

                // Can update the connection if adminstrator or have explicit permission
                if (PermissionSet.hasSystemPermission($scope.permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                 || PermissionSet.hasConnectionPermission($scope.permissions, PermissionSet.ObjectPermissionType.UPDATE, identifier))
                     return true;

                // Current data sources does not allow the connection to be updated
                return false;

            };

            /**
             * Returns whether the current user can update the connection group
             * having the given identifier within the current data source.
             *
             * @param {String} identifier
             *     The identifier of the connection group to check.
             *
             * @return {Boolean}
             *     true if the current user can update the connection group
             *     having the given identifier within the current data source,
             *     false otherwise.
             */
            $scope.canUpdateConnectionGroup = function canUpdateConnectionGroup(identifier) {

                // Abort if permissions have not yet loaded
                if (!$scope.permissions)
                    return false;

                // Can update the connection if adminstrator or have explicit permission
                if (PermissionSet.hasSystemPermission($scope.permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                 || PermissionSet.hasConnectionGroupPermission($scope.permissions, PermissionSet.ObjectPermissionType.UPDATE, identifier))
                     return true;

                // Current data sources does not allow the connection group to be updated
                return false;

            };

            /**
             * Adds connection-group-specific contextual actions to the given
             * array of GroupListItems. Each contextual action will be
             * represented by a new GroupListItem.
             *
             * @param {GroupListItem[]} items
             *     The array of GroupListItems to which new GroupListItems
             *     representing connection-group-specific contextual actions
             *     should be added.
             *
             * @param {GroupListItem} [parent]
             *     The GroupListItem representing the connection group which
             *     contains the given array of GroupListItems, if known.
             */
            var addConnectionGroupActions = function addConnectionGroupActions(items, parent) {

                // Do nothing if we lack permission to modify the parent at all
                if (parent && !$scope.canUpdateConnectionGroup(parent.identifier))
                    return;

                // Add action for creating a child connection, if the user has
                // permission to do so
                if ($scope.canCreateConnections())
                    items.push(new GroupListItem({
                        type        : 'new-connection',
                        dataSource  : $scope.dataSource,
                        weight      : 1,
                        wrappedItem : parent
                    }));

                // Add action for creating a child connection group, if the user
                // has permission to do so
                if ($scope.canCreateConnectionGroups())
                    items.push(new GroupListItem({
                        type        : 'new-connection-group',
                        dataSource  : $scope.dataSource,
                        weight      : 1,
                        wrappedItem : parent
                    }));

            };

            /**
             * Adds connection-specific contextual actions to the given array of
             * GroupListItems. Each contextual action will be represented by a
             * new GroupListItem.
             *
             * @param {GroupListItem[]} items
             *     The array of GroupListItems to which new GroupListItems
             *     representing connection-specific contextual actions should
             *     be added.
             *
             * @param {GroupListItem} [parent]
             *     The GroupListItem representing the connection which contains
             *     the given array of GroupListItems, if known.
             */
            var addConnectionActions = function addConnectionActions(items, parent) {

                // Do nothing if we lack permission to modify the parent at all
                if (parent && !$scope.canUpdateConnection(parent.identifier))
                    return;

                // Add action for creating a child sharing profile, if the user
                // has permission to do so
                if ($scope.canCreateSharingProfiles())
                    items.push(new GroupListItem({
                        type        : 'new-sharing-profile',
                        dataSource  : $scope.dataSource,
                        weight      : 1,
                        wrappedItem : parent
                    }));

            };

            /**
             * Decorates the given GroupListItem, including all descendants,
             * adding contextual actions.
             *
             * @param {GroupListItem} item
             *     The GroupListItem which should be decorated with additional
             *     GroupListItems representing contextual actions.
             */
            var decorateItem = function decorateItem(item) {

                // If the item is a connection group, add actions specific to
                // connection groups
                if (item.type === GroupListItem.Type.CONNECTION_GROUP)
                    addConnectionGroupActions(item.children, item);

                // If the item is a connection, add actions specific to
                // connections
                else if (item.type === GroupListItem.Type.CONNECTION)
                    addConnectionActions(item.children, item);

                // Decorate all children
                angular.forEach(item.children, decorateItem);

            };

            /**
             * Callback which decorates all items within the given array of
             * GroupListItems, including their descendants, adding contextual
             * actions.
             *
             * @param {GroupListItem[]} items
             *     The array of GroupListItems which should be decorated with
             *     additional GroupListItems representing contextual actions.
             */
            $scope.rootItemDecorator = function rootItemDecorator(items) {

                // Decorate each root-level item
                angular.forEach(items, decorateItem);

            };

            // Retrieve current permissions
            permissionService.getEffectivePermissions($scope.dataSource, currentUsername)
            .then(function permissionsRetrieved(permissions) {

                // Store retrieved permissions
                $scope.permissions = permissions;

                // Ignore permission to update root group
                PermissionSet.removeConnectionGroupPermission($scope.permissions, PermissionSet.ObjectPermissionType.UPDATE, ConnectionGroup.ROOT_IDENTIFIER);

                // Return to home if there's nothing to do here
                if (!$scope.canManageConnections())
                    $location.path('/');

                // Retrieve all connections for which we have UPDATE or DELETE permission
                dataSourceService.apply(
                    connectionGroupService.getConnectionGroupTree,
                    [$scope.dataSource],
                    ConnectionGroup.ROOT_IDENTIFIER,
                    [PermissionSet.ObjectPermissionType.UPDATE, PermissionSet.ObjectPermissionType.DELETE]
                )
                .then(function connectionGroupsReceived(rootGroups) {
                    $scope.rootGroups = rootGroups;
                }, requestService.DIE);

            }, requestService.DIE); // end retrieve permissions

        }]
    };
    
}]);
