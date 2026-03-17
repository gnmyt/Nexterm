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
 * A directive which allows handling of drag gestures on a particular element.
 */
angular.module('touch').directive('guacTouchDrag', [function guacTouchDrag() {

    return {
        restrict: 'A',

        link: function linkGuacTouchDrag($scope, $element, $attrs) {

            /**
             * Called during a drag gesture as the user's finger is placed upon
             * the element, moves, and is lifted from the element.
             *
             * @event
             * @param {Boolean} inProgress
             *     Whether the gesture is currently in progress. This will
             *     always be true except when the gesture has ended, at which
             *     point one final call will occur with this parameter set to
             *     false.
             *
             * @param {Number} startX
             *     The X location at which the drag gesture began.
             *     
             * @param {Number} startY
             *     The Y location at which the drag gesture began.
             *     
             * @param {Number} currentX
             *     The current X location of the user's finger.
             *     
             * @param {Number} currentY
             *     The current Y location of the user's finger.
             *     
             * @param {Number} deltaX
             *     The difference in X location relative to the start of the
             *     gesture.
             * 
             * @param {Number} deltaY
             *     The difference in Y location relative to the start of the
             *     gesture.
             * 
             * @return {Boolean}
             *     false if the default action of the touch event should be
             *     prevented, any other value otherwise.
             */
            var guacTouchDrag = $scope.$eval($attrs.guacTouchDrag);

            /**
             * The element which will register the drag gesture.
             *
             * @type Element
             */
            var element = $element[0];

            /**
             * Whether a drag gesture is in progress.
             * 
             * @type Boolean
             */
            var inProgress = false;
            
            /**
             * The starting X location of the drag gesture.
             * 
             * @type Number
             */
            var startX = null;

            /**
             * The starting Y location of the drag gesture.
             * 
             * @type Number
             */
            var startY = null;

            /**
             * The current X location of the drag gesture.
             * 
             * @type Number
             */
            var currentX = null;

            /**
             * The current Y location of the drag gesture.
             * 
             * @type Number
             */
            var currentY = null;

            /**
             * The change in X relative to drag start.
             * 
             * @type Number
             */
            var deltaX = 0;

            /**
             * The change in X relative to drag start.
             * 
             * @type Number
             */
            var deltaY = 0;

            // When there is exactly one touch, monitor the change in location
            element.addEventListener("touchmove", function dragTouchMove(e) {
                if (e.touches.length === 1) {

                    // Get touch location
                    var x = e.touches[0].clientX;
                    var y = e.touches[0].clientY;

                    // Init start location and deltas if gesture is starting
                    if (!startX || !startY) {
                        startX = currentX = x;
                        startY = currentY = y;
                        deltaX = 0;
                        deltaY = 0;
                        inProgress = true;
                    }

                    // Update deltas if gesture is in progress
                    else if (inProgress) {
                        deltaX = x - currentX;
                        deltaY = y - currentY;
                        currentX = x;
                        currentY = y;
                    }

                    // Signal start/change in drag gesture
                    if (inProgress && guacTouchDrag) {
                        $scope.$apply(function dragChanged() {
                            if (guacTouchDrag(true, startX, startY, currentX, currentY, deltaX, deltaY) === false)
                                e.preventDefault();
                        });
                    }

                }
            }, false);

            // Reset monitoring and fire end event when done
            element.addEventListener("touchend", function dragTouchEnd(e) {

                if (startX && startY && e.touches.length === 0) {

                    // Signal end of drag gesture
                    if (inProgress && guacTouchDrag) {
                        $scope.$apply(function dragComplete() {
                            if (guacTouchDrag(true, startX, startY, currentX, currentY, deltaX, deltaY) === false)
                                e.preventDefault();
                        });
                    }

                    startX = currentX = null;
                    startY = currentY = null;
                    deltaX = 0;
                    deltaY = 0;
                    inProgress = false;

                }

            }, false);

        }

    };
}]);
