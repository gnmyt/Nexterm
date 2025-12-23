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
 * The controller for editing or creating connection groups.
 */
angular.module('manage').controller('manageConnectionGroupController', ['$scope', '$injector', 
        function manageConnectionGroupController($scope, $injector) {
            
    // Required types
    var ConnectionGroup       = $injector.get('ConnectionGroup');
    var ManagementPermissions = $injector.get('ManagementPermissions');
    var PermissionSet         = $injector.get('PermissionSet');

    // Required services
    var $location              = $injector.get('$location');
    var $q                     = $injector.get('$q');
    var $routeParams           = $injector.get('$routeParams');
    var $window                = $injector.get('$window');
    var authenticationService  = $injector.get('authenticationService');
    var connectionGroupService = $injector.get('connectionGroupService');
    var permissionService      = $injector.get('permissionService');
    var requestService         = $injector.get('requestService');
    var schemaService          = $injector.get('schemaService');
    
    /**
     * The unique identifier of the data source containing the connection group
     * being edited.
     *
     * @type String
     */
    $scope.selectedDataSource = $routeParams.dataSource;

    /**
     * The identifier of the original connection group from which this
     * connection group is being cloned. Only valid if this is a new
     * connection group.
     *
     * @type String
     */
    var cloneSourceIdentifier = $location.search().clone;

    /**
     * The identifier of the connection group being edited. If a new connection
     * group is being created, this will not be defined.
     *
     * @type String
     */
    var identifier = $routeParams.id;

    /**
     * Available connection group types, as translation string / internal value
     * pairs.
     *
     * @type Object[]
     */
    $scope.types = [
        {
            label: "MANAGE_CONNECTION_GROUP.NAME_TYPE_ORGANIZATIONAL",
            value: ConnectionGroup.Type.ORGANIZATIONAL
        },
        {
            label: "MANAGE_CONNECTION_GROUP.NAME_TYPE_BALANCING",
            value : ConnectionGroup.Type.BALANCING
        }
    ];

    /**
     * The root connection group of the connection group hierarchy.
     *
     * @type ConnectionGroup
     */
    $scope.rootGroup = null;

    /**
     * The connection group being modified.
     * 
     * @type ConnectionGroup
     */
    $scope.connectionGroup = null;
    
    /**
     * The management-related actions that the current user may perform on the
     * connection group currently being created/modified, or null if the current
     * user's permissions have not yet been loaded.
     *
     * @type ManagementPermissions
     */
    $scope.managementPermissions = null;

    /**
     * All available connection group attributes. This is only the set of
     * attribute definitions, organized as logical groupings of attributes, not
     * attribute values.
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

        return $scope.rootGroup                !== null
            && $scope.connectionGroup          !== null
            && $scope.managementPermissions    !== null
            && $scope.attributes               !== null;

    };

    /**
     * Loads the data associated with the connection group having the given
     * identifier, preparing the interface for making modifications to that
     * existing connection group.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the connection
     *     group to load.
     *
     * @param {String} identifier
     *     The identifier of the connection group to load.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     editing the given connection group.
     */
    var loadExistingConnectionGroup = function loadExistingConnectionGroup(dataSource, identifier) {
        return connectionGroupService.getConnectionGroup(
            dataSource,
            identifier
        )
        .then(function connectionGroupReceived(connectionGroup) {
            $scope.connectionGroup = connectionGroup;
        });
    };

    /**
     * Loads the data associated with the connection group having the given
     * identifier, preparing the interface for cloning that existing
     * connection group.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the connection
     *     group to be cloned.
     *
     * @param {String} identifier
     *     The identifier of the connection group being cloned.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     cloning the given connection group.
     */
    var loadClonedConnectionGroup = function loadClonedConnectionGroup(dataSource, identifier) {
        return connectionGroupService.getConnectionGroup(
            dataSource,
            identifier
        )
        .then(function connectionGroupReceived(connectionGroup) {
            $scope.connectionGroup = connectionGroup;
            delete $scope.connectionGroup.identifier;
        });
    };

    /**
     * Loads skeleton connection group data, preparing the interface for
     * creating a new connection group.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     creating a new connection group.
     */
    var loadSkeletonConnectionGroup = function loadSkeletonConnectionGroup() {

        // Use skeleton connection group object with specified parent
        $scope.connectionGroup = new ConnectionGroup({
            parentIdentifier : $location.search().parent
        });

        return $q.resolve();

    };

    /**
     * Loads the data required for performing the management task requested
     * through the route parameters given at load time, automatically preparing
     * the interface for editing an existing connection group, cloning an
     * existing connection group, or creating an entirely new connection group.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared
     *     for performing the requested management task.
     */
    var loadRequestedConnectionGroup = function loadRequestedConnectionGroup() {

        // If we are editing an existing connection group, pull its data
        if (identifier)
            return loadExistingConnectionGroup($scope.selectedDataSource, identifier);

        // If we are cloning an existing connection group, pull its data
        // instead
        if (cloneSourceIdentifier)
            return loadClonedConnectionGroup($scope.selectedDataSource, cloneSourceIdentifier);

        // If we are creating a new connection group, populate skeleton
        // connection group data
        return loadSkeletonConnectionGroup();

    };

    // Query the user's permissions for the current connection group
    $q.all({
        connectionGroupData : loadRequestedConnectionGroup(),
        attributes  : schemaService.getConnectionGroupAttributes($scope.selectedDataSource),
        permissions : permissionService.getEffectivePermissions($scope.selectedDataSource, authenticationService.getCurrentUsername()),
        rootGroup   : connectionGroupService.getConnectionGroupTree($scope.selectedDataSource, ConnectionGroup.ROOT_IDENTIFIER, [PermissionSet.ObjectPermissionType.ADMINISTER])
    })
    .then(function connectionGroupDataRetrieved(values) {
                
        $scope.attributes = values.attributes;
        $scope.rootGroup = values.rootGroup;

        $scope.managementPermissions = ManagementPermissions.fromPermissionSet(
                    values.permissions,
                    PermissionSet.SystemPermissionType.CREATE_CONNECTION,
                    PermissionSet.hasConnectionGroupPermission,
                    identifier);

    }, requestService.DIE);

    /**
     * Cancels all pending edits, returning to the main list of connections
     * within the selected data source.
     */
    $scope.returnToConnectionList = function returnToConnectionList() {
        $location.path('/settings/' + encodeURIComponent($scope.selectedDataSource) + '/connections');
    };

    /**
     * Cancels all pending edits, opening an edit page for a new connection
     * group which is prepopulated with the data from the connection group
     * currently being edited.
     */
    $scope.cloneConnectionGroup = function cloneConnectionGRoup() {
        $location.path('/manage/' + encodeURIComponent($scope.selectedDataSource) + '/connectionGroups').search('clone', identifier);
        $window.scrollTo(0,0);
    };

    /**
     * Saves the current connection group, creating a new connection group or
     * updating the existing connection group, returning a promise which is
     * resolved if the save operation succeeds and rejected if the save
     * operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the save operation succeeds and is
     *     rejected with an {@link Error} if the save operation fails.
     */
    $scope.saveConnectionGroup = function saveConnectionGroup() {
        return connectionGroupService.saveConnectionGroup($scope.selectedDataSource, $scope.connectionGroup);
    };
    
    /**
     * Deletes the current connection group, returning a promise which is
     * resolved if the delete operation succeeds and rejected if the delete
     * operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the delete operation succeeds and is
     *     rejected with an {@link Error} if the delete operation fails.
     */
    $scope.deleteConnectionGroup = function deleteConnectionGroup() {
        return connectionGroupService.deleteConnectionGroup($scope.selectedDataSource, $scope.connectionGroup);
    };

}]);
