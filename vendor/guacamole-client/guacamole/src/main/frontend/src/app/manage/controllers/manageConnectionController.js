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
 * The controller for editing or creating connections.
 */
angular.module('manage').controller('manageConnectionController', ['$scope', '$injector',
        function manageConnectionController($scope, $injector) {

    // Required types
    var Connection            = $injector.get('Connection');
    var ConnectionGroup       = $injector.get('ConnectionGroup');
    var HistoryEntryWrapper   = $injector.get('HistoryEntryWrapper');
    var ManagementPermissions = $injector.get('ManagementPermissions');
    var PermissionSet         = $injector.get('PermissionSet');
    var Protocol              = $injector.get('Protocol');

    // Required services
    var $location                = $injector.get('$location');
    var $q                       = $injector.get('$q');
    var $routeParams             = $injector.get('$routeParams');
    var $translate               = $injector.get('$translate');
    var $window                  = $injector.get('$window');
    var authenticationService    = $injector.get('authenticationService');
    var connectionService        = $injector.get('connectionService');
    var connectionGroupService   = $injector.get('connectionGroupService');
    var permissionService        = $injector.get('permissionService');
    var requestService           = $injector.get('requestService');
    var schemaService            = $injector.get('schemaService');

    /**
     * The unique identifier of the data source containing the connection being
     * edited.
     *
     * @type String
     */
    $scope.selectedDataSource = $routeParams.dataSource;

    /**
     * The identifier of the original connection from which this connection is
     * being cloned. Only valid if this is a new connection.
     * 
     * @type String
     */
    var cloneSourceIdentifier = $location.search().clone;

    /**
     * The identifier of the connection being edited. If a new connection is
     * being created, this will not be defined.
     *
     * @type String
     */
    var identifier = $routeParams.id;

    /**
     * All known protocols.
     *
     * @type Object.<String, Protocol>
     */
    $scope.protocols = null;

    /**
     * The root connection group of the connection group hierarchy.
     *
     * @type ConnectionGroup
     */
    $scope.rootGroup = null;

    /**
     * The connection being modified.
     * 
     * @type Connection
     */
    $scope.connection = null;

    /**
     * The parameter name/value pairs associated with the connection being
     * modified.
     *
     * @type Object.<String, String>
     */
    $scope.parameters = null;

    /**
     * The date format for use within the connection history.
     *
     * @type String
     */
    $scope.historyDateFormat = null;

    /**
     * The usage history of the connection being modified.
     *
     * @type HistoryEntryWrapper[]
     */
    $scope.historyEntryWrappers = null;

    /**
     * The management-related actions that the current user may perform on the
     * connection currently being created/modified, or null if the current
     * user's permissions have not yet been loaded.
     *
     * @type ManagementPermissions
     */
    $scope.managementPermissions = null;

    /**
     * All available connection attributes. This is only the set of attribute
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

        return $scope.protocols             !== null
            && $scope.rootGroup             !== null
            && $scope.connection            !== null
            && $scope.parameters            !== null
            && $scope.historyDateFormat     !== null
            && $scope.historyEntryWrappers  !== null
            && $scope.managementPermissions !== null
            && $scope.attributes            !== null;

    };

    /**
     * Loads the data associated with the connection having the given
     * identifier, preparing the interface for making modifications to that
     * existing connection.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the connection to
     *     load.
     *
     * @param {String} identifier
     *     The identifier of the connection to load.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     editing the given connection.
     */
    var loadExistingConnection = function loadExistingConnection(dataSource, identifier) {
        return $q.all({
            connection     : connectionService.getConnection(dataSource, identifier),
            historyEntries : connectionService.getConnectionHistory(dataSource, identifier),
            parameters     : connectionService.getConnectionParameters(dataSource, identifier)
        })
        .then(function connectionDataRetrieved(values) {

            $scope.connection = values.connection;
            $scope.parameters = values.parameters;

            // Wrap all history entries for sake of display
            $scope.historyEntryWrappers = [];
            angular.forEach(values.historyEntries, function wrapHistoryEntry(historyEntry) {
               $scope.historyEntryWrappers.push(new HistoryEntryWrapper(historyEntry));
            });

        });
    };

    /**
     * Loads the data associated with the connection having the given
     * identifier, preparing the interface for cloning that existing
     * connection.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the connection
     *     to be cloned.
     *
     * @param {String} identifier
     *     The identifier of the connection being cloned.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     cloning the given connection.
     */
    var loadClonedConnection = function loadClonedConnection(dataSource, identifier) {
        return $q.all({
            connection : connectionService.getConnection(dataSource, identifier),
            parameters : connectionService.getConnectionParameters(dataSource, identifier)
        })
        .then(function connectionDataRetrieved(values) {

            $scope.connection = values.connection;
            $scope.parameters = values.parameters;

            // Clear the identifier field because this connection is new
            delete $scope.connection.identifier;

            // Cloned connections have no history
            $scope.historyEntryWrappers = [];

        });
    };

    /**
     * Loads skeleton connection data, preparing the interface for creating a
     * new connection.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     creating a new connection.
     */
    var loadSkeletonConnection = function loadSkeletonConnection() {

        // Use skeleton connection object with no associated permissions,
        // history, or parameters
        $scope.connection = new Connection({
            protocol         : 'vnc',
            parentIdentifier : $location.search().parent
        });
        $scope.historyEntryWrappers = [];
        $scope.parameters = {};

        return $q.resolve();

    };

    /**
     * Loads the data required for performing the management task requested
     * through the route parameters given at load time, automatically preparing
     * the interface for editing an existing connection, cloning an existing
     * connection, or creating an entirely new connection.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared
     *     for performing the requested management task.
     */
    var loadRequestedConnection = function loadRequestedConnection() {

        // If we are editing an existing connection, pull its data
        if (identifier)
            return loadExistingConnection($scope.selectedDataSource, identifier);

        // If we are cloning an existing connection, pull its data instead
        if (cloneSourceIdentifier)
            return loadClonedConnection($scope.selectedDataSource, cloneSourceIdentifier);

        // If we are creating a new connection, populate skeleton connection data
        return loadSkeletonConnection();

    };

    // Populate interface with requested data
    $q.all({
        connectionData : loadRequestedConnection(),
        attributes  : schemaService.getConnectionAttributes($scope.selectedDataSource),
        permissions : permissionService.getEffectivePermissions($scope.selectedDataSource, authenticationService.getCurrentUsername()),
        protocols   : schemaService.getProtocols($scope.selectedDataSource),
        rootGroup   : connectionGroupService.getConnectionGroupTree($scope.selectedDataSource, ConnectionGroup.ROOT_IDENTIFIER, [PermissionSet.ObjectPermissionType.ADMINISTER])
    })
    .then(function dataRetrieved(values) {

        $scope.attributes = values.attributes;
        $scope.protocols = values.protocols;
        $scope.rootGroup = values.rootGroup;

        $scope.managementPermissions = ManagementPermissions.fromPermissionSet(
                    values.permissions,
                    PermissionSet.SystemPermissionType.CREATE_CONNECTION,
                    PermissionSet.hasConnectionPermission,
                    identifier);

    }, requestService.DIE);
    
    // Get history date format
    $translate('MANAGE_CONNECTION.FORMAT_HISTORY_START').then(function historyDateFormatReceived(historyDateFormat) {
        $scope.historyDateFormat = historyDateFormat;
    }, angular.noop);

    /**
     * @borrows Protocol.getNamespace
     */
    $scope.getNamespace = Protocol.getNamespace;

    /**
     * @borrows Protocol.getName
     */
    $scope.getProtocolName = Protocol.getName;

    /**
     * Cancels all pending edits, returning to the main list of connections
     * within the selected data source.
     */
    $scope.returnToConnectionList = function returnToConnectionList() {
        $location.url('/settings/' + encodeURIComponent($scope.selectedDataSource) + '/connections');
    };
    
    /**
     * Cancels all pending edits, opening an edit page for a new connection
     * which is prepopulated with the data from the connection currently being edited. 
     */
    $scope.cloneConnection = function cloneConnection() {
        $location.path('/manage/' + encodeURIComponent($scope.selectedDataSource) + '/connections').search('clone', identifier);
        $window.scrollTo(0,0);
    };
            
    /**
     * Saves the current connection, creating a new connection or updating the
     * existing connection, returning a promise which is resolved if the save
     * operation succeeds and rejected if the save operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the save operation succeeds and is
     *     rejected with an {@link Error} if the save operation fails.
     */
    $scope.saveConnection = function saveConnection() {

        $scope.connection.parameters = $scope.parameters;

        // Save the connection
        return connectionService.saveConnection($scope.selectedDataSource, $scope.connection);

    };

    /**
     * Deletes the current connection, returning a promise which is resolved if
     * the delete operation succeeds and rejected if the delete operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the delete operation succeeds and is
     *     rejected with an {@link Error} if the delete operation fails.
     */
    $scope.deleteConnection = function deleteConnection() {
        return connectionService.deleteConnection($scope.selectedDataSource, $scope.connection);
    };

}]);
