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
 * Service for operating on user group memberships via the REST API.
 */
angular.module('rest').factory('membershipService', ['$injector',
        function membershipService($injector) {

    // Required services
    var requestService        = $injector.get('requestService');
    var authenticationService = $injector.get('authenticationService');
    var cacheService          = $injector.get('cacheService');
    
    // Required types
    var RelatedObjectPatch = $injector.get('RelatedObjectPatch');

    var service = {};

    /**
     * Creates a new array of patches which represents the given changes to an
     * arbitrary set of objects sharing some common relation.
     *
     * @param {String[]} [identifiersToAdd]
     *     The identifiers of all objects which should be added to the
     *     relation, if any.
     *
     * @param {String[]} [identifiersToRemove]
     *     The identifiers of all objects which should be removed from the
     *     relation, if any.
     *
     * @returns {RelatedObjectPatch[]}
     *     A new array of patches which represents the given changes.
     */
    var getRelatedObjectPatch = function getRelatedObjectPatch(identifiersToAdd, identifiersToRemove) {

        var patch = [];

        angular.forEach(identifiersToAdd, function addIdentifier(identifier) {
            patch.push(new RelatedObjectPatch({
                op    : RelatedObjectPatch.Operation.ADD,
                value : identifier
            }));
        });

        angular.forEach(identifiersToRemove, function removeIdentifier(identifier) {
            patch.push(new RelatedObjectPatch({
                op    : RelatedObjectPatch.Operation.REMOVE,
                value : identifier
            }));
        });

        return patch;

    };

    /**
     * Returns the URL for the REST resource most appropriate for accessing
     * the parent user groups of the user or group having the given identifier.
     *
     * It is important to note that a particular data source can authenticate
     * and provide user groups for a user, even if that user does not exist
     * within that data source (and thus cannot be found beneath
     * "api/session/data/{dataSource}/users")
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user or
     *     group whose parent user groups should be retrieved. This identifier
     *     corresponds to an AuthenticationProvider within the Guacamole web
     *     application.
     *
     * @param {String} identifier
     *     The identifier of the user or group for which the URL of the proper
     *     REST resource should be derived.
     *
     * @param {Boolean} [group]
     *     Whether the provided identifier refers to a user group. If false or
     *     omitted, the identifier given is assumed to refer to a user.
     *
     * @returns {String}
     *     The URL for the REST resource representing the parent user groups of
     *     the user or group having the given identifier.
     */
    var getUserGroupsResourceURL = function getUserGroupsResourceURL(dataSource, identifier, group) {

        // Create base URL for data source
        var base = 'api/session/data/' + encodeURIComponent(dataSource);

        // Access parent groups directly (there is no "self" for user groups
        // as there is for users)
        if (group)
            return base + '/userGroups/' + encodeURIComponent(identifier) + '/userGroups';

        // If the username is that of the current user, do not rely on the
        // user actually existing (they may not). Access their parent groups via
        // "self" rather than the collection of defined users.
        if (identifier === authenticationService.getCurrentUsername())
            return base + '/self/userGroups';

        // Otherwise, the user must exist for their parent groups to be
        // accessible. Use the collection of defined users.
        return base + '/users/' + encodeURIComponent(identifier) + '/userGroups';

    };

    /**
     * Makes a request to the REST API to retrieve the identifiers of all
     * parent user groups of which a given user or group is a member, returning
     * a promise that can be used for processing the results of the call.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user or
     *     group whose parent user groups should be retrieved. This identifier
     *     corresponds to an AuthenticationProvider within the Guacamole web
     *     application.
     *
     * @param {String} identifier
     *     The identifier of the user or group to retrieve the parent user
     *     groups of.
     *
     * @param {Boolean} [group]
     *     Whether the provided identifier refers to a user group. If false or
     *     omitted, the identifier given is assumed to refer to a user.
     *
     * @returns {Promise.<String[]>}
     *     A promise for the HTTP call which will resolve with an array
     *     containing the requested identifiers upon success.
     */
    service.getUserGroups = function getUserGroups(dataSource, identifier, group) {

        // Retrieve parent groups
        return authenticationService.request({
            cache   : cacheService.users,
            method  : 'GET',
            url     : getUserGroupsResourceURL(dataSource, identifier, group)
        });

    };

    /**
     * Makes a request to the REST API to modify the parent user groups of
     * which a given user or group is a member, returning a promise that can be
     * used for processing the results of the call.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user or
     *     group whose parent user groups should be modified. This identifier
     *     corresponds to an AuthenticationProvider within the Guacamole web
     *     application.
     *
     * @param {String} identifier
     *     The identifier of the user or group to modify the parent user
     *     groups of.
     *
     * @param {String[]} [addToUserGroups]
     *     The identifier of all parent user groups to which the given user or
     *     group should be added as a member, if any.
     *
     * @param {String[]} [removeFromUserGroups]
     *     The identifier of all parent user groups from which the given member
     *     user or group should be removed, if any.
     *
     * @param {Boolean} [group]
     *     Whether the provided identifier refers to a user group. If false or
     *     omitted, the identifier given is assumed to refer to a user.
     *
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     patch operation is successful.
     */
    service.patchUserGroups = function patchUserGroups(dataSource, identifier,
            addToUserGroups, removeFromUserGroups, group) {

        // Update parent user groups
        return authenticationService.request({
            method  : 'PATCH',
            url     : getUserGroupsResourceURL(dataSource, identifier, group),
            data    : getRelatedObjectPatch(addToUserGroups, removeFromUserGroups)
        })

        // Clear the cache
        .then(function parentUserGroupsChanged(){
            cacheService.users.removeAll();
        });

    };

    /**
     * Makes a request to the REST API to retrieve the identifiers of all
     * users which are members of the given user group, returning a promise
     * that can be used for processing the results of the call.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user group
     *     whose member users should be retrieved. This identifier corresponds
     *     to an AuthenticationProvider within the Guacamole web application.
     *
     * @param {String} identifier
     *     The identifier of the user group to retrieve the member users of.
     *
     * @returns {Promise.<String[]>}
     *     A promise for the HTTP call which will resolve with an array
     *     containing the requested identifiers upon success.
     */
    service.getMemberUsers = function getMemberUsers(dataSource, identifier) {

        // Retrieve member users
        return authenticationService.request({
            cache   : cacheService.users,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/userGroups/' + encodeURIComponent(identifier) + '/memberUsers'
        });

    };

    /**
     * Makes a request to the REST API to modify the member users of a given
     * user group, returning a promise that can be used for processing the
     * results of the call.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user group
     *     whose member users should be modified. This identifier corresponds
     *     to an AuthenticationProvider within the Guacamole web application.
     *
     * @param {String} identifier
     *     The identifier of the user group to modify the member users of.
     *
     * @param {String[]} [usersToAdd]
     *     The identifier of all users to add as members of the given user
     *     group, if any.
     *
     * @param {String[]} [usersToRemove]
     *     The identifier of all users to remove from the given user group,
     *     if any.
     *
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     patch operation is successful.
     */
    service.patchMemberUsers = function patchMemberUsers(dataSource, identifier,
            usersToAdd, usersToRemove) {

        // Update member users
        return authenticationService.request({
            method  : 'PATCH',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/userGroups/' + encodeURIComponent(identifier) + '/memberUsers',
            data    : getRelatedObjectPatch(usersToAdd, usersToRemove)
        })

        // Clear the cache
        .then(function memberUsersChanged(){
            cacheService.users.removeAll();
        });

    };

    /**
     * Makes a request to the REST API to retrieve the identifiers of all
     * user groups which are members of the given user group, returning a
     * promise that can be used for processing the results of the call.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user group
     *     whose member user groups should be retrieved. This identifier
     *     corresponds to an AuthenticationProvider within the Guacamole web
     *     application.
     *
     * @param {String} identifier
     *     The identifier of the user group to retrieve the member user
     *     groups of.
     *
     * @returns {Promise.<String[]>}
     *     A promise for the HTTP call which will resolve with an array
     *     containing the requested identifiers upon success.
     */
    service.getMemberUserGroups = function getMemberUserGroups(dataSource, identifier) {

        // Retrieve member user groups
        return authenticationService.request({
            cache   : cacheService.users,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/userGroups/' + encodeURIComponent(identifier) + '/memberUserGroups'
        });

    };

    /**
     * Makes a request to the REST API to modify the member user groups of a
     * given user group, returning a promise that can be used for processing
     * the results of the call.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the user group
     *     whose member user groups should be modified. This identifier
     *     corresponds to an AuthenticationProvider within the Guacamole web
     *     application.
     *
     * @param {String} identifier
     *     The identifier of the user group to modify the member user groups of.
     *
     * @param {String[]} [userGroupsToAdd]
     *     The identifier of all user groups to add as members of the given
     *     user group, if any.
     *
     * @param {String[]} [userGroupsToRemove]
     *     The identifier of all member user groups to remove from the given
     *     user group, if any.
     *
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     patch operation is successful.
     */
    service.patchMemberUserGroups = function patchMemberUserGroups(dataSource,
            identifier, userGroupsToAdd, userGroupsToRemove) {

        // Update member user groups
        return authenticationService.request({
            method  : 'PATCH',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/userGroups/' + encodeURIComponent(identifier) + '/memberUserGroups',
            data    : getRelatedObjectPatch(userGroupsToAdd, userGroupsToRemove)
        })

        // Clear the cache
        .then(function memberUserGroupsChanged(){
            cacheService.users.removeAll();
        });

    };
    
    return service;

}]);
