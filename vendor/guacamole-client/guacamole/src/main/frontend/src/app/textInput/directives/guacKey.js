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
 * A directive which displays a button that controls the pressed state of a
 * single keyboard key.
 */
angular.module('textInput').directive('guacKey', [function guacKey() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The text to display within the key. This will be run through the
             * translation filter prior to display.
             * 
             * @type String
             */
            text    : '=',

            /**
             * The keysym to send within keyup and keydown events when this key
             * is pressed or released.
             * 
             * @type Number
             */
            keysym  : '=',

            /**
             * Whether this key is sticky. Sticky keys toggle their pressed
             * state with each click.
             * 
             * @type Boolean
             * @default false
             */
            sticky  : '=?',

            /**
             * Whether this key is currently pressed.
             * 
             * @type Boolean
             * @default false
             */
            pressed : '=?'

        },

        templateUrl: 'app/textInput/templates/guacKey.html',
        controller: ['$scope', '$rootScope',
            function guacKey($scope, $rootScope) {

            // Not sticky by default
            $scope.sticky = $scope.sticky || false;

            // Unpressed by default
            $scope.pressed = $scope.pressed || false;

            /**
             * Presses and releases this key, sending the corresponding keydown
             * and keyup events. In the case of sticky keys, the pressed state
             * is toggled, and only a single keydown/keyup event will be sent,
             * depending on the current state.
             *
             * @param {MouseEvent} event
             *     The mouse event which resulted in this function being
             *     invoked.
             */
            $scope.updateKey = function updateKey(event) {

                // If sticky, toggle pressed state
                if ($scope.sticky)
                    $scope.pressed = !$scope.pressed;

                // For all non-sticky keys, press and release key immediately
                else {
                    $rootScope.$broadcast('guacSyntheticKeydown', $scope.keysym);
                    $rootScope.$broadcast('guacSyntheticKeyup', $scope.keysym);
                }

                // Prevent loss of focus due to interaction with buttons
                event.preventDefault();

            };

            // Send keyup/keydown when pressed state is altered
            $scope.$watch('pressed', function updatePressedState(isPressed, wasPressed) {

                // If the key is pressed now, send keydown
                if (isPressed)
                    $rootScope.$broadcast('guacSyntheticKeydown', $scope.keysym);

                // If the key was pressed, but is not pressed any longer, send keyup
                else if (wasPressed)
                    $rootScope.$broadcast('guacSyntheticKeyup', $scope.keysym);

            });

        }]

    };
}]);
