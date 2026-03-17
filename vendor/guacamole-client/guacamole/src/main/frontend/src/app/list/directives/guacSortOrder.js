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
 * Updates the priority of the sorting property given by "guac-sort-property"
 * within the SortOrder object given by "guac-sort-order". The CSS classes
 * "sort-primary" and "sort-descending" will be applied to the associated
 * element depending on the priority and sort direction of the given property.
 * 
 * The associated element will automatically be assigned the "sortable" CSS
 * class.
 */
angular.module('list').directive('guacSortOrder', [function guacFocus() {

    return {
        restrict: 'A',

        link: function linkGuacSortOrder($scope, $element, $attrs) {

            /**
             * The object defining the sorting order.
             *
             * @type SortOrder
             */
            var sortOrder = $scope.$eval($attrs.guacSortOrder);

            /**
             * The name of the property whose priority within the sort order
             * is controlled by this directive.
             *
             * @type String
             */
            var sortProperty = $scope.$eval($attrs.guacSortProperty);

            /**
             * Returns whether the sort property defined via the
             * "guac-sort-property" attribute is the primary sort property of
             * the associated sort order.
             *
             * @returns {Boolean}
             *     true if the sort property defined via the
             *     "guac-sort-property" attribute is the primary sort property,
             *     false otherwise.
             */
            var isPrimary = function isPrimary() {
                return sortOrder.primary === sortProperty;
            };

            /**
             * Returns whether the primary property of the sort order is
             * sorted in descending order.
             *
             * @returns {Boolean}
             *     true if the primary property of the sort order is sorted in
             *     descending order, false otherwise.
             */
            var isDescending = function isDescending() {
                return sortOrder.descending;
            };

            // Assign "sortable" class to associated element
            $element.addClass('sortable');

            // Add/remove "sort-primary" class depending on sort order
            $scope.$watch(isPrimary, function primaryChanged(primary) {
                $element.toggleClass('sort-primary', primary);
            });

            // Add/remove "sort-descending" class depending on sort order
            $scope.$watch(isDescending, function descendingChanged(descending) {
                $element.toggleClass('sort-descending', descending);
            });

            // Update sort order when clicked
            $element[0].addEventListener('click', function clicked() {
                $scope.$evalAsync(function updateSortOrder() {
                    sortOrder.togglePrimary(sortProperty);
                });
            });

        } // end guacSortOrder link function

    };

}]);
