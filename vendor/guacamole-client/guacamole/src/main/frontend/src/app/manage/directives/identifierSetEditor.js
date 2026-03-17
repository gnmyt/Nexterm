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
 * A directive for manipulating a set of objects sharing some common relation
 * and represented by an array of their identifiers. The specific objects
 * added or removed are tracked within a separate pair of arrays of
 * identifiers.
 */
angular.module('manage').directive('identifierSetEditor', ['$injector',
    function identifierSetEditor($injector) {

    var directive = {

        // Element only
        restrict: 'E',
        replace: true,

        scope: {

            /**
             * The translation key of the text which should be displayed within
             * the main header of the identifier set editor.
             *
             * @type String
             */
            header : '@',

            /**
             * The translation key of the text which should be displayed if no
             * identifiers are currently present within the set.
             *
             * @type String
             */
            emptyPlaceholder : '@',

            /**
             * The translation key of the text which should be displayed if no
             * identifiers are available to be added within the set.
             *
             * @type String
             */
            unavailablePlaceholder : '@',

            /**
             * All identifiers which are available to be added to or removed
             * from the identifier set being edited.
             *
             * @type String[]
             */
            identifiersAvailable : '=',

            /**
             * The current state of the identifier set being manipulated. This
             * array will be modified as changes are made through this
             * identifier set editor.
             *
             * @type String[]
             */
            identifiers : '=',

            /**
             * The set of identifiers that have been added, relative to the
             * initial state of the identifier set being manipulated.
             *
             * @type String[]
             */
            identifiersAdded : '=',

            /**
             * The set of identifiers that have been removed, relative to the
             * initial state of the identifier set being manipulated.
             *
             * @type String[]
             */
            identifiersRemoved : '='

        },

        templateUrl: 'app/manage/templates/identifierSetEditor.html'

    };

    directive.controller = ['$scope', function identifierSetEditorController($scope) {

        /**
         * Whether the full list of available identifiers should be displayed.
         * Initially, only an abbreviated list of identifiers currently present
         * is shown.
         *
         * @type Boolean
         */
        $scope.expanded = false;

        /**
         * Map of identifiers to boolean flags indicating whether that
         * identifier is currently present (true) or absent (false). If an
         * identifier is absent, it may also be absent from this map.
         *
         * @type Object.<String, Boolean>
         */
        $scope.identifierFlags = {};

        /**
         * Map of identifiers to boolean flags indicating whether that
         * identifier is editable. If an identifier is not editable, it will be
         * absent from this map.
         *
         * @type Object.<String, Boolean>
         */
        $scope.isEditable = {};

        /**
         * Adds the given identifier to the given sorted array of identifiers,
         * preserving the sorted order of the array. If the identifier is
         * already present, no change is made to the array. The given array
         * must already be sorted in ascending order.
         *
         * @param {String[]} arr
         *     The sorted array of identifiers to add the given identifier to.
         *
         * @param {String} identifier
         *     The identifier to add to the given array.
         */
        var addIdentifier = function addIdentifier(arr, identifier) {

            // Determine location that the identifier should be added to
            // maintain sorted order
            var index = _.sortedIndex(arr, identifier);

            // Do not add if already present
            if (arr[index] === identifier)
                return;

            // Insert identifier at determined location
            arr.splice(index, 0, identifier);

        };

        /**
         * Removes the given identifier from the given sorted array of
         * identifiers, preserving the sorted order of the array. If the
         * identifier is already absent, no change is made to the array. The
         * given array must already be sorted in ascending order.
         *
         * @param {String[]} arr
         *     The sorted array of identifiers to remove the given identifier
         *     from.
         *
         * @param {String} identifier
         *     The identifier to remove from the given array.
         *
         * @returns {Boolean}
         *     true if the identifier was present in the given array and has
         *     been removed, false otherwise.
         */
        var removeIdentifier = function removeIdentifier(arr, identifier) {

            // Search for identifier in sorted array
            var index = _.sortedIndexOf(arr, identifier);

            // Nothing to do if already absent
            if (index === -1)
                return false;

            // Remove identifier
            arr.splice(index, 1);
            return true;

        };

        // Keep identifierFlags up to date when identifiers array is replaced
        // or initially assigned
        $scope.$watch('identifiers', function identifiersChanged(identifiers) {

            // Maintain identifiers in sorted order so additions and removals
            // can be made more efficiently
            if (identifiers)
                identifiers.sort();

            // Convert array of identifiers into set of boolean
            // presence/absence flags
            $scope.identifierFlags = {};
            angular.forEach(identifiers, function storeIdentifierFlag(identifier) {
                $scope.identifierFlags[identifier] = true;
            });

        });

        // An identifier is editable iff it is available to be added or removed
        // from the identifier set being edited (iff it is within the
        // identifiersAvailable array)
        $scope.$watch('identifiersAvailable', function availableIdentifiersChanged(identifiers) {
            $scope.isEditable = {};
            angular.forEach(identifiers, function storeEditableIdentifier(identifier) {
                $scope.isEditable[identifier] = true;
            });
        });

        /**
         * Notifies the controller that a change has been made to the flag
         * denoting presence/absence of a particular identifier within the
         * <code>identifierFlags</code> map. The <code>identifiers</code>,
         * <code>identifiersAdded</code>, and <code>identifiersRemoved</code>
         * arrays are updated accordingly.
         *
         * @param {String} identifier
         *     The identifier which has been added or removed through modifying
         *     its boolean flag within <code>identifierFlags</code>.
         */
        $scope.identifierChanged = function identifierChanged(identifier) {

            // Determine status of modified identifier
            var present = !!$scope.identifierFlags[identifier];

            // Add/remove identifier from added/removed sets depending on
            // change in flag state
            if (present) {

                addIdentifier($scope.identifiers, identifier);

                if (!removeIdentifier($scope.identifiersRemoved, identifier))
                    addIdentifier($scope.identifiersAdded, identifier);

            }
            else {

                removeIdentifier($scope.identifiers, identifier);

                if (!removeIdentifier($scope.identifiersAdded, identifier))
                    addIdentifier($scope.identifiersRemoved, identifier);

            }

        };

        /**
         * Removes the given identifier, updating <code>identifierFlags</code>,
         * <code>identifiers</code>, <code>identifiersAdded</code>, and
         * <code>identifiersRemoved</code> accordingly.
         *
         * @param {String} identifier
         *     The identifier to remove.
         */
        $scope.removeIdentifier = function removeIdentifier(identifier) {
            $scope.identifierFlags[identifier] = false;
            $scope.identifierChanged(identifier);
        };

        /**
         * Shows the full list of available identifiers. If the full list is
         * already shown, this function has no effect.
         */
        $scope.expand = function expand() {
            $scope.expanded = true;
        };

        /**
         * Hides the full list of available identifiers. If the full list is
         * already hidden, this function has no effect.
         */
        $scope.collapse = function collapse() {
            $scope.expanded = false;
        };

        /**
         * Returns whether there are absolutely no identifiers that can be
         * managed using this editor. If true, the editor is effectively
         * useless, as there is nothing whatsoever to display.
         *
         * @returns {Boolean}
         *     true if there are no identifiers that can be managed using this
         *     editor, false otherwise.
         */
        $scope.isEmpty = function isEmpty() {
            return _.isEmpty($scope.identifiers)
                && _.isEmpty($scope.identifiersAvailable);
        };

    }];

    return directive;

}]);
