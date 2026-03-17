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
 * A directive which provides a filtering text input field which automatically
 * produces a filtered subset of the given connection groups.
 */
angular.module('groupList').directive('guacGroupListFilter', [function guacGroupListFilter() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The property to which a subset of the provided map of connection
             * groups will be assigned. The type of each item within the
             * original map is preserved within the filtered map.
             *
             * @type Object.<String, ConnectionGroup|GroupListItem>
             */
            filteredConnectionGroups : '=',

            /**
             * The placeholder text to display within the filter input field
             * when no filter has been provided.
             * 
             * @type String
             */
            placeholder : '&',

            /**
             * The connection groups to filter, as a map of data source
             * identifier to corresponding root group. A subset of this map
             * will be exposed as filteredConnectionGroups.
             *
             * @type Object.<String, ConnectionGroup|GroupListItem>
             */
            connectionGroups : '&',

            /**
             * An array of expressions to filter against for each connection in
             * the hierarchy of connections and groups in the provided map.
             * These expressions must be Angular expressions which resolve to
             * properties on the connections in the provided map.
             *
             * @type String[]
             */
            connectionProperties : '&',

            /**
             * An array of expressions to filter against for each connection group
             * in the hierarchy of connections and groups in the provided map.
             * These expressions must be Angular expressions which resolve to
             * properties on the connection groups in the provided map.
             *
             * @type String[]
             */
            connectionGroupProperties : '&'

        },

        templateUrl: 'app/groupList/templates/guacGroupListFilter.html',
        controller: ['$scope', '$injector', function guacGroupListFilterController($scope, $injector) {

            // Required types
            var ConnectionGroup = $injector.get('ConnectionGroup');
            var FilterPattern   = $injector.get('FilterPattern');
            var GroupListItem   = $injector.get('GroupListItem');

            /**
             * The pattern object to use when filtering connections.
             *
             * @type FilterPattern
             */
            var connectionFilterPattern = new FilterPattern($scope.connectionProperties());

            /**
             * The pattern object to use when filtering connection groups.
             *
             * @type FilterPattern
             */
            var connectionGroupFilterPattern = new FilterPattern($scope.connectionGroupProperties());

            /**
             * The filter search string to use to restrict the displayed
             * connection groups.
             *
             * @type String
             */
            $scope.searchString = null;

            /**
             * Flattens the connection group hierarchy of the given connection
             * group such that all descendants are copied as immediate
             * children. The hierarchy of nested connection groups is otherwise
             * completely preserved. A connection or connection group nested
             * two or more levels deep within the hierarchy will thus appear
             * within the returned connection group in two places: in its
             * original location AND as an immediate child.
             *
             * @param {ConnectionGroup} connectionGroup
             *     The connection group whose descendents should be copied as
             *     first-level children.
             *
             * @returns {ConnectionGroup}
             *     A new connection group completely identical to the provided
             *     connection group, except that absolutely all descendents
             *     have been copied into the first level of children.
             */
            var flattenConnectionGroup = function flattenConnectionGroup(connectionGroup) {

                // Replace connection group with shallow copy
                connectionGroup = new ConnectionGroup(connectionGroup);

                // Ensure child arrays are defined and independent copies
                connectionGroup.childConnections = angular.copy(connectionGroup.childConnections) || [];
                connectionGroup.childConnectionGroups = angular.copy(connectionGroup.childConnectionGroups) || [];

                // Flatten all children to the top-level group
                angular.forEach(connectionGroup.childConnectionGroups, function flattenChild(child) {

                    var flattenedChild = flattenConnectionGroup(child);

                    // Merge all child connections
                    Array.prototype.push.apply(
                        connectionGroup.childConnections,
                        flattenedChild.childConnections
                    );

                    // Merge all child connection groups
                    Array.prototype.push.apply(
                        connectionGroup.childConnectionGroups,
                        flattenedChild.childConnectionGroups
                    );

                });

                return connectionGroup;

            };

            /**
             * Flattens the connection group hierarchy of the given
             * GroupListItem such that all descendants are copied as immediate
             * children. The hierarchy of nested items is otherwise completely
             * preserved. A connection or connection group nested two or more
             * levels deep within the hierarchy will thus appear within the
             * returned item in two places: in its original location AND as an
             * immediate child.
             *
             * @param {GroupListItem} item
             *     The GroupListItem whose descendents should be copied as
             *     first-level children.
             *
             * @returns {GroupListItem}
             *     A new GroupListItem completely identical to the provided
             *     item, except that absolutely all descendents have been
             *     copied into the first level of children.
             */
            var flattenGroupListItem = function flattenGroupListItem(item) {

                // Replace item with shallow copy
                item = new GroupListItem(item);

                // Ensure children are defined and independent copies
                item.children = angular.copy(item.children) || [];

                // Flatten all children to the top-level group
                angular.forEach(item.children, function flattenChild(child) {
                    if (child.type === GroupListItem.Type.CONNECTION_GROUP) {

                        var flattenedChild = flattenGroupListItem(child);

                        // Merge all children
                        Array.prototype.push.apply(
                            item.children,
                            flattenedChild.children
                        );

                    }
                });

                return item;

            };

            /**
             * Replaces the set of children within the given GroupListItem such
             * that only children which match the filter predicate for the
             * current search string are present.
             *
             * @param {GroupListItem} item
             *     The GroupListItem whose children should be filtered.
             */
            var filterGroupListItem = function filterGroupListItem(item) {
                item.children = item.children.filter(function applyFilterPattern(child) {

                    // Filter connections and connection groups by
                    // given pattern
                    switch (child.type) {

                        case GroupListItem.Type.CONNECTION:
                            return connectionFilterPattern.predicate(child.wrappedItem);

                        case GroupListItem.Type.CONNECTION_GROUP:
                            return connectionGroupFilterPattern.predicate(child.wrappedItem);

                    }

                    // Include all other children
                    return true;

                });
            };

            /**
             * Replaces the set of child connections and connection groups
             * within the given connection group such that only children which
             * match the filter predicate for the current search string are
             * present.
             *
             * @param {ConnectionGroup} connectionGroup
             *     The connection group whose children should be filtered.
             */
            var filterConnectionGroup = function filterConnectionGroup(connectionGroup) {
                connectionGroup.childConnections = connectionGroup.childConnections.filter(connectionFilterPattern.predicate);
                connectionGroup.childConnectionGroups = connectionGroup.childConnectionGroups.filter(connectionGroupFilterPattern.predicate);
            };

            /**
             * Applies the current filter predicate, filtering all provided
             * connection groups and storing the result in
             * filteredConnectionGroups.
             */
            var updateFilteredConnectionGroups = function updateFilteredConnectionGroups() {

                // Do not apply any filtering (and do not flatten) if no
                // search string is provided
                if (!$scope.searchString) {
                    $scope.filteredConnectionGroups = $scope.connectionGroups() || {};
                    return;
                }

                // Clear all current filtered groups
                $scope.filteredConnectionGroups = {};

                // Re-filter any provided groups
                var connectionGroups = $scope.connectionGroups();
                if (connectionGroups) {
                    angular.forEach(connectionGroups, function updateFilteredConnectionGroup(connectionGroup, dataSource) {

                        var filteredGroup;

                        // Flatten and filter depending on type
                        if (connectionGroup instanceof GroupListItem) {
                            filteredGroup = flattenGroupListItem(connectionGroup);
                            filterGroupListItem(filteredGroup);
                        }
                        else {
                            filteredGroup = flattenConnectionGroup(connectionGroup);
                            filterConnectionGroup(filteredGroup);
                        }

                        // Store now-filtered root
                        $scope.filteredConnectionGroups[dataSource] = filteredGroup;

                    });
                }

            };

            // Recompile and refilter when pattern is changed
            $scope.$watch('searchString', function searchStringChanged(searchString) {
                connectionFilterPattern.compile(searchString);
                connectionGroupFilterPattern.compile(searchString);
                updateFilteredConnectionGroups();
            });

            // Refilter when items change
            $scope.$watchCollection($scope.connectionGroups, function itemsChanged() {
                updateFilteredConnectionGroups();
            });

        }]

    };
}]);
