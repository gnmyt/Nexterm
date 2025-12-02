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
 * A directive which stores a marker which refers to a specific element,
 * allowing that element to be scrolled into view when desired.
 */
angular.module('element').directive('guacMarker', ['$injector', function guacMarker($injector) {

    // Required types
    var Marker = $injector.get('Marker');

    // Required services
    var $parse = $injector.get('$parse');

    return {
        restrict: 'A',

        link: function linkGuacMarker($scope, $element, $attrs) {

            /**
             * The property in which a new Marker should be stored. The new
             * Marker will refer to the element associated with this directive.
             *
             * @type Marker
             */
            var guacMarker = $parse($attrs.guacMarker);

            /**
             * The element to associate with the new Marker.
             *
             * @type Element
             */
            var element = $element[0];

            // Assign new marker
            guacMarker.assign($scope, new Marker(element));

        }

    };

}]);
