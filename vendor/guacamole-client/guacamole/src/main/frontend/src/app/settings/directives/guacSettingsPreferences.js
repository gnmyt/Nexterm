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
 * A directive for managing preferences local to the current user.
 */
angular.module('settings').directive('guacSettingsPreferences', [function guacSettingsPreferences() {

    return {
        // Element only
        restrict: 'E',
        replace: true,

        scope: {},

        templateUrl: 'app/settings/templates/settingsPreferences.html',
        controller: ['$scope', '$injector', function settingsPreferencesController($scope, $injector) {

            // Get required types
            const Form          = $injector.get('Form');
            const PermissionSet = $injector.get('PermissionSet');

            // Required services
            const $translate            = $injector.get('$translate');
            const authenticationService = $injector.get('authenticationService');
            const guacNotification      = $injector.get('guacNotification');
            const permissionService     = $injector.get('permissionService');
            const preferenceService     = $injector.get('preferenceService');
            const requestService        = $injector.get('requestService');
            const schemaService         = $injector.get('schemaService');
            const userService           = $injector.get('userService');

            /**
             * An action to be provided along with the object sent to
             * showStatus which closes the currently-shown status dialog.
             */
            var ACKNOWLEDGE_ACTION = {
                name        : 'SETTINGS_PREFERENCES.ACTION_ACKNOWLEDGE',
                // Handle action
                callback    : function acknowledgeCallback() {
                    guacNotification.showStatus(false);
                }
            };

            /**
             * An action which closes the current dialog, and refreshes
             * the user data on dialog close.
             */
            const ACKNOWLEDGE_ACTION_RELOAD = {
                name        : 'SETTINGS_PREFERENCES.ACTION_ACKNOWLEDGE',
                // Handle action
                callback    : function acknowledgeCallback() {
                    userService.getUser(dataSource, username)
                        .then(user => $scope.user = user)
                        .then(() => guacNotification.showStatus(false));
                }
            };

            /**
             * The user being modified.
             *
             * @type User
             */
            $scope.user = null;

            /**
             * The username of the current user.
             *
             * @type String
             */
            var username = authenticationService.getCurrentUsername();

            /**
             * The identifier of the data source which authenticated the
             * current user.
             *
             * @type String
             */
            var dataSource = authenticationService.getDataSource();

            /**
             * All currently-set preferences, or their defaults if not yet set.
             *
             * @type Object.<String, Object>
             */
            $scope.preferences = preferenceService.preferences;

            /**
             * All available user attributes. This is only the set of attribute
             * definitions, organized as logical groupings of attributes, not attribute
             * values.
             *
             * @type Form[]
             */
            $scope.attributes = null;

            /**
             * The fields which should be displayed for choosing locale
             * preferences. Each field name must be a property on
             * $scope.preferences.
             *
             * @type Field[]
             */
            $scope.localeFields = [
                { 'type' : 'LANGUAGE', 'name' : 'language' },
                { 'type' : 'TIMEZONE', 'name' : 'timezone' }
            ];

            // Automatically update applied translation when language preference is changed
            $scope.$watch('preferences.language', function changeLanguage(language) {
                $translate.use(language);
            });

            /**
             * The new password for the user.
             *
             * @type String
             */
            $scope.newPassword = null;

            /**
             * The password match for the user. The update password action will
             * fail if $scope.newPassword !== $scope.passwordMatch.
             *
             * @type String
             */
            $scope.newPasswordMatch = null;

            /**
             * Whether the current user can edit themselves - i.e. update their
             * password or change user preference attributes, or null if this
             * is not yet known.
             *
             * @type Boolean
             */
            $scope.canUpdateSelf = null;

            /**
             * Update the current user's password to the password currently set within
             * the password change dialog.
             */
            $scope.updatePassword = function updatePassword() {

                // Verify passwords match
                if ($scope.newPasswordMatch !== $scope.newPassword) {
                    guacNotification.showStatus({
                        className  : 'error',
                        title      : 'SETTINGS_PREFERENCES.DIALOG_HEADER_ERROR',
                        text       : {
                            key : 'SETTINGS_PREFERENCES.ERROR_PASSWORD_MISMATCH'
                        },
                        actions    : [ ACKNOWLEDGE_ACTION ]
                    });
                    return;
                }
                
                // Verify that the new password is not blank
                if (!$scope.newPassword) {
                    guacNotification.showStatus({
                        className  : 'error',
                        title      : 'SETTINGS_PREFERENCES.DIALOG_HEADER_ERROR',
                        text       : {
                            key : 'SETTINGS_PREFERENCES.ERROR_PASSWORD_BLANK'
                        },
                        actions    : [ ACKNOWLEDGE_ACTION ]
                    });
                    return;
                }
                
                // Save the user with the new password
                userService.updateUserPassword(dataSource, username, $scope.oldPassword, $scope.newPassword)
                .then(function passwordUpdated() {
                
                    // Clear the password fields
                    $scope.oldPassword      = null;
                    $scope.newPassword      = null;
                    $scope.newPasswordMatch = null;

                    // Indicate that the password has been changed
                    guacNotification.showStatus({
                        text    : {
                            key : 'SETTINGS_PREFERENCES.INFO_PASSWORD_CHANGED'
                        },
                        actions : [ ACKNOWLEDGE_ACTION ]
                    });
                }, guacNotification.SHOW_REQUEST_ERROR);
                
            };

            // Retrieve current permissions
            permissionService.getEffectivePermissions(dataSource, username)
            .then(function permissionsRetrieved(permissions) {

                // Add action for updaing password or user preferences if permission is granted
                $scope.canUpdateSelf = (

                        // If permission is explicitly granted
                        PermissionSet.hasUserPermission(permissions,
                            PermissionSet.ObjectPermissionType.UPDATE, username)

                        // Or if implicitly granted through being an administrator
                        || PermissionSet.hasSystemPermission(permissions,
                            PermissionSet.SystemPermissionType.ADMINISTER));

            })
            ['catch'](requestService.createErrorCallback(function permissionsFailed(error) {
                $scope.canUpdateSelf = false;
            }));

            /**
             * Returns whether critical data has completed being loaded.
             *
             * @returns {Boolean}
             *     true if enough data has been loaded for the user interface to be
             *     useful, false otherwise.
             */
            $scope.isLoaded = function isLoaded() {

                return $scope.canUpdateSelf !== null
                    && $scope.languages     !== null;

            };


            /**
             * Saves the current user, displaying an acknowledgement message if
             * saving was successful, or an error if the save failed.
             */
            $scope.saveUser = function saveUser() {
                return userService.saveUser(dataSource, $scope.user)
                    .then(() =>  guacNotification.showStatus({
                        text    : {
                            key : 'SETTINGS_PREFERENCES.INFO_PREFERENCE_ATTRIBUTES_CHANGED'
                        },

                        // Reload the user on successful save in case any attributes changed
                        actions : [ ACKNOWLEDGE_ACTION_RELOAD ]
                    }),
                    guacNotification.SHOW_REQUEST_ERROR);
            };

            // Fetch the user record
            userService.getUser(dataSource, username).then(function saveUserData(user) {
                $scope.user = user;
            });

            // Fetch all user preference attribute forms defined
            schemaService.getUserPreferenceAttributes(dataSource).then(function saveAttributes(attributes) {
                $scope.attributes = attributes;
            });
        }]
    };
}]);
