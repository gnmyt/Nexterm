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
 * A directive which allows elements to be manually scrolled, and for their
 * scroll state to be observed.
 */
angular.module('element').directive('guacScroll', [function guacScroll() {

    return {
        restrict: 'A',

        link: function linkGuacScroll($scope, $element, $attrs) {

            /**
             * The current scroll state of the element.
             *
             * @type ScrollState
             */
            var guacScroll = $scope.$eval($attrs.guacScroll);

            /**
             * The element which is being scrolled, or monitored for changes
             * in scroll.
             *
             * @type Element
             */
            var element = $element[0];

            /**
             * Returns the current left edge of the scrolling rectangle.
             *
             * @returns {Number}
             *     The current left edge of the scrolling rectangle.
             */
            var getScrollLeft = function getScrollLeft() {
                return guacScroll.left;
            };

            /**
             * Returns the current top edge of the scrolling rectangle.
             *
             * @returns {Number}
             *     The current top edge of the scrolling rectangle.
             */
            var getScrollTop = function getScrollTop() {
                return guacScroll.top;
            };

            // Update underlying scrollLeft property when left changes
            $scope.$watch(getScrollLeft, function scrollLeftChanged(left) {
                element.scrollLeft = left;
                guacScroll.left = element.scrollLeft;
            });

            // Update underlying scrollTop property when top changes
            $scope.$watch(getScrollTop, function scrollTopChanged(top) {
                element.scrollTop = top;
                guacScroll.top = element.scrollTop;
            });

        } // end guacScroll link function

    };

}]);
