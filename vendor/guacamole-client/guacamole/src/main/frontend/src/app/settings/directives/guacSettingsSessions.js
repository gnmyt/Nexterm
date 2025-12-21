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
 * A directive for managing all active Guacamole sessions.
 */
angular.module('settings').directive('guacSettingsSessions', [function guacSettingsSessions() {
    
    return {
        // Element only
        restrict: 'E',
        replace: true,

        scope: {
        },

        templateUrl: 'app/settings/templates/settingsSessions.html',
        controller: ['$scope', '$injector', function settingsSessionsController($scope, $injector) {

            // Required types
            var ActiveConnectionWrapper = $injector.get('ActiveConnectionWrapper');
            var ClientIdentifier        = $injector.get('ClientIdentifier');
            var ConnectionGroup         = $injector.get('ConnectionGroup');
            var SortOrder               = $injector.get('SortOrder');

            // Required services
            var $filter                 = $injector.get('$filter');
            var $translate              = $injector.get('$translate');
            var $q                      = $injector.get('$q');
            var activeConnectionService = $injector.get('activeConnectionService');
            var authenticationService   = $injector.get('authenticationService');
            var connectionGroupService  = $injector.get('connectionGroupService');
            var dataSourceService       = $injector.get('dataSourceService');
            var guacNotification        = $injector.get('guacNotification');
            var requestService          = $injector.get('requestService');

            /**
             * The identifiers of all data sources accessible by the current
             * user.
             *
             * @type String[]
             */
            var dataSources = authenticationService.getAvailableDataSources();

            /**
             * The ActiveConnectionWrappers of all active sessions accessible
             * by the current user, or null if the active sessions have not yet
             * been loaded.
             *
             * @type ActiveConnectionWrapper[]
             */
            $scope.wrappers = null;

            /**
             * SortOrder instance which maintains the sort order of the visible
             * connection wrappers.
             *
             * @type SortOrder
             */
            $scope.wrapperOrder = new SortOrder([
                'activeConnection.username',
                'startDate',
                'activeConnection.remoteHost',
                'name'
            ]);

            /**
             * Array of all wrapper properties that are filterable.
             *
             * @type String[]
             */
            $scope.filteredWrapperProperties = [
                'activeConnection.username',
                'startDate',
                'activeConnection.remoteHost',
                'name'
            ];

            /**
             * All active connections, if known, grouped by corresponding data
             * source identifier, or null if active connections have not yet
             * been loaded.
             *
             * @type Object.<String, Object.<String, ActiveConnection>>
             */
            var allActiveConnections = null;

            /**
             * Map of all visible connections by data source identifier and
             * object identifier, or null if visible connections have not yet
             * been loaded.
             *
             * @type Object.<String, Object.<String, Connection>>
             */
            var allConnections = null;

            /**
             * The date format for use for session-related dates.
             *
             * @type String
             */
            var sessionDateFormat = null;

            /**
             * Map of all currently-selected active connection wrappers by
             * data source and identifier.
             * 
             * @type Object.<String, Object.<String, ActiveConnectionWrapper>>
             */
            var allSelectedWrappers = {};

            /**
             * Adds the given connection to the internal set of visible
             * connections.
             *
             * @param {String} dataSource
             *     The identifier of the data source associated with the given
             *     connection.
             *
             * @param {Connection} connection
             *     The connection to add to the internal set of visible
             *     connections.
             */
            var addConnection = function addConnection(dataSource, connection) {

                // Add given connection to set of visible connections
                allConnections[dataSource][connection.identifier] = connection;

            };

            /**
             * Adds all descendant connections of the given connection group to
             * the internal set of connections.
             * 
             * @param {String} dataSource
             *     The identifier of the data source associated with the given
             *     connection group.
             *
             * @param {ConnectionGroup} connectionGroup
             *     The connection group whose descendant connections should be
             *     added to the internal set of connections.
             */
            var addDescendantConnections = function addDescendantConnections(dataSource, connectionGroup) {

                // Add all child connections
                angular.forEach(connectionGroup.childConnections, function addConnectionForDataSource(connection) {
                    addConnection(dataSource, connection);
                });

                // Add all child connection groups
                angular.forEach(connectionGroup.childConnectionGroups, function addConnectionGroupForDataSource(connectionGroup) {
                    addDescendantConnections(dataSource, connectionGroup);
                });

            };

            /**
             * Wraps all loaded active connections, storing the resulting array
             * within the scope. If required data has not yet finished loading,
             * this function has no effect.
             */
            var wrapAllActiveConnections = function wrapAllActiveConnections() {

                // Abort if not all required data is available
                if (!allActiveConnections || !allConnections || !sessionDateFormat)
                    return;

                // Wrap all active connections for sake of display
                $scope.wrappers = [];
                angular.forEach(allActiveConnections, function wrapActiveConnections(activeConnections, dataSource) {
                    angular.forEach(activeConnections, function wrapActiveConnection(activeConnection, identifier) {

                        // Retrieve corresponding connection
                        var connection = allConnections[dataSource][activeConnection.connectionIdentifier];

                        // Add wrapper
                        if (activeConnection.username !== null) {
                            $scope.wrappers.push(new ActiveConnectionWrapper({
                                dataSource       : dataSource,
                                name             : connection.name,
                                startDate        : $filter('date')(activeConnection.startDate, sessionDateFormat),
                                activeConnection : activeConnection
                            }));
                        }

                    });
                });

            };

            // Retrieve all connections 
            dataSourceService.apply(
                connectionGroupService.getConnectionGroupTree,
                dataSources,
                ConnectionGroup.ROOT_IDENTIFIER
            )
            .then(function connectionGroupsReceived(rootGroups) {

                allConnections = {};

                // Load connections from each received root group
                angular.forEach(rootGroups, function connectionGroupReceived(rootGroup, dataSource) {
                    allConnections[dataSource] = {};
                    addDescendantConnections(dataSource, rootGroup);
                });

                // Attempt to produce wrapped list of active connections
                wrapAllActiveConnections();

            }, requestService.DIE);
            
            // Query active sessions
            dataSourceService.apply(
                activeConnectionService.getActiveConnections,
                dataSources
            )
            .then(function sessionsRetrieved(retrievedActiveConnections) {

                // Store received map of active connections
                allActiveConnections = retrievedActiveConnections;

                // Attempt to produce wrapped list of active connections
                wrapAllActiveConnections();

            }, requestService.DIE);

            // Get session date format
            $translate('SETTINGS_SESSIONS.FORMAT_STARTDATE').then(function sessionDateFormatReceived(retrievedSessionDateFormat) {

                // Store received date format
                sessionDateFormat = retrievedSessionDateFormat;

                // Attempt to produce wrapped list of active connections
                wrapAllActiveConnections();

            }, angular.noop);

            /**
             * Returns whether critical data has completed being loaded.
             *
             * @returns {Boolean}
             *     true if enough data has been loaded for the user interface
             *     to be useful, false otherwise.
             */
            $scope.isLoaded = function isLoaded() {
                return $scope.wrappers !== null;
            };

            /**
             * An action to be provided along with the object sent to
             * showStatus which closes the currently-shown status dialog.
             */
            var CANCEL_ACTION = {
                name        : "SETTINGS_SESSIONS.ACTION_CANCEL",
                // Handle action
                callback    : function cancelCallback() {
                    guacNotification.showStatus(false);
                }
            };
            
            /**
             * An action to be provided along with the object sent to
             * showStatus which immediately deletes the currently selected
             * sessions.
             */
            var DELETE_ACTION = {
                name        : "SETTINGS_SESSIONS.ACTION_DELETE",
                className   : "danger",
                // Handle action
                callback    : function deleteCallback() {
                    deleteAllSessionsImmediately();
                    guacNotification.showStatus(false);
                }
            };
            
            /**
             * Immediately deletes the selected sessions, without prompting the
             * user for confirmation.
             */
            var deleteAllSessionsImmediately = function deleteAllSessionsImmediately() {

                var deletionRequests = [];

                // Perform deletion for each relevant data source
                angular.forEach(allSelectedWrappers, function deleteSessionsImmediately(selectedWrappers, dataSource) {

                    // Delete sessions, if any are selected
                    var identifiers = Object.keys(selectedWrappers);
                    if (identifiers.length)
                        deletionRequests.push(activeConnectionService.deleteActiveConnections(dataSource, identifiers));

                });

                // Update interface
                $q.all(deletionRequests)
                .then(function activeConnectionsDeleted() {

                    // Remove deleted connections from wrapper array
                    $scope.wrappers = $scope.wrappers.filter(function activeConnectionStillExists(wrapper) {
                        return !(wrapper.activeConnection.identifier in (allSelectedWrappers[wrapper.dataSource] || {}));
                    });

                    // Clear selection
                    allSelectedWrappers = {};

                }, guacNotification.SHOW_REQUEST_ERROR);

            }; 
            
            /**
             * Delete all selected sessions, prompting the user first to
             * confirm that deletion is desired.
             */
            $scope.deleteSessions = function deleteSessions() {
                // Confirm deletion request
                guacNotification.showStatus({
                    'title'      : 'SETTINGS_SESSIONS.DIALOG_HEADER_CONFIRM_DELETE',
                    'text'       : {
                        'key' : 'SETTINGS_SESSIONS.TEXT_CONFIRM_DELETE'
                    },
                    'actions'    : [ DELETE_ACTION, CANCEL_ACTION]
                });
            };

            /**
             * Returns the relative URL of the client page which accesses the
             * given active connection. If the active connection is not
             * connectable, null is returned.
             *
             * @param {String} dataSource
             *     The unique identifier of the data source containing the
             *     active connection.
             *
             * @param {String} activeConnection
             *     The active connection to determine the relative URL of.
             *
             * @returns {String}
             *     The relative URL of the client page which accesses the given
             *     active connection, or null if the active connection is not
             *     connectable.
             */
            $scope.getClientURL = function getClientURL(dataSource, activeConnection) {

                if (!activeConnection.connectable)
                    return null;

                return '#/client/' + encodeURIComponent(ClientIdentifier.toString({
                    dataSource : dataSource,
                    type       : ClientIdentifier.Types.ACTIVE_CONNECTION,
                    id         : activeConnection.identifier
                }));

            };

            /**
             * Returns whether the selected sessions can be deleted.
             * 
             * @returns {Boolean}
             *     true if selected sessions can be deleted, false otherwise.
             */
            $scope.canDeleteSessions = function canDeleteSessions() {

                // We can delete sessions if at least one is selected
                for (var dataSource in allSelectedWrappers) {
                    for (var identifier in allSelectedWrappers[dataSource])
                        return true;
                }

                return false;

            };
            
            /**
             * Called whenever an active connection wrapper changes selected
             * status.
             * 
             * @param {ActiveConnectionWrapper} wrapper
             *     The wrapper whose selected status has changed.
             */
            $scope.wrapperSelectionChange = function wrapperSelectionChange(wrapper) {

                // Get selection map for associated data source, creating if necessary
                var selectedWrappers = allSelectedWrappers[wrapper.dataSource];
                if (!selectedWrappers)
                    selectedWrappers = allSelectedWrappers[wrapper.dataSource] = {};

                // Add wrapper to map if selected
                if (wrapper.checked)
                    selectedWrappers[wrapper.activeConnection.identifier] = wrapper;

                // Otherwise, remove wrapper from map
                else
                    delete selectedWrappers[wrapper.activeConnection.identifier];

            };
            
        }]
    };
    
}]);
