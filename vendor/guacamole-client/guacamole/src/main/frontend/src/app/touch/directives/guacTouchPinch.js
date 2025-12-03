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
 * A directive which allows handling of pinch gestures (pinch-to-zoom, for
 * example) on a particular element.
 */
angular.module('touch').directive('guacTouchPinch', [function guacTouchPinch() {

    return {
        restrict: 'A',

        link: function linkGuacTouchPinch($scope, $element, $attrs) {

            /**
             * Called when a pinch gesture begins, changes, or ends.
             *
             * @event
             * @param {Boolean} inProgress
             *     Whether the gesture is currently in progress. This will
             *     always be true except when the gesture has ended, at which
             *     point one final call will occur with this parameter set to
             *     false.
             *
             * @param {Number} startLength 
             *     The initial distance between the two touches of the
             *     pinch gesture, in pixels.
             *
             * @param {Number} currentLength 
             *     The current distance between the two touches of the
             *     pinch gesture, in pixels.
             *
             * @param {Number} centerX
             *     The current X coordinate of the center of the pinch gesture.
             *
             * @param {Number} centerY
             *     The current Y coordinate of the center of the pinch gesture.
             * 
             * @return {Boolean}
             *     false if the default action of the touch event should be
             *     prevented, any other value otherwise.
             */
            var guacTouchPinch = $scope.$eval($attrs.guacTouchPinch);

            /**
             * The element which will register the pinch gesture.
             *
             * @type Element
             */
            var element = $element[0];

            /**
             * The starting pinch distance, or null if the gesture has not yet
             * started.
             *
             * @type Number
             */
            var startLength = null;

            /**
             * The current pinch distance, or null if the gesture has not yet
             * started.
             *
             * @type Number
             */
            var currentLength = null;

            /**
             * The X coordinate of the current center of the pinch gesture.
             *
             * @type Number
             */
            var centerX = 0;

            /**
             * The Y coordinate of the current center of the pinch gesture.
             * @type Number
             */
            var centerY = 0;

            /**
             * Given a touch event, calculates the distance between the first
             * two touches in pixels.
             *
             * @param {TouchEvent} e
             *     The touch event to use when performing distance calculation.
             * 
             * @return {Number}
             *     The distance in pixels between the first two touches.
             */
            var pinchDistance = function pinchDistance(e) {

                var touchA = e.touches[0];
                var touchB = e.touches[1];

                var deltaX = touchA.clientX - touchB.clientX;
                var deltaY = touchA.clientY - touchB.clientY;

                return Math.sqrt(deltaX*deltaX + deltaY*deltaY);

            };

            /**
             * Given a touch event, calculates the center between the first two
             * touches in pixels, returning the X coordinate of this center.
             *
             * @param {TouchEvent} e
             *     The touch event to use when performing center calculation.
             * 
             * @return {Number}
             *     The X coordinate of the center of the first two touches.
             */
            var pinchCenterX = function pinchCenterX(e) {

                var touchA = e.touches[0];
                var touchB = e.touches[1];

                return (touchA.clientX + touchB.clientX) / 2;

            };

            /**
             * Given a touch event, calculates the center between the first two
             * touches in pixels, returning the Y coordinate of this center.
             *
             * @param {TouchEvent} e
             *     The touch event to use when performing center calculation.
             * 
             * @return {Number}
             *     The Y coordinate of the center of the first two touches.
             */
            var pinchCenterY = function pinchCenterY(e) {

                var touchA = e.touches[0];
                var touchB = e.touches[1];

                return (touchA.clientY + touchB.clientY) / 2;

            };

            // When there are exactly two touches, monitor the distance between
            // them, firing zoom events as appropriate
            element.addEventListener("touchmove", function pinchTouchMove(e) {
                if (e.touches.length === 2) {

                    // Calculate current zoom level
                    currentLength = pinchDistance(e);

                    // Calculate center
                    centerX = pinchCenterX(e);
                    centerY = pinchCenterY(e);

                    // Init start length if pinch is not in progress
                    if (!startLength)
                        startLength = currentLength;

                    // Notify of pinch status
                    if (guacTouchPinch) {
                        $scope.$apply(function pinchChanged() {
                            if (guacTouchPinch(true, startLength, currentLength, centerX, centerY) === false)
                                e.preventDefault();
                        });
                    }

                }
            }, false);

            // Reset monitoring and fire end event when done
            element.addEventListener("touchend", function pinchTouchEnd(e) {

                if (startLength && e.touches.length < 2) {

                    // Notify of pinch end
                    if (guacTouchPinch) {
                        $scope.$apply(function pinchComplete() {
                            if (guacTouchPinch(false, startLength, currentLength, centerX, centerY) === false)
                                e.preventDefault();
                        });
                    }

                    startLength = null;

                }

            }, false);

        }

    };
}]);
