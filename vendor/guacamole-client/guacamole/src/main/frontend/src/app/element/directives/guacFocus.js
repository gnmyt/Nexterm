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
 * A directive which allows elements to be manually focused / blurred.
 */
angular.module('element').directive('guacFocus', ['$injector', function guacFocus($injector) {

    // Required services
    var $parse   = $injector.get('$parse');
    var $timeout = $injector.get('$timeout');

    return {
        restrict: 'A',

        link: function linkGuacFocus($scope, $element, $attrs) {

            /**
             * Whether the element associated with this directive should be
             * focussed.
             *
             * @type Boolean
             */
            var guacFocus = $parse($attrs.guacFocus);

            /**
             * The element which will be focused / blurred.
             *
             * @type Element
             */
            var element = $element[0];

            // Set/unset focus depending on value of guacFocus
            $scope.$watch(guacFocus, function updateFocus(value) {
                $timeout(function updateFocusAfterRender() {
                    if (value)
                        element.focus();
                    else
                        element.blur();
                });
            });

        } // end guacFocus link function

    };

}]);
