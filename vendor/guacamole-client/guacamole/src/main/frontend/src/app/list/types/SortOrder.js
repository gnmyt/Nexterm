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
 * A service for defining the SortOrder class.
 */
angular.module('list').factory('SortOrder', [
    function defineSortOrder() {

    /**
     * Maintains a sorting predicate as required by the Angular orderBy filter.
     * The order of properties sorted by the predicate can be altered while
     * otherwise maintaining the sort order.
     *
     * @constructor
     * @param {String[]} predicate
     *     The properties to sort by, in order of precidence.
     */
    var SortOrder = function SortOrder(predicate) {

        /**
         * Reference to this instance.
         *
         * @type SortOrder
         */
        var sortOrder = this;

        /**
         * The current sorting predicate.
         *
         * @type String[]
         */
        this.predicate = predicate;

        /**
         * The name of the highest-precedence sorting property.
         *
         * @type String
         */
        this.primary = predicate[0];

        /**
         * Whether the highest-precedence sorting property is sorted in
         * descending order.
         *
         * @type Boolean
         */
        this.descending = false;

        // Handle initially-descending primary properties
        if (this.primary.charAt(0) === '-') {
            this.primary = this.primary.substring(1);
            this.descending = true;
        }

        /**
         * Reorders the currently-defined predicate such that the named
         * property takes precidence over all others. The property will be
         * sorted in ascending order unless otherwise specified.
         *
         * @param {String} name
         *     The name of the property to reorder by.
         *
         * @param {Boolean} [descending=false]
         *     Whether the property should be sorted in descending order. By
         *     default, all properties are sorted in ascending order.
         */
        this.reorder = function reorder(name, descending) {

            // Build ascending and descending predicate components
            var ascendingName  = name;
            var descendingName = '-' + name;

            // Remove requested property from current predicate
            sortOrder.predicate = sortOrder.predicate.filter(function notRequestedProperty(current) {
                return current !== ascendingName
                    && current !== descendingName;
            });

            // Add property to beginning of predicate
            if (descending)
                sortOrder.predicate.unshift(descendingName);
            else
                sortOrder.predicate.unshift(ascendingName);

            // Update sorted state
            sortOrder.primary    = name;
            sortOrder.descending = !!descending;

        };

        /**
         * Returns whether the sort order is primarily determined by the given
         * property.
         *
         * @param {String} property
         *     The name of the property to check.
         *
         * @returns {Boolean}
         *     true if the sort order is primarily determined by the given
         *     property, false otherwise.
         */
        this.isSortedBy = function isSortedBy(property) {
            return sortOrder.primary === property;
        };

        /**
         * Sets the primary sorting property to the given property, if not already
         * set. If already set, the ascending/descending sort order is toggled.
         *
         * @param {String} property
         *     The name of the property to assign as the primary sorting property.
         */
        this.togglePrimary = function togglePrimary(property) {

            // Sort in ascending order by new property, if different
            if (!sortOrder.isSortedBy(property))
                sortOrder.reorder(property, false);

            // Otherwise, toggle sort order
            else
                sortOrder.reorder(property, !sortOrder.descending);

        };

    };

    return SortOrder;

}]);