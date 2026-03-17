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
 * produces a filtered subset of the elements of some given array.
 */
angular.module('list').directive('guacFilter', [function guacFilter() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The property to which a subset of the provided array will be
             * assigned.
             *
             * @type Array
             */
            filteredItems : '=',

            /**
             * The placeholder text to display within the filter input field
             * when no filter has been provided.
             * 
             * @type String
             */
            placeholder : '&',

            /**
             * An array of objects to filter. A subset of this array will be
             * exposed as filteredItems.
             *
             * @type Array
             */
            items : '&',

            /**
             * An array of expressions to filter against for each object in the
             * items array. These expressions must be Angular expressions
             * which resolve to properties on the objects in the items array.
             *
             * @type String[]
             */
            properties : '&'

        },

        templateUrl: 'app/list/templates/guacFilter.html',
        controller: ['$scope', '$injector', function guacFilterController($scope, $injector) {

            // Required types
            var FilterPattern = $injector.get('FilterPattern');

            /**
             * The pattern object to use when filtering items.
             *
             * @type FilterPattern
             */
            var filterPattern = new FilterPattern($scope.properties());

            /**
             * The filter search string to use to restrict the displayed items.
             *
             * @type String
             */
            $scope.searchString = null;

            /**
             * Applies the current filter predicate, filtering all provided
             * items and storing the result in filteredItems.
             */
            var updateFilteredItems = function updateFilteredItems() {

                var items = $scope.items();
                if (items)
                    $scope.filteredItems = items.filter(filterPattern.predicate);
                else
                    $scope.filteredItems = [];

            };

            // Recompile and refilter when pattern is changed
            $scope.$watch('searchString', function searchStringChanged(searchString) {
                filterPattern.compile(searchString);
                updateFilteredItems();
            });

            // Refilter when items change
            $scope.$watchCollection($scope.items, function itemsChanged() {
                updateFilteredItems();
            });

        }]

    };
}]);
