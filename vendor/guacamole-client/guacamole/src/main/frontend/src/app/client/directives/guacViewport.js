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
 * A directive which provides a fullscreen environment for its content.
 */
angular.module('client').directive('guacViewport', [function guacViewport() {

    return {
        // Element only
        restrict: 'E',
        scope: {},
        transclude: true,
        templateUrl: 'app/client/templates/guacViewport.html',
        controller: ['$scope', '$injector', '$element',
            function guacViewportController($scope, $injector, $element) {

            // Required services
            var $window = $injector.get('$window');

            /**
             * The fullscreen container element.
             *
             * @type Element
             */
            var element = $element.find('.viewport')[0];

            /**
             * The width of the browser viewport when fitVisibleArea() was last
             * invoked, in pixels, or null if fitVisibleArea() has not yet been
             * called.
             *
             * @type Number
             */
            var lastViewportWidth = null;

            /**
             * The height of the browser viewport when fitVisibleArea() was
             * last invoked, in pixels, or null if fitVisibleArea() has not yet
             * been called.
             *
             * @type Number
             */
            var lastViewportHeight = null;

            /**
             * Resizes the container element inside the guacViewport such that
             * it exactly fits within the visible area, even if the browser has
             * been scrolled.
             */
            var fitVisibleArea = function fitVisibleArea() {

                // Calculate viewport dimensions (this is NOT necessarily the
                // same as 100vw and 100vh, 100%, etc., particularly when the
                // on-screen keyboard of a mobile device pops open)
                var viewportWidth = $window.innerWidth;
                var viewportHeight = $window.innerHeight;

                // Adjust element width to fit exactly within visible area
                if (viewportWidth !== lastViewportWidth) {
                    element.style.width = viewportWidth + 'px';
                    lastViewportWidth = viewportWidth;
                }

                // Adjust element height to fit exactly within visible area
                if (viewportHeight !== lastViewportHeight) {
                    element.style.height = viewportHeight + 'px';
                    lastViewportHeight = viewportHeight;
                }

                // Scroll element such that its upper-left corner is exactly
                // within the viewport upper-left corner, if not already there
                if (element.scrollLeft || element.scrollTop) {
                    $window.scrollTo(
                        $window.pageXOffset + element.scrollLeft,
                        $window.pageYOffset + element.scrollTop
                    );
                }

            };

            // Fit container within visible region when window scrolls
            $window.addEventListener('scroll', fitVisibleArea);

            // Poll every 10ms, in case scroll event does not fire
            var pollArea = $window.setInterval(fitVisibleArea, 10);

            // Clean up on destruction
            $scope.$on('$destroy', function destroyViewport() {
                $window.removeEventListener('scroll', fitVisibleArea);
                $window.clearInterval(pollArea);
            });

        }]
    };
}]);
