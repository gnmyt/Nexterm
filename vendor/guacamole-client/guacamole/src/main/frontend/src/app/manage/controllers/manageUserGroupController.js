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
 * The controller for editing user groups.
 */
angular.module('manage').controller('manageUserGroupController', ['$scope', '$injector',
        function manageUserGroupController($scope, $injector) {
            
    // Required types
    var ManagementPermissions = $injector.get('ManagementPermissions');
    var PermissionFlagSet     = $injector.get('PermissionFlagSet');
    var PermissionSet         = $injector.get('PermissionSet');
    var UserGroup             = $injector.get('UserGroup');

    // Required services
    var $location             = $injector.get('$location');
    var $routeParams          = $injector.get('$routeParams');
    var $q                    = $injector.get('$q');
    var $window               = $injector.get('$window');
    var authenticationService = $injector.get('authenticationService');
    var dataSourceService     = $injector.get('dataSourceService');
    var membershipService     = $injector.get('membershipService');
    var permissionService     = $injector.get('permissionService');
    var requestService        = $injector.get('requestService');
    var schemaService         = $injector.get('schemaService');
    var userGroupService      = $injector.get('userGroupService');
    var userService           = $injector.get('userService');

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
     * The identifier of the original user group from which this user group is
     * being cloned. Only valid if this is a new user group.
     *
     * @type String
     */
    var cloneSourceIdentifier = $location.search().clone;

    /**
     * The identifier of the user group being edited. If a new user group is
     * being created, this will not be defined.
     *
     * @type String
     */
    var identifier = $routeParams.id;

    /**
     * The unique identifier of the data source containing the user group being
     * edited.
     *
     * @type String
     */
    $scope.dataSource = $routeParams.dataSource;

    /**
     * All user groups associated with the same identifier as the group being
     * created or edited, as a map of data source identifier to the UserGroup
     * object within that data source.
     *
     * @type Object.<String, UserGroup>
     */
    $scope.userGroups = null;

    /**
     * The user group being modified.
     *
     * @type UserGroup
     */
    $scope.userGroup = null;

    /**
     * All permissions associated with the user group being modified.
     * 
     * @type PermissionFlagSet
     */
    $scope.permissionFlags = null;

    /**
     * The set of permissions that will be added to the user group when the
     * user group is saved. Permissions will only be present in this set if they
     * are manually added, and not later manually removed before saving.
     *
     * @type PermissionSet
     */
    $scope.permissionsAdded = new PermissionSet();

    /**
     * The set of permissions that will be removed from the user group when the
     * user group is saved. Permissions will only be present in this set if they
     * are manually removed, and not later manually added before saving.
     *
     * @type PermissionSet
     */
    $scope.permissionsRemoved = new PermissionSet();

    /**
     * The identifiers of all user groups which can be manipulated (all groups
     * for which the user accessing this interface has UPDATE permission),
     * whether that means changing the members of those groups or changing the
     * groups of which those groups are members. If this information has not
     * yet been retrieved, this will be null.
     *
     * @type String[]
     */
    $scope.availableGroups = null;

    /**
     * The identifiers of all users which can be manipulated (all users for
     * which the user accessing this interface has UPDATE permission), either
     * through adding those users as a member of the current group or removing
     * those users from the current group. If this information has not yet been
     * retrieved, this will be null.
     *
     * @type String[]
     */
    $scope.availableUsers = null;

    /**
     * The identifiers of all user groups of which this group is a member,
     * taking into account any user groups which will be added/removed when
     * saved. If this information has not yet been retrieved, this will be
     * null.
     *
     * @type String[]
     */
    $scope.parentGroups = null;

    /**
     * The set of identifiers of all parent user groups to which this group
     * will be added when saved. Parent groups will only be present in this set
     * if they are manually added, and not later manually removed before
     * saving.
     *
     * @type String[]
     */
    $scope.parentGroupsAdded = [];

    /**
     * The set of identifiers of all parent user groups from which this group
     * will be removed when saved. Parent groups will only be present in this
     * set if they are manually removed, and not later manually added before
     * saving.
     *
     * @type String[]
     */
    $scope.parentGroupsRemoved = [];

    /**
     * The identifiers of all user groups which are members of this group,
     * taking into account any user groups which will be added/removed when
     * saved. If this information has not yet been retrieved, this will be
     * null.
     *
     * @type String[]
     */
    $scope.memberGroups = null;

    /**
     * The set of identifiers of all member user groups which will be added to
     * this group when saved. Member groups will only be present in this set if
     * they are manually added, and not later manually removed before saving.
     *
     * @type String[]
     */
    $scope.memberGroupsAdded = [];

    /**
     * The set of identifiers of all member user groups which will be removed
     * from this group when saved. Member groups will only be present in this
     * set if they are manually removed, and not later manually added before
     * saving.
     *
     * @type String[]
     */
    $scope.memberGroupsRemoved = [];

    /**
     * The identifiers of all users which are members of this group, taking
     * into account any users which will be added/removed when saved. If this
     * information has not yet been retrieved, this will be null.
     *
     * @type String[]
     */
    $scope.memberUsers = null;

    /**
     * The set of identifiers of all member users which will be added to this
     * group when saved. Member users will only be present in this set if they
     * are manually added, and not later manually removed before saving.
     *
     * @type String[]
     */
    $scope.memberUsersAdded = [];

    /**
     * The set of identifiers of all member users which will be removed from
     * this group when saved. Member users will only be present in this set if
     * they are manually removed, and not later manually added before saving.
     *
     * @type String[]
     */
    $scope.memberUsersRemoved = [];

    /**
     * For each applicable data source, the management-related actions that the
     * current user may perform on the user group currently being created
     * or modified, as a map of data source identifier to the
     * {@link ManagementPermissions} object describing the actions available
     * within that data source, or null if the current user's permissions have
     * not yet been loaded.
     *
     * @type Object.<String, ManagementPermissions>
     */
    $scope.managementPermissions = null;

    /**
     * All available user group attributes. This is only the set of attribute
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
     *     true if enough data has been loaded for the user group interface to
     *     be useful, false otherwise.
     */
    $scope.isLoaded = function isLoaded() {

        return $scope.userGroups            !== null
            && $scope.permissionFlags       !== null
            && $scope.managementPermissions !== null
            && $scope.availableGroups       !== null
            && $scope.availableUsers        !== null
            && $scope.parentGroups          !== null
            && $scope.memberGroups          !== null
            && $scope.memberUsers           !== null
            && $scope.attributes            !== null;

    };

    /**
     * Returns whether the current user can edit the identifier of the user
     * group being edited.
     *
     * @returns {Boolean}
     *     true if the current user can edit the identifier of the user group
     *     being edited, false otherwise.
     */
    $scope.canEditIdentifier = function canEditIdentifier() {
        return !identifier;
    };

    /**
     * Loads the data associated with the user group having the given
     * identifier, preparing the interface for making modifications to that
     * existing user group.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user group
     *     to load.
     *
     * @param {String} identifier
     *     The unique identifier of the user group to load.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     editing the given user group.
     */
    var loadExistingUserGroup = function loadExistingGroup(dataSource, identifier) {
        return $q.all({
            userGroups   : dataSourceService.apply(userGroupService.getUserGroup, dataSources, identifier),

            // Use empty permission set if group cannot be found
            permissions:
                    permissionService.getPermissions(dataSource, identifier, true)
                    ['catch'](requestService.defaultValue(new PermissionSet())),

            // Assume no parent groups if group cannot be found
            parentGroups:
                    membershipService.getUserGroups(dataSource, identifier, true)
                    ['catch'](requestService.defaultValue([])),

            // Assume no member groups if group cannot be found
            memberGroups:
                    membershipService.getMemberUserGroups(dataSource, identifier)
                    ['catch'](requestService.defaultValue([])),

            // Assume no member users if group cannot be found
            memberUsers:
                    membershipService.getMemberUsers(dataSource, identifier)
                    ['catch'](requestService.defaultValue([]))

        })
        .then(function userGroupDataRetrieved(values) {

            $scope.userGroups = values.userGroups;
            $scope.parentGroups = values.parentGroups;
            $scope.memberGroups = values.memberGroups;
            $scope.memberUsers = values.memberUsers;

            // Create skeleton user group if user group does not exist
            $scope.userGroup  = values.userGroups[dataSource] || new UserGroup({
                'identifier' : identifier
            });

            $scope.permissionFlags = PermissionFlagSet.fromPermissionSet(values.permissions);

        });
    };

    /**
     * Loads the data associated with the user group having the given
     * identifier, preparing the interface for cloning that existing user
     * group.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user group to
     *     be cloned.
     *
     * @param {String} identifier
     *     The unique identifier of the user group being cloned.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     cloning the given user group.
     */
    var loadClonedUserGroup = function loadClonedUserGroup(dataSource, identifier) {
        return $q.all({
            userGroups   : dataSourceService.apply(userGroupService.getUserGroup, [dataSource], identifier),
            permissions  : permissionService.getPermissions(dataSource, identifier, true),
            parentGroups : membershipService.getUserGroups(dataSource, identifier, true),
            memberGroups : membershipService.getMemberUserGroups(dataSource, identifier),
            memberUsers  : membershipService.getMemberUsers(dataSource, identifier)
        })
        .then(function userGroupDataRetrieved(values) {

            $scope.userGroups = {};
            $scope.userGroup  = values.userGroups[dataSource];
            $scope.parentGroups = values.parentGroups;
            $scope.parentGroupsAdded = values.parentGroups;
            $scope.memberGroups = values.memberGroups;
            $scope.memberGroupsAdded = values.memberGroups;
            $scope.memberUsers = values.memberUsers;
            $scope.memberUsersAdded = values.memberUsers;

            $scope.permissionFlags = PermissionFlagSet.fromPermissionSet(values.permissions);
            $scope.permissionsAdded = values.permissions;

        });
    };

    /**
     * Loads skeleton user group data, preparing the interface for creating a
     * new user group.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     creating a new user group.
     */
    var loadSkeletonUserGroup = function loadSkeletonUserGroup() {

        // No user groups exist regardless of data source if the user group is
        // being created
        $scope.userGroups = {};

        // Use skeleton user group object with no associated permissions
        $scope.userGroup = new UserGroup();
        $scope.parentGroups = [];
        $scope.memberGroups = [];
        $scope.memberUsers = [];
        $scope.permissionFlags = new PermissionFlagSet();

        return $q.resolve();

    };

    /**
     * Loads the data required for performing the management task requested
     * through the route parameters given at load time, automatically preparing
     * the interface for editing an existing user group, cloning an existing
     * user group, or creating an entirely new user group.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared
     *     for performing the requested management task.
     */
    var loadRequestedUserGroup = function loadRequestedUserGroup() {

        // Pull user group data and permissions if we are editing an existing
        // user group
        if (identifier)
            return loadExistingUserGroup($scope.dataSource, identifier);

        // If we are cloning an existing user group, pull its data instead
        if (cloneSourceIdentifier)
            return loadClonedUserGroup($scope.dataSource, cloneSourceIdentifier);

        // If we are creating a new user group, populate skeleton user group data
        return loadSkeletonUserGroup();

    };

    // Populate interface with requested data
    $q.all({
        userGroupData : loadRequestedUserGroup(),
        permissions   : dataSourceService.apply(permissionService.getEffectivePermissions, dataSources, currentUsername),
        userGroups    : userGroupService.getUserGroups($scope.dataSource, [ PermissionSet.ObjectPermissionType.UPDATE ]),
        users         : userService.getUsers($scope.dataSource, [ PermissionSet.ObjectPermissionType.UPDATE ]),
        attributes    : schemaService.getUserGroupAttributes($scope.dataSource)
    })
    .then(function dataReceived(values) {

        $scope.attributes = values.attributes;

        $scope.managementPermissions = {};
        angular.forEach(dataSources, function deriveManagementPermissions(dataSource) {

            // Determine whether data source contains this user group
            var exists = (dataSource in $scope.userGroups);

            // Add the identifiers of all modifiable user groups
            $scope.availableGroups = [];
            angular.forEach(values.userGroups, function addUserGroupIdentifier(userGroup) {
                $scope.availableGroups.push(userGroup.identifier);
            });

            // Add the identifiers of all modifiable users
            $scope.availableUsers = [];
            angular.forEach(values.users, function addUserIdentifier(user) {
                $scope.availableUsers.push(user.username);
            });

            // Calculate management actions available for this specific group
            $scope.managementPermissions[dataSource] = ManagementPermissions.fromPermissionSet(
                    values.permissions[dataSource],
                    PermissionSet.SystemPermissionType.CREATE_USER_GROUP,
                    PermissionSet.hasUserGroupPermission,
                    exists ? identifier : null);

        });

    }, requestService.WARN);

    /**
     * Returns the URL for the page which manages the user group currently
     * being edited under the given data source. The given data source need not
     * be the same as the data source currently selected.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source that the URL is being
     *     generated for.
     *
     * @returns {String}
     *     The URL for the page which manages the user group currently being
     *     edited under the given data source.
     */
    $scope.getUserGroupURL = function getUserGroupURL(dataSource) {
        return '/manage/' + encodeURIComponent(dataSource) + '/userGroups/' + encodeURIComponent(identifier || '');
    };

    /**
     * Cancels all pending edits, returning to the main list of user groups.
     */
    $scope.returnToUserGroupList = function returnToUserGroupList() {
        $location.url('/settings/userGroups');
    };

    /**
     * Cancels all pending edits, opening an edit page for a new user group
     * which is prepopulated with the data from the user currently being edited.
     */
    $scope.cloneUserGroup = function cloneUserGroup() {
        $location.path('/manage/' + encodeURIComponent($scope.dataSource) + '/userGroups').search('clone', identifier);
        $window.scrollTo(0,0);
    };

    /**
     * Saves the current user group, creating a new user group or updating the
     * existing user group depending on context, returning a promise which is
     * resolved if the save operation succeeds and rejected if the save
     * operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the save operation succeeds and is
     *     rejected with an {@link Error} if the save operation fails.
     */
    $scope.saveUserGroup = function saveUserGroup() {

        // Save or create the user group, depending on whether the user group exists
        var saveUserGroupPromise;
        if ($scope.dataSource in $scope.userGroups)
            saveUserGroupPromise = userGroupService.saveUserGroup($scope.dataSource, $scope.userGroup);
        else
            saveUserGroupPromise = userGroupService.createUserGroup($scope.dataSource, $scope.userGroup);

        return saveUserGroupPromise.then(function savedUserGroup() {
            return $q.all([
                permissionService.patchPermissions($scope.dataSource, $scope.userGroup.identifier, $scope.permissionsAdded, $scope.permissionsRemoved, true),
                membershipService.patchUserGroups($scope.dataSource, $scope.userGroup.identifier, $scope.parentGroupsAdded, $scope.parentGroupsRemoved, true),
                membershipService.patchMemberUserGroups($scope.dataSource, $scope.userGroup.identifier, $scope.memberGroupsAdded, $scope.memberGroupsRemoved),
                membershipService.patchMemberUsers($scope.dataSource, $scope.userGroup.identifier, $scope.memberUsersAdded, $scope.memberUsersRemoved)
            ]);
        });

    };

    /**
     * Deletes the current user group, returning a promise which is resolved if
     * the delete operation succeeds and rejected if the delete operation
     * fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the delete operation succeeds and is
     *     rejected with an {@link Error} if the delete operation fails.
     */
    $scope.deleteUserGroup = function deleteUserGroup() {
        return userGroupService.deleteUserGroup($scope.dataSource, $scope.userGroup);
    };

}]);
