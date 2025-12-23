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
 * A directive which displays the contents of a connection group within an
 * automatically-paginated view.
 */
angular.module('groupList').directive('guacGroupList', [function guacGroupList() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The connection groups to display as a map of data source
             * identifier to corresponding root group.
             *
             * @type Object.<String, ConnectionGroup|GroupListItem>
             */
            connectionGroups : '=',

            /**
             * Arbitrary object which shall be made available to the connection
             * and connection group templates within the scope as
             * <code>context</code>.
             * 
             * @type Object
             */
            context : '=',

            /**
             * The map of @link{GroupListItem} type to the URL or ID of the
             * Angular template to use when rendering a @link{GroupListItem} of
             * that type. The @link{GroupListItem} itself will be within the
             * scope of the template as <code>item</code>, and the arbitrary
             * context object, if any, will be exposed as <code>context</code>.
             * If the template for a type is omitted, items of that type will
             * not be rendered. All standard types are defined by
             * @link{GroupListItem.Type}, but use of custom types is legal.
             *
             * @type Object.<String, String>
             */
            templates : '=',

            /**
             * Whether the root of the connection group hierarchy given should
             * be shown. If false (the default), only the descendants of the
             * given connection group will be listed.
             * 
             * @type Boolean
             */
            showRootGroup : '=',

            /**
             * The maximum number of connections or groups to show per page.
             *
             * @type Number
             */
            pageSize : '=',

            /**
             * A callback which accepts an array of GroupListItems as its sole
             * parameter. If provided, the callback will be invoked whenever an
             * array of root-level GroupListItems is about to be rendered.
             * Changes may be made by this function to that array or to the
             * GroupListItems themselves.
             *
             * @type Function
             */
            decorator : '='

        },

        templateUrl: 'app/groupList/templates/guacGroupList.html',
        controller: ['$scope', '$injector', function guacGroupListController($scope, $injector) {

            // Required services
            var activeConnectionService = $injector.get('activeConnectionService');
            var dataSourceService       = $injector.get('dataSourceService');
            var requestService          = $injector.get('requestService');

            // Required types
            var GroupListItem = $injector.get('GroupListItem');

            /**
             * Map of data source identifier to the number of active
             * connections associated with a given connection identifier.
             * If this information is unknown, or there are no active
             * connections for a given identifier, no number will be stored.
             *
             * @type Object.<String, Object.<String, Number>>
             */
            var connectionCount = {};

            /**
             * A list of all items which should appear at the root level. As
             * connections and connection groups from multiple data sources may
             * be included in a guacGroupList, there may be multiple root
             * items, even if the root connection group is shown.
             *
             * @type GroupListItem[]
             */
            $scope.rootItems = [];

            /**
             * Returns the number of active usages of a given connection.
             *
             * @param {String} dataSource
             *     The identifier of the data source containing the given
             *     connection.
             *
             * @param {Connection} connection
             *     The connection whose active connections should be counted.
             *
             * @returns {Number}
             *     The number of currently-active usages of the given
             *     connection.
             */
            var countActiveConnections = function countActiveConnections(dataSource, connection) {
                return connectionCount[dataSource][connection.identifier];
            };

            /**
             * Returns whether a @link{GroupListItem} of the given type can be
             * displayed. If there is no template associated with the given
             * type, then a @link{GroupListItem} of that type cannot be
             * displayed.
             *
             * @param {String} type
             *     The type to check.
             *
             * @returns {Boolean}
             *     true if the given @link{GroupListItem} type can be displayed,
             *     false otherwise.
             */
            $scope.isVisible = function isVisible(type) {
                return !!$scope.templates[type];
            };

            // Set contents whenever the connection group is assigned or changed
            $scope.$watch('connectionGroups', function setContents(connectionGroups) {

                // Reset stored data
                var dataSources = [];
                $scope.rootItems = [];
                connectionCount = {};

                // If connection groups are given, add them to the interface
                if (connectionGroups) {

                    // Add each provided connection group
                    angular.forEach(connectionGroups, function addConnectionGroup(connectionGroup, dataSource) {

                        var rootItem;

                        // Prepare data source for active connection counting
                        dataSources.push(dataSource);
                        connectionCount[dataSource] = {};

                        // If the provided connection group is already a
                        // GroupListItem, no need to create a new item
                        if (connectionGroup instanceof GroupListItem)
                            rootItem = connectionGroup;

                        // Create root item for current connection group
                        else
                            rootItem = GroupListItem.fromConnectionGroup(dataSource, connectionGroup,
                                $scope.isVisible(GroupListItem.Type.CONNECTION),
                                $scope.isVisible(GroupListItem.Type.SHARING_PROFILE),
                                countActiveConnections);

                        // If root group is to be shown, add it as a root item
                        if ($scope.showRootGroup)
                            $scope.rootItems.push(rootItem);

                        // Otherwise, add its children as root items
                        else {
                            angular.forEach(rootItem.children, function addRootItem(child) {
                                $scope.rootItems.push(child);
                            });
                        }

                    });

                    // Count active connections by connection identifier
                    dataSourceService.apply(
                        activeConnectionService.getActiveConnections,
                        dataSources
                    )
                    .then(function activeConnectionsRetrieved(activeConnectionMap) {

                        // Within each data source, count each active connection by identifier
                        angular.forEach(activeConnectionMap, function addActiveConnections(activeConnections, dataSource) {
                            angular.forEach(activeConnections, function addActiveConnection(activeConnection) {

                                // If counter already exists, increment
                                var identifier = activeConnection.connectionIdentifier;
                                if (connectionCount[dataSource][identifier])
                                    connectionCount[dataSource][identifier]++;

                                // Otherwise, initialize counter to 1
                                else
                                    connectionCount[dataSource][identifier] = 1;

                            });
                        });

                    }, requestService.DIE);

                }

                // Invoke item decorator, if provided
                if ($scope.decorator)
                    $scope.decorator($scope.rootItems);

            });

            /**
             * Toggle the open/closed status of a group list item.
             * 
             * @param {GroupListItem} groupListItem
             *     The list item to expand, which should represent a
             *     connection group.
             */
            $scope.toggleExpanded = function toggleExpanded(groupListItem) {
                groupListItem.expanded = !groupListItem.expanded;
            };

        }]

    };
}]);
