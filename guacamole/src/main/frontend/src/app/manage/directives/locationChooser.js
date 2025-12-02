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
 * A directive for choosing the location of a connection or connection group.
 */
angular.module('manage').directive('locationChooser', [function locationChooser() {
    
    return {
        // Element only
        restrict: 'E',
        replace: true,

        scope: {

            /**
             * The identifier of the data source from which the given root
             * connection group was retrieved.
             *
             * @type String
             */
            dataSource : '=',

            /**
             * The root connection group of the connection group hierarchy to
             * display.
             *
             * @type ConnectionGroup
             */
            rootGroup : '=',

            /**
             * The unique identifier of the currently-selected connection
             * group. If not specified, the root group will be used.
             *
             * @type String
             */
            value : '='

        },

        templateUrl: 'app/manage/templates/locationChooser.html',
        controller: ['$scope', function locationChooserController($scope) {

            /**
             * Map of unique identifiers to their corresponding connection
             * groups.
             *
             * @type Object.<String, GroupListItem>
             */
            var connectionGroups = {};

            /**
             * Recursively traverses the given connection group and all
             * children, storing each encountered connection group within the
             * connectionGroups map by its identifier.
             *
             * @param {GroupListItem} group
             *     The connection group to traverse.
             */
            var mapConnectionGroups = function mapConnectionGroups(group) {

                // Map given group
                connectionGroups[group.identifier] = group;

                // Map all child groups
                if (group.childConnectionGroups)
                    group.childConnectionGroups.forEach(mapConnectionGroups);

            };

            /**
             * Whether the group list menu is currently open.
             * 
             * @type Boolean
             */
            $scope.menuOpen = false;
            
            /**
             * The human-readable name of the currently-chosen connection
             * group.
             * 
             * @type String
             */
            $scope.chosenConnectionGroupName = null;
            
            /**
             * Toggle the current state of the menu listing connection groups.
             * If the menu is currently open, it will be closed. If currently
             * closed, it will be opened.
             */
            $scope.toggleMenu = function toggleMenu() {
                $scope.menuOpen = !$scope.menuOpen;
            };

            // Update the root group map when data source or root group change
            $scope.$watchGroup(['dataSource', 'rootGroup'], function updateRootGroups() {

                // Abort if the root group is not set
                if (!$scope.dataSource || !$scope.rootGroup)
                    return null;

                // Wrap root group in map
                $scope.rootGroups = {};
                $scope.rootGroups[$scope.dataSource] = $scope.rootGroup;

            });

            // Expose selection function to group list template
            $scope.groupListContext = {
                
                /**
                 * Selects the given group item.
                 *
                 * @param {GroupListItem} item
                 *     The chosen item.
                 */
                chooseGroup : function chooseGroup(item) {

                    // Record new parent
                    $scope.value = item.identifier;
                    $scope.chosenConnectionGroupName = item.name;

                    // Close menu
                    $scope.menuOpen = false;

                }

            };

            $scope.$watch('rootGroup', function setRootGroup(rootGroup) {

                connectionGroups = {};

                if (!rootGroup)
                    return;

                // Map all known groups
                mapConnectionGroups(rootGroup);

                // If no value is specified, default to the root identifier
                if (!$scope.value || !($scope.value in connectionGroups))
                    $scope.value = rootGroup.identifier;

                $scope.chosenConnectionGroupName = connectionGroups[$scope.value].name; 

            });

        }]
    };
    
}]);