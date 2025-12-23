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
 * A service for generating all the important pages a user can visit.
 */
angular.module('navigation').factory('userPageService', ['$injector',
        function userPageService($injector) {

    // Get required types
    var ClientIdentifier = $injector.get('ClientIdentifier');
    var ConnectionGroup  = $injector.get('ConnectionGroup');
    var PageDefinition   = $injector.get('PageDefinition');
    var PermissionSet    = $injector.get('PermissionSet');

    // Get required services
    var $q                       = $injector.get('$q');
    var authenticationService    = $injector.get('authenticationService');
    var connectionGroupService   = $injector.get('connectionGroupService');
    var dataSourceService        = $injector.get('dataSourceService');
    var permissionService        = $injector.get('permissionService');
    var requestService           = $injector.get('requestService');
    var translationStringService = $injector.get('translationStringService');
    
    var service = {};
    
    /**
     * The home page to assign to a user if they can navigate to more than one
     * page.
     * 
     * @type PageDefinition
     */
    var SYSTEM_HOME_PAGE = new PageDefinition({
        name : 'USER_MENU.ACTION_NAVIGATE_HOME',
        url  : '/'
    });

    /**
     * Returns an appropriate home page for the current user.
     *
     * @param {Object.<String, ConnectionGroup>} rootGroups
     *     A map of all root connection groups visible to the current user,
     *     where each key is the identifier of the corresponding data source.
     *
     * @param {Object.<String, PermissionSet>} permissions
     *     A map of all permissions granted to the current user, where each
     *     key is the identifier of the corresponding data source.
     *
     * @returns {PageDefinition}
     *     The user's home page.
     */
    var generateHomePage = function generateHomePage(rootGroups, permissions) {

        var settingsPages = generateSettingsPages(permissions);

        // If user has access to settings pages, return home page and skip
        // evaluation for automatic connections.  The Preferences page is
        // a Settings page and is always visible, and the Session management
        // page is also available to all users so that they can kill their
        // own session.  We look for more than those two pages to determine
        // if we should go to the home page.
        if (settingsPages.length > 2)
            return SYSTEM_HOME_PAGE;

        // If exactly one connection or balancing group is available, use
        // that as the home page
        var clientPages = service.getClientPages(rootGroups);
        return (clientPages.length === 1) ? clientPages[0] : SYSTEM_HOME_PAGE;

    };

    /**
     * Adds to the given array all pages that the current user may use to
     * access connections or balancing groups that are descendants of the given
     * connection group.
     *
     * @param {PageDefinition[]} clientPages
     *     The array that pages should be added to.
     *
     * @param {String} dataSource
     *     The data source containing the given connection group.
     *
     * @param {ConnectionGroup} connectionGroup
     *     The connection group ancestor of the connection or balancing group
     *     descendants whose pages should be added to the given array.
     */
    var addClientPages = function addClientPages(clientPages, dataSource, connectionGroup) {

        // Add pages for all child connections
        angular.forEach(connectionGroup.childConnections, function addConnectionPage(connection) {
            clientPages.push(new PageDefinition({
                name : connection.name,
                url  : '/client/' + ClientIdentifier.toString({
                    dataSource : dataSource,
                    type       : ClientIdentifier.Types.CONNECTION,
                    id         : connection.identifier
                })
            }));
        });

        // Add pages for all child balancing groups, as well as the connectable
        // descendants of all balancing groups of any type
        angular.forEach(connectionGroup.childConnectionGroups, function addConnectionGroupPage(connectionGroup) {

            if (connectionGroup.type === ConnectionGroup.Type.BALANCING) {
                clientPages.push(new PageDefinition({
                    name : connectionGroup.name,
                    url  : '/client/' + ClientIdentifier.toString({
                        dataSource : dataSource,
                        type       : ClientIdentifier.Types.CONNECTION_GROUP,
                        id         : connectionGroup.identifier
                    })
                }));
            }

            addClientPages(clientPages, dataSource, connectionGroup);

        });

    };

    /**
     * Returns a full list of all pages that the current user may use to access
     * a connection or balancing group, regardless of the depth of those
     * connections/groups within the connection hierarchy.
     *
     * @param {Object.<String, ConnectionGroup>} rootGroups
     *     A map of all root connection groups visible to the current user,
     *     where each key is the identifier of the corresponding data source.
     *
     * @returns {PageDefinition[]}
     *     A list of all pages that the current user may use to access a
     *     connection or balancing group.
     */
    service.getClientPages = function getClientPages(rootGroups) {

        var clientPages = [];

        // Determine whether a connection or balancing group should serve as
        // the home page
        for (var dataSource in rootGroups) {
            addClientPages(clientPages, dataSource, rootGroups[dataSource]);
        }

        return clientPages;

    };

    /**
     * Returns a promise which resolves with an appropriate home page for the
     * current user. The promise will not be rejected.
     *
     * @returns {Promise.<Page>}
     *     A promise which resolves with the user's default home page.
     */
    service.getHomePage = function getHomePage() {

        var deferred = $q.defer();

        // Resolve promise using home page derived from root connection groups
        var getRootGroups = dataSourceService.apply(
            connectionGroupService.getConnectionGroupTree,
            authenticationService.getAvailableDataSources(),
            ConnectionGroup.ROOT_IDENTIFIER
        );
        var getPermissionSets = dataSourceService.apply(
            permissionService.getEffectivePermissions,
            authenticationService.getAvailableDataSources(),
            authenticationService.getCurrentUsername()
        );

        $q.all({
            rootGroups : getRootGroups,
            permissionsSets : getPermissionSets
        })
        .then(function rootConnectionGroupsPermissionsRetrieved(data) {
            deferred.resolve(generateHomePage(data.rootGroups,data.permissionsSets));
        }, requestService.DIE);

        return deferred.promise;

    };

    /**
     * Returns all settings pages that the current user can visit. This can
     * include any of the various manage pages.
     * 
     * @param {Object.<String, PermissionSet>} permissionSets
     *     A map of all permissions granted to the current user, where each
     *     key is the identifier of the corresponding data source.
     * 
     * @returns {Page[]} 
     *     An array of all settings pages that the current user can visit.
     */
    var generateSettingsPages = function generateSettingsPages(permissionSets) {
        
        var pages = [];
        
        var canManageUsers = [];
        var canManageUserGroups = [];
        var canManageConnections = [];
        var canViewConnectionRecords = [];

        // Inspect the contents of each provided permission set
        angular.forEach(authenticationService.getAvailableDataSources(), function inspectPermissions(dataSource) {

            // Get permissions for current data source, skipping if non-existent
            var permissions = permissionSets[dataSource];
            if (!permissions)
                return;

            // Do not modify original object
            permissions = angular.copy(permissions);

            // Ignore permission to update root group
            PermissionSet.removeConnectionGroupPermission(permissions,
                PermissionSet.ObjectPermissionType.UPDATE,
                ConnectionGroup.ROOT_IDENTIFIER);

            // Ignore permission to update self
            PermissionSet.removeUserPermission(permissions,
                PermissionSet.ObjectPermissionType.UPDATE,
                authenticationService.getCurrentUsername());

            // Determine whether the current user needs access to the user management UI
            if (
                    // System permissions
                       PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                    || PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.CREATE_USER)

                    // Permission to update users
                    || PermissionSet.hasUserPermission(permissions, PermissionSet.ObjectPermissionType.UPDATE)

                    // Permission to delete users
                    || PermissionSet.hasUserPermission(permissions, PermissionSet.ObjectPermissionType.DELETE)

                    // Permission to administer users
                    || PermissionSet.hasUserPermission(permissions, PermissionSet.ObjectPermissionType.ADMINISTER)
            ) {
                canManageUsers.push(dataSource);
            }

            // Determine whether the current user needs access to the group management UI
            if (
                    // System permissions
                       PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                    || PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.CREATE_USER_GROUP)

                    // Permission to update user groups
                    || PermissionSet.hasUserGroupPermission(permissions, PermissionSet.ObjectPermissionType.UPDATE)

                    // Permission to delete user groups
                    || PermissionSet.hasUserGroupPermission(permissions, PermissionSet.ObjectPermissionType.DELETE)

                    // Permission to administer user groups
                    || PermissionSet.hasUserGroupPermission(permissions, PermissionSet.ObjectPermissionType.ADMINISTER)
            ) {
                canManageUserGroups.push(dataSource);
            }

            // Determine whether the current user needs access to the connection management UI
            if (
                    // System permissions
                       PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                    || PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.CREATE_CONNECTION)
                    || PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.CREATE_CONNECTION_GROUP)

                    // Permission to update connections or connection groups
                    || PermissionSet.hasConnectionPermission(permissions,      PermissionSet.ObjectPermissionType.UPDATE)
                    || PermissionSet.hasConnectionGroupPermission(permissions, PermissionSet.ObjectPermissionType.UPDATE)

                    // Permission to delete connections or connection groups
                    || PermissionSet.hasConnectionPermission(permissions,      PermissionSet.ObjectPermissionType.DELETE)
                    || PermissionSet.hasConnectionGroupPermission(permissions, PermissionSet.ObjectPermissionType.DELETE)

                    // Permission to administer connections or connection groups
                    || PermissionSet.hasConnectionPermission(permissions,      PermissionSet.ObjectPermissionType.ADMINISTER)
                    || PermissionSet.hasConnectionGroupPermission(permissions, PermissionSet.ObjectPermissionType.ADMINISTER)
            ) {
                canManageConnections.push(dataSource);
            }

            // Determine whether the current user needs access to view connection history
            if (
                    // A user must be a system administrator or auditor to view connection records
                       PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.ADMINISTER)
                    || PermissionSet.hasSystemPermission(permissions, PermissionSet.SystemPermissionType.AUDIT)
            ) {
                canViewConnectionRecords.push(dataSource);
            }

        });

        // Add link to Session management (always accessible)
        pages.push(new PageDefinition({
            name : 'USER_MENU.ACTION_MANAGE_SESSIONS',
            url  : '/settings/sessions'
        }));

        // If user can view connection records, add links for connection history pages
        angular.forEach(canViewConnectionRecords, function addConnectionHistoryLink(dataSource) {
            pages.push(new PageDefinition({
                name : [
                    'USER_MENU.ACTION_VIEW_HISTORY',
                    translationStringService.canonicalize('DATA_SOURCE_' + dataSource) + '.NAME'
                ],
                url  : '/settings/' + encodeURIComponent(dataSource) + '/history'
            }));
        });

        // If user can manage users, add link to user management page
        if (canManageUsers.length) {
            pages.push(new PageDefinition({
                name : 'USER_MENU.ACTION_MANAGE_USERS',
                url  : '/settings/users'
            }));
        }

        // If user can manage user groups, add link to group management page
        if (canManageUserGroups.length) {
            pages.push(new PageDefinition({
                name : 'USER_MENU.ACTION_MANAGE_USER_GROUPS',
                url  : '/settings/userGroups'
            }));
        }

        // If user can manage connections, add links for connection management pages
        angular.forEach(canManageConnections, function addConnectionManagementLink(dataSource) {
            pages.push(new PageDefinition({
                name : [
                    'USER_MENU.ACTION_MANAGE_CONNECTIONS',
                    translationStringService.canonicalize('DATA_SOURCE_' + dataSource) + '.NAME'
                ],
                url  : '/settings/' + encodeURIComponent(dataSource) + '/connections'
            }));
        });

        // Add link to user preferences (always accessible)
        pages.push(new PageDefinition({
            name : 'USER_MENU.ACTION_MANAGE_PREFERENCES',
            url  : '/settings/preferences'
        }));

        return pages;
    };

    /**
     * Returns a promise which resolves to an array of all settings pages that
     * the current user can visit. This can include any of the various manage
     * pages. The promise will not be rejected.
     *
     * @returns {Promise.<Page[]>} 
     *     A promise which resolves to an array of all settings pages that the
     *     current user can visit.
     */
    service.getSettingsPages = function getSettingsPages() {

        var deferred = $q.defer();

        // Retrieve current permissions
        dataSourceService.apply(
            permissionService.getEffectivePermissions,
            authenticationService.getAvailableDataSources(),
            authenticationService.getCurrentUsername() 
        )

        // Resolve promise using settings pages derived from permissions
        .then(function permissionsRetrieved(permissions) {
            deferred.resolve(generateSettingsPages(permissions));
        }, requestService.DIE);
        
        return deferred.promise;

    };
   
    /**
     * Returns all the main pages that the current user can visit. This can 
     * include the home page, manage pages, etc. In the case that there are no 
     * applicable pages of this sort, it may return a client page.
     * 
     * @param {Object.<String, ConnectionGroup>} rootGroups
     *     A map of all root connection groups visible to the current user,
     *     where each key is the identifier of the corresponding data source.
     *     
     * @param {Object.<String, PermissionSet>} permissions
     *     A map of all permissions granted to the current user, where each
     *     key is the identifier of the corresponding data source.
     * 
     * @returns {Page[]} 
     *     An array of all main pages that the current user can visit.
     */
    var generateMainPages = function generateMainPages(rootGroups, permissions) {
        
        var pages = [];

        // Get home page and settings pages
        var homePage = generateHomePage(rootGroups, permissions);
        var settingsPages = generateSettingsPages(permissions);

        // Only include the home page in the list of main pages if the user
        // can navigate elsewhere.
        if (homePage === SYSTEM_HOME_PAGE || settingsPages.length)
            pages.push(homePage);

        // Add generic link to the first-available settings page
        if (settingsPages.length) {
            pages.push(new PageDefinition({
                name : 'USER_MENU.ACTION_MANAGE_SETTINGS',
                url  : settingsPages[0].url
            }));
        }
        
        return pages;
    };

    /**
     * Returns a promise which resolves to an array of all main pages that the
     * current user can visit. This can include the home page, manage pages,
     * etc. In the case that there are no applicable pages of this sort, it may
     * return a client page. The promise will not be rejected.
     *
     * @returns {Promise.<Page[]>} 
     *     A promise which resolves to an array of all main pages that the
     *     current user can visit.
     */
    service.getMainPages = function getMainPages() {

        var deferred = $q.defer();

        var rootGroups  = null;
        var permissions = null;

        /**
         * Resolves the main pages retrieval promise, if possible. If
         * insufficient data is available, this function does nothing.
         */
        var resolveMainPages = function resolveMainPages() {
            if (rootGroups && permissions)
                deferred.resolve(generateMainPages(rootGroups, permissions));
        };

        // Retrieve root group, resolving main pages if possible
        dataSourceService.apply(
            connectionGroupService.getConnectionGroupTree,
            authenticationService.getAvailableDataSources(),
            ConnectionGroup.ROOT_IDENTIFIER
        )
        .then(function rootConnectionGroupsRetrieved(retrievedRootGroups) {
            rootGroups = retrievedRootGroups;
            resolveMainPages();
        }, requestService.DIE);

        // Retrieve current permissions
        dataSourceService.apply(
            permissionService.getEffectivePermissions,
            authenticationService.getAvailableDataSources(),
            authenticationService.getCurrentUsername()
        )

        // Resolving main pages if possible
        .then(function permissionsRetrieved(retrievedPermissions) {
            permissions = retrievedPermissions;
            resolveMainPages();
        }, requestService.DIE);
        
        return deferred.promise;

    };
   
    return service;
    
}]);
