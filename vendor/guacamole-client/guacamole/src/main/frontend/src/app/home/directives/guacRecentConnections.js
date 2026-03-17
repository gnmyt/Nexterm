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
 * A directive which displays the recently-accessed connections nested beneath
 * each of the given connection groups.
 */
angular.module('home').directive('guacRecentConnections', [function guacRecentConnections() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The root connection groups to display, and all visible
             * descendants, as a map of data source identifier to the root
             * connection group within that data source. Recent connections
             * will only be shown if they exist within this hierarchy,
             * regardless of their existence within the history.
             *
             * @type Object.<String, ConnectionGroup>
             */
            rootGroups : '='

        },

        templateUrl: 'app/home/templates/guacRecentConnections.html',
        controller: ['$scope', '$injector', function guacRecentConnectionsController($scope, $injector) {

            // Required types
            var ClientIdentifier = $injector.get('ClientIdentifier');
            var RecentConnection = $injector.get('RecentConnection');

            // Required services
            var guacHistory       = $injector.get('guacHistory');
            var preferenceService = $injector.get('preferenceService');

            /**
             * Array of all known and visible recently-used connections.
             *
             * @type RecentConnection[]
             */
            $scope.recentConnections = [];
            
            /**
             * Remove the connection from the recent connection list having the
             * given identifier.
             * 
             * @param {!RecentConnection} recentConnection
             *     The recent connection to remove from the history list.
             *     
             * @returns {boolean}
             *     True if the removal was successful, otherwise false.
             */
            $scope.removeRecentConnection = function removeRecentConnection(recentConnection) {
                return ($scope.recentConnections.splice($scope.recentConnections.indexOf(recentConnection), 1) 
                        && guacHistory.removeEntry(recentConnection.entry.id));
            };
            
            /**
             * Returns whether recent connections are available for display.
             *
             * @returns {!boolean}
             *     true if recent connections are present, false otherwise.
             */
            $scope.hasRecentConnections = function hasRecentConnections() {
                return !!$scope.recentConnections.length;
            };

            /**
             * Map of all visible objects, connections or connection groups, by
             * object identifier.
             *
             * @type Object.<String, Connection|ConnectionGroup>
             */
            var visibleObjects = {};

            /**
             * Adds the given connection to the internal set of visible
             * objects.
             *
             * @param {String} dataSource
             *     The identifier of the data source associated with the
             *     given connection group.
             *
             * @param {Connection} connection
             *     The connection to add to the internal set of visible objects.
             */
            var addVisibleConnection = function addVisibleConnection(dataSource, connection) {

                // Add given connection to set of visible objects
                visibleObjects[ClientIdentifier.toString({
                    dataSource : dataSource,
                    type       : ClientIdentifier.Types.CONNECTION,
                    id         : connection.identifier
                })] = connection;

            };

            /**
             * Adds the given connection group to the internal set of visible
             * objects, along with any descendants.
             *
             * @param {String} dataSource
             *     The identifier of the data source associated with the
             *     given connection group.
             *
             * @param {ConnectionGroup} connectionGroup
             *     The connection group to add to the internal set of visible
             *     objects, along with any descendants.
             */
            var addVisibleConnectionGroup = function addVisibleConnectionGroup(dataSource, connectionGroup) {

                // Add given connection group to set of visible objects
                visibleObjects[ClientIdentifier.toString({
                    dataSource : dataSource,
                    type       : ClientIdentifier.Types.CONNECTION_GROUP,
                    id         : connectionGroup.identifier
                })] = connectionGroup;

                // Add all child connections
                if (connectionGroup.childConnections)
                    connectionGroup.childConnections.forEach(function addChildConnection(child) {
                        addVisibleConnection(dataSource, child);
                    });

                // Add all child connection groups
                if (connectionGroup.childConnectionGroups)
                    connectionGroup.childConnectionGroups.forEach(function addChildConnectionGroup(child) {
                        addVisibleConnectionGroup(dataSource, child);
                    });

            };

            // Update visible objects when root groups are set
            $scope.$watch("rootGroups", function setRootGroups(rootGroups) {

                // Clear connection arrays
                $scope.recentConnections = [];

                // Produce collection of visible objects
                visibleObjects = {};
                if (rootGroups) {
                    angular.forEach(rootGroups, function addConnectionGroup(rootGroup, dataSource) {
                        addVisibleConnectionGroup(dataSource, rootGroup);
                    });
                }

                // Add any recent connections that are visible
                guacHistory.recentConnections.forEach(function addRecentConnection(historyEntry) {

                    // Add recent connections for history entries with associated visible objects
                    if (historyEntry.id in visibleObjects) {

                        var object = visibleObjects[historyEntry.id];
                        $scope.recentConnections.push(new RecentConnection(object.name, historyEntry));

                    }

                });

            }); // end rootGroup scope watch

        }]

    };
}]);
