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
 * A directive which calls a given callback when its associated element is
 * resized. This will modify the internal DOM tree of the associated element,
 * and the associated element MUST have position (for example,
 * "position: relative").
 */
angular.module('element').directive('guacResize', ['$document', function guacResize($document) {

    return {
        restrict: 'A',

        link: function linkGuacResize($scope, $element, $attrs) {

            /**
             * The function to call whenever the associated element is
             * resized. The function will be passed the width and height of
             * the element, in pixels.
             *
             * @type Function 
             */
            var guacResize = $scope.$eval($attrs.guacResize);

            /**
             * The element which will monitored for size changes.
             *
             * @type Element
             */
            var element = $element[0];

            /**
             * The resize sensor - an HTML object element.
             *
             * @type HTMLObjectElement
             */
            var resizeSensor = $document[0].createElement('object');

            /**
             * The width of the associated element, in pixels.
             *
             * @type Number
             */
            var lastWidth = element.offsetWidth;

            /**
             * The height of the associated element, in pixels.
             *
             * @type Number
             */
            var lastHeight = element.offsetHeight;

            /**
             * Checks whether the size of the associated element has changed
             * and, if so, calls the resize callback with the new width and
             * height as parameters.
             */
            var checkSize = function checkSize() {

                // Call callback only if size actually changed
                if (element.offsetWidth !== lastWidth
                 || element.offsetHeight !== lastHeight) {

                    // Call resize callback, if defined
                    if (guacResize) {
                        $scope.$evalAsync(function elementSizeChanged() {
                            guacResize(element.offsetWidth, element.offsetHeight);
                        });
                    }

                    // Update stored size
                    lastWidth  = element.offsetWidth;
                    lastHeight = element.offsetHeight;

                 }

            };

            // Register event listener once window object exists
            resizeSensor.onload = function resizeSensorReady() {
                resizeSensor.contentDocument.defaultView.addEventListener('resize', checkSize);
                checkSize();
            };

            // Load blank contents
            resizeSensor.className = 'resize-sensor';
            resizeSensor.type      = 'text/html';
            resizeSensor.data      = 'app/element/templates/blank.html';

            // Add resize sensor to associated element
            element.insertBefore(resizeSensor, element.firstChild);

        } // end guacResize link function

    };

}]);
