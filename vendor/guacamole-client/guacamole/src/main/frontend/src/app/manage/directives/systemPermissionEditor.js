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
 * A directive for manipulating the system permissions granted within a given
 * {@link PermissionFlagSet}, tracking the specific permissions added or
 * removed within a separate pair of {@link PermissionSet} objects. Optionally,
 * the permission for a particular user to update themselves (change their own
 * password/attributes) may also be manipulated.
 */
angular.module('manage').directive('systemPermissionEditor', ['$injector',
    function systemPermissionEditor($injector) {

    // Required services
    var authenticationService = $injector.get('authenticationService');
    var dataSourceService     = $injector.get('dataSourceService');
    var permissionService     = $injector.get('permissionService');
    var requestService        = $injector.get('requestService');

    // Required types
    var PermissionSet = $injector.get('PermissionSet');

    var directive = {

        // Element only
        restrict: 'E',
        replace: true,

        scope: {

            /**
             * The unique identifier of the data source associated with the
             * permissions being manipulated.
             *
             * @type String
             */
            dataSource : '=',

            /**
             * The username of the user whose self-update permission (whether
             * the user has permission to update their own user account) should
             * be additionally controlled by this editor. If no such user
             * permissions should be controlled, this should be left undefined.
             *
             * @type String
             */
            username : '=',

            /**
             * The current state of the permissions being manipulated. This
             * {@link PemissionFlagSet} will be modified as changes are made
             * through this permission editor.
             *
             * @type PermissionFlagSet
             */
            permissionFlags : '=',

            /**
             * The set of permissions that have been added, relative to the
             * initial state of the permissions being manipulated.
             *
             * @type PermissionSet
             */
            permissionsAdded : '=',

            /**
             * The set of permissions that have been removed, relative to the
             * initial state of the permissions being manipulated.
             *
             * @type PermissionSet
             */
            permissionsRemoved : '='

        },

        templateUrl: 'app/manage/templates/systemPermissionEditor.html'

    };

    directive.controller = ['$scope', function systemPermissionEditorController($scope) {

        /**
         * The identifiers of all data sources currently available to the
         * authenticated user.
         *
         * @type String[]
         */
        var dataSources = authenticationService.getAvailableDataSources();

        /**
         * The username of the current, authenticated user.
         *
         * @type String
         */
        var currentUsername = authenticationService.getCurrentUsername();

        /**
         * Available system permission types, as translation string / internal
         * value pairs.
         *
         * @type Object[]
         */
        $scope.systemPermissionTypes = [
            {
                label: "MANAGE_USER.FIELD_HEADER_ADMINISTER_SYSTEM",
                value: PermissionSet.SystemPermissionType.ADMINISTER
            },
            {
                label: "MANAGE_USER.FIELD_HEADER_AUDIT_SYSTEM",
                value: PermissionSet.SystemPermissionType.AUDIT
            },
            {
                label: "MANAGE_USER.FIELD_HEADER_CREATE_NEW_USERS",
                value: PermissionSet.SystemPermissionType.CREATE_USER
            },
            {
                label: "MANAGE_USER.FIELD_HEADER_CREATE_NEW_USER_GROUPS",
                value: PermissionSet.SystemPermissionType.CREATE_USER_GROUP
            },
            {
                label: "MANAGE_USER.FIELD_HEADER_CREATE_NEW_CONNECTIONS",
                value: PermissionSet.SystemPermissionType.CREATE_CONNECTION
            },
            {
                label: "MANAGE_USER.FIELD_HEADER_CREATE_NEW_CONNECTION_GROUPS",
                value: PermissionSet.SystemPermissionType.CREATE_CONNECTION_GROUP
            },
            {
                label: "MANAGE_USER.FIELD_HEADER_CREATE_NEW_SHARING_PROFILES",
                value: PermissionSet.SystemPermissionType.CREATE_SHARING_PROFILE
            }
        ];

        // Query the permissions granted to the currently-authenticated user
        dataSourceService.apply(
            permissionService.getEffectivePermissions,
            dataSources,
            currentUsername
        )
        .then(function permissionsReceived(permissions) {
            $scope.permissions = permissions;
        }, requestService.DIE);

        /**
         * Returns whether the current user has permission to change the system
         * permissions granted to users.
         *
         * @returns {Boolean}
         *     true if the current user can grant or revoke system permissions
         *     to the permission set being edited, false otherwise.
         */
        $scope.canChangeSystemPermissions = function canChangeSystemPermissions() {

            // Do not check if permissions are not yet loaded
            if (!$scope.permissions)
                return false;

            // Only the administrator can modify system permissions
            return PermissionSet.hasSystemPermission($scope.permissions[$scope.dataSource],
                PermissionSet.SystemPermissionType.ADMINISTER);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the addition of the given system permission.
         *
         * @param {String} type
         *     The system permission to add, as defined by
         *     PermissionSet.SystemPermissionType.
         */
        var addSystemPermission = function addSystemPermission(type) {

            // If permission was previously removed, simply un-remove it
            if (PermissionSet.hasSystemPermission($scope.permissionsRemoved, type))
                PermissionSet.removeSystemPermission($scope.permissionsRemoved, type);

            // Otherwise, explicitly add the permission
            else
                PermissionSet.addSystemPermission($scope.permissionsAdded, type);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the removal of the given system permission.
         *
         * @param {String} type
         *     The system permission to remove, as defined by
         *     PermissionSet.SystemPermissionType.
         */
        var removeSystemPermission = function removeSystemPermission(type) {

            // If permission was previously added, simply un-add it
            if (PermissionSet.hasSystemPermission($scope.permissionsAdded, type))
                PermissionSet.removeSystemPermission($scope.permissionsAdded, type);

            // Otherwise, explicitly remove the permission
            else
                PermissionSet.addSystemPermission($scope.permissionsRemoved, type);

        };

        /**
         * Notifies the controller that a change has been made to the given
         * system permission for the permission set being edited.
         *
         * @param {String} type
         *     The system permission that was changed, as defined by
         *     PermissionSet.SystemPermissionType.
         */
        $scope.systemPermissionChanged = function systemPermissionChanged(type) {

            // Determine current permission setting
            var granted = $scope.permissionFlags.systemPermissions[type];

            // Add/remove permission depending on flag state
            if (granted)
                addSystemPermission(type);
            else
                removeSystemPermission(type);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the addition of the given user permission.
         *
         * @param {String} type
         *     The user permission to add, as defined by
         *     PermissionSet.ObjectPermissionType.
         *
         * @param {String} identifier
         *     The identifier of the user affected by the permission being added.
         */
        var addUserPermission = function addUserPermission(type, identifier) {

            // If permission was previously removed, simply un-remove it
            if (PermissionSet.hasUserPermission($scope.permissionsRemoved, type, identifier))
                PermissionSet.removeUserPermission($scope.permissionsRemoved, type, identifier);

            // Otherwise, explicitly add the permission
            else
                PermissionSet.addUserPermission($scope.permissionsAdded, type, identifier);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the removal of the given user permission.
         *
         * @param {String} type
         *     The user permission to remove, as defined by
         *     PermissionSet.ObjectPermissionType.
         *
         * @param {String} identifier
         *     The identifier of the user affected by the permission being
         *     removed.
         */
        var removeUserPermission = function removeUserPermission(type, identifier) {

            // If permission was previously added, simply un-add it
            if (PermissionSet.hasUserPermission($scope.permissionsAdded, type, identifier))
                PermissionSet.removeUserPermission($scope.permissionsAdded, type, identifier);

            // Otherwise, explicitly remove the permission
            else
                PermissionSet.addUserPermission($scope.permissionsRemoved, type, identifier);

        };

        /**
         * Notifies the controller that a change has been made to the given user
         * permission for the permission set being edited.
         *
         * @param {String} type
         *     The user permission that was changed, as defined by
         *     PermissionSet.ObjectPermissionType.
         *
         * @param {String} identifier
         *     The identifier of the user affected by the changed permission.
         */
        $scope.userPermissionChanged = function userPermissionChanged(type, identifier) {

            // Determine current permission setting
            var granted = $scope.permissionFlags.userPermissions[type][identifier];

            // Add/remove permission depending on flag state
            if (granted)
                addUserPermission(type, identifier);
            else
                removeUserPermission(type, identifier);

        };

    }];

    return directive;

}]);
