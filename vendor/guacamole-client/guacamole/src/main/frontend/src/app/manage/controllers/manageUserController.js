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
 * The controller for editing users.
 */
angular.module('manage').controller('manageUserController', ['$scope', '$injector', 
        function manageUserController($scope, $injector) {
            
    // Required types
    var Error                 = $injector.get('Error');
    var ManagementPermissions = $injector.get('ManagementPermissions');
    var PermissionFlagSet     = $injector.get('PermissionFlagSet');
    var PermissionSet         = $injector.get('PermissionSet');
    var User                  = $injector.get('User');

    // Required services
    var $location                = $injector.get('$location');
    var $routeParams             = $injector.get('$routeParams');
    var $q                       = $injector.get('$q');
    var $window                  = $injector.get('$window');
    var authenticationService    = $injector.get('authenticationService');
    var dataSourceService        = $injector.get('dataSourceService');
    var membershipService        = $injector.get('membershipService');
    var permissionService        = $injector.get('permissionService');
    var requestService           = $injector.get('requestService');
    var schemaService            = $injector.get('schemaService');
    var userGroupService         = $injector.get('userGroupService');
    var userService              = $injector.get('userService');

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
     * The username of the original user from which this user is
     * being cloned. Only valid if this is a new user.
     *
     * @type String
     */
    var cloneSourceUsername = $location.search().clone;

    /**
     * The username of the user being edited. If a new user is
     * being created, this will not be defined.
     *
     * @type String
     */
    var username = $routeParams.id;

    /**
     * The unique identifier of the data source containing the user being
     * edited.
     *
     * @type String
     */
    $scope.dataSource = $routeParams.dataSource;

    /**
     * The string value representing the user currently being edited within the
     * permission flag set. Note that his may not match the user's actual
     * username - it is a marker that is (1) guaranteed to be associated with
     * the current user's permissions in the permission set and (2) guaranteed
     * not to collide with any user that does not represent the current user
     * within the permission set.
     *
     * @type String
     */
    $scope.selfUsername = '';

    /**
     * All user accounts associated with the same username as the account being
     * created or edited, as a map of data source identifier to the User object
     * within that data source.
     *
     * @type Object.<String, User>
     */
    $scope.users = null;

    /**
     * The user being modified.
     *
     * @type User
     */
    $scope.user = null;

    /**
     * All permissions associated with the user being modified.
     * 
     * @type PermissionFlagSet
     */
    $scope.permissionFlags = null;

    /**
     * The set of permissions that will be added to the user when the user is
     * saved. Permissions will only be present in this set if they are
     * manually added, and not later manually removed before saving.
     *
     * @type PermissionSet
     */
    $scope.permissionsAdded = new PermissionSet();

    /**
     * The set of permissions that will be removed from the user when the user
     * is saved. Permissions will only be present in this set if they are
     * manually removed, and not later manually added before saving.
     *
     * @type PermissionSet
     */
    $scope.permissionsRemoved = new PermissionSet();

    /**
     * The identifiers of all user groups which can be manipulated (all groups
     * for which the user accessing this interface has UPDATE permission),
     * either through adding the current user as a member or removing the
     * current user from that group. If this information has not yet been
     * retrieved, this will be null.
     *
     * @type String[]
     */
    $scope.availableGroups = null;

    /**
     * The identifiers of all user groups of which the user is a member,
     * taking into account any user groups which will be added/removed when
     * saved. If this information has not yet been retrieved, this will be
     * null.
     *
     * @type String[]
     */
    $scope.parentGroups = null;

    /**
     * The set of identifiers of all parent user groups to which the user will
     * be added when saved. Parent groups will only be present in this set if
     * they are manually added, and not later manually removed before saving.
     *
     * @type String[]
     */
    $scope.parentGroupsAdded = [];

    /**
     * The set of identifiers of all parent user groups from which the user
     * will be removed when saved. Parent groups will only be present in this
     * set if they are manually removed, and not later manually added before
     * saving.
     *
     * @type String[]
     */
    $scope.parentGroupsRemoved = [];

    /**
     * For each applicable data source, the management-related actions that the
     * current user may perform on the user account currently being created
     * or modified, as a map of data source identifier to the
     * {@link ManagementPermissions} object describing the actions available
     * within that data source, or null if the current user's permissions have
     * not yet been loaded.
     *
     * @type Object.<String, ManagementPermissions>
     */
    $scope.managementPermissions = null;

    /**
     * All available user attributes. This is only the set of attribute
     * definitions, organized as logical groupings of attributes, not attribute
     * values.
     *
     * @type Form[]
     */
    $scope.attributes = null;

    /**
     * Returns whether critical data has completed being loaded.
     *
     * @returns {Boolean}
     *     true if enough data has been loaded for the user interface to be
     *     useful, false otherwise.
     */
    $scope.isLoaded = function isLoaded() {

        return $scope.users                 !== null
            && $scope.permissionFlags       !== null
            && $scope.managementPermissions !== null
            && $scope.availableGroups       !== null
            && $scope.parentGroups          !== null
            && $scope.attributes            !== null;

    };

    /**
     * Returns whether the current user can edit the username of the user being
     * edited within the given data source.
     *
     * @param {String} [dataSource]
     *     The identifier of the data source to check. If omitted, this will
     *     default to the currently-selected data source.
     *
     * @returns {Boolean}
     *     true if the current user can edit the username of the user being
     *     edited, false otherwise.
     */
    $scope.canEditUsername = function canEditUsername(dataSource) {
        return !username;
    };

    /**
     * Loads the data associated with the user having the given username,
     * preparing the interface for making modifications to that existing user.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user to
     *     load.
     *
     * @param {String} username
     *     The username of the user to load.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     editing the given user.
     */
    var loadExistingUser = function loadExistingUser(dataSource, username) {
        return $q.all({
            users : dataSourceService.apply(userService.getUser, dataSources, username),

            // Use empty permission set if user cannot be found
            permissions:
                    permissionService.getPermissions(dataSource, username)
                    ['catch'](requestService.defaultValue(new PermissionSet())),

            // Assume no parent groups if user cannot be found
            parentGroups:
                    membershipService.getUserGroups(dataSource, username)
                    ['catch'](requestService.defaultValue([]))

        })
        .then(function userDataRetrieved(values) {

            $scope.users = values.users;
            $scope.parentGroups = values.parentGroups;

            // Create skeleton user if user does not exist
            $scope.user = values.users[dataSource] || new User({
                'username' : username
            });

            // The current user will be associated with username of the existing
            // user in the retrieved permission set
            $scope.selfUsername = username;
            $scope.permissionFlags = PermissionFlagSet.fromPermissionSet(values.permissions);

        });
    };

    /**
     * Loads the data associated with the user having the given username,
     * preparing the interface for cloning that existing user.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user to
     *     be cloned.
     *
     * @param {String} username
     *     The username of the user being cloned.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     cloning the given user.
     */
    var loadClonedUser = function loadClonedUser(dataSource, username) {
        return $q.all({
            users : dataSourceService.apply(userService.getUser, [dataSource], username),
            permissions : permissionService.getPermissions(dataSource, username),
            parentGroups : membershipService.getUserGroups(dataSource, username)
        })
        .then(function userDataRetrieved(values) {

            $scope.users = {};
            $scope.user  = values.users[dataSource];
            $scope.parentGroups = values.parentGroups;
            $scope.parentGroupsAdded = values.parentGroups;

            // The current user will be associated with cloneSourceUsername in the
            // retrieved permission set
            $scope.selfUsername = username;
            $scope.permissionFlags = PermissionFlagSet.fromPermissionSet(values.permissions);
            $scope.permissionsAdded = values.permissions;

        });
    };

    /**
     * Loads skeleton user data, preparing the interface for creating a new
     * user.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     creating a new user.
     */
    var loadSkeletonUser = function loadSkeletonUser() {

        // No users exist regardless of data source if there is no username
        $scope.users = {};

        // Use skeleton user object with no associated permissions
        $scope.user = new User();
        $scope.parentGroups = [];
        $scope.permissionFlags = new PermissionFlagSet();

        // As no permissions are yet associated with the user, it is safe to
        // use any non-empty username as a placeholder for self-referential
        // permissions
        $scope.selfUsername = 'SELF';

        return $q.resolve();

    };

    /**
     * Loads the data required for performing the management task requested
     * through the route parameters given at load time, automatically preparing
     * the interface for editing an existing user, cloning an existing user, or
     * creating an entirely new user.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared
     *     for performing the requested management task.
     */
    var loadRequestedUser = function loadRequestedUser() {

        // Pull user data and permissions if we are editing an existing user
        if (username)
            return loadExistingUser($scope.dataSource, username);

        // If we are cloning an existing user, pull his/her data instead
        if (cloneSourceUsername)
            return loadClonedUser($scope.dataSource, cloneSourceUsername);

        // If we are creating a new user, populate skeleton user data
        return loadSkeletonUser();

    };

    // Populate interface with requested data
    $q.all({
        userData    : loadRequestedUser(),
        permissions : dataSourceService.apply(permissionService.getEffectivePermissions, dataSources, currentUsername),
        userGroups  : userGroupService.getUserGroups($scope.dataSource, [ PermissionSet.ObjectPermissionType.UPDATE ]),
        attributes  : schemaService.getUserAttributes($scope.dataSource)
    })
    .then(function dataReceived(values) {

        $scope.attributes = values.attributes;

        $scope.managementPermissions = {};
        angular.forEach(dataSources, function addAccountPage(dataSource) {

            // Determine whether data source contains this user
            var exists = (dataSource in $scope.users);

            // Add the identifiers of all modifiable user groups
            $scope.availableGroups = [];
            angular.forEach(values.userGroups, function addUserGroupIdentifier(userGroup) {
                $scope.availableGroups.push(userGroup.identifier);
            });

            // Calculate management actions available for this specific account
            $scope.managementPermissions[dataSource] = ManagementPermissions.fromPermissionSet(
                    values.permissions[dataSource],
                    PermissionSet.SystemPermissionType.CREATE_USER,
                    PermissionSet.hasUserPermission,
                    exists ? username : null);

        });

    }, requestService.DIE);

    /**
     * Returns the URL for the page which manages the user account currently
     * being edited under the given data source. The given data source need not
     * be the same as the data source currently selected.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source that the URL is being
     *     generated for.
     *
     * @returns {String}
     *     The URL for the page which manages the user account currently being
     *     edited under the given data source.
     */
    $scope.getUserURL = function getUserURL(dataSource) {
        return '/manage/' + encodeURIComponent(dataSource) + '/users/' + encodeURIComponent(username || '');
    };

    /**
     * Cancels all pending edits, returning to the main list of users.
     */
    $scope.returnToUserList = function returnToUserList() {
        $location.url('/settings/users');
    };

    /**
     * Cancels all pending edits, opening an edit page for a new user
     * which is prepopulated with the data from the user currently being edited.
     */
    $scope.cloneUser = function cloneUser() {
        $location.path('/manage/' + encodeURIComponent($scope.dataSource) + '/users').search('clone', username);
        $window.scrollTo(0,0);
    };
            
    /**
     * Saves the current user, creating a new user or updating the existing
     * user depending on context, returning a promise which is resolved if the
     * save operation succeeds and rejected if the save operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the save operation succeeds and is
     *     rejected with an {@link Error} if the save operation fails.
     */
    $scope.saveUser = function saveUser() {

        // Verify passwords match
        if ($scope.passwordMatch !== $scope.user.password) {
            return $q.reject(new Error({
                translatableMessage : {
                    key : 'MANAGE_USER.ERROR_PASSWORD_MISMATCH'
                }
            }));
        }

        // Save or create the user, depending on whether the user exists
        var saveUserPromise;
        if ($scope.dataSource in $scope.users)
            saveUserPromise = userService.saveUser($scope.dataSource, $scope.user);
        else
            saveUserPromise = userService.createUser($scope.dataSource, $scope.user);

        return saveUserPromise.then(function savedUser() {

            // Move permission flags if username differs from marker
            if ($scope.selfUsername !== $scope.user.username) {

                // Rename added permission
                if ($scope.permissionsAdded.userPermissions[$scope.selfUsername]) {
                    $scope.permissionsAdded.userPermissions[$scope.user.username] = $scope.permissionsAdded.userPermissions[$scope.selfUsername];
                    delete $scope.permissionsAdded.userPermissions[$scope.selfUsername];
                }

                // Rename removed permission
                if ($scope.permissionsRemoved.userPermissions[$scope.selfUsername]) {
                    $scope.permissionsRemoved.userPermissions[$scope.user.username] = $scope.permissionsRemoved.userPermissions[$scope.selfUsername];
                    delete $scope.permissionsRemoved.userPermissions[$scope.selfUsername];
                }
                
            }

            // Upon success, save any changed permissions/groups
            return $q.all([
                permissionService.patchPermissions($scope.dataSource, $scope.user.username, $scope.permissionsAdded, $scope.permissionsRemoved),
                membershipService.patchUserGroups($scope.dataSource, $scope.user.username, $scope.parentGroupsAdded, $scope.parentGroupsRemoved)
            ]);

        });

    };
    
    /**
     * Deletes the current user, returning a promise which is resolved if the
     * delete operation succeeds and rejected if the delete operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the delete operation succeeds and is
     *     rejected with an {@link Error} if the delete operation fails.
     */
    $scope.deleteUser = function deleteUser() {
        return userService.deleteUser($scope.dataSource, $scope.user);
    };

}]);
