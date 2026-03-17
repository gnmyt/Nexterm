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
 * A directive which provides handling of click and click-like touch events.
 * The state of Shift and Ctrl modifiers is tracked through these click events
 * to allow for specific handling of Shift+Click and Ctrl+Click.
 */
angular.module('element').directive('guacClick', [function guacClick() {

    return {
        restrict: 'A',

        link: function linkGuacClick($scope, $element, $attrs) {

            /**
             * A callback that is invoked by the guacClick directive when a
             * click or click-like event is received.
             *
             * @callback guacClick~callback
             * @param {boolean} shift
             *     Whether Shift was held down at the time the click occurred.
             *
             * @param {boolean} ctrl
             *     Whether Ctrl or Meta (the Mac "Command" key) was held down
             *     at the time the click occurred.
             */

            /**
             * The callback to invoke when a click or click-like event is
             * received on the associated element.
             *
             * @type guacClick~callback
             */
            const guacClick = $scope.$eval($attrs.guacClick);

            /**
             * The element which will register the click.
             *
             * @type Element
             */
            const element = $element[0];

            /**
             * Whether either Shift key is currently pressed.
             *
             * @type boolean
             */
            let shift = false;

            /**
             * Whether either Ctrl key is currently pressed. To allow the
             * Command key to be used on Mac platforms, this flag also
             * considers the state of either Meta key.
             *
             * @type boolean
             */
            let ctrl = false;

            /**
             * Updates the state of the {@link shift} and {@link ctrl} flags
             * based on which keys are currently marked as held down by the
             * given Guacamole.Keyboard.
             *
             * @param {Guacamole.Keyboard} keyboard
             *     The Guacamole.Keyboard instance to read key states from.
             */
            const updateModifiers = function updateModifiers(keyboard) {

                shift = !!(
                        keyboard.pressed[0xFFE1] // Left shift
                     || keyboard.pressed[0xFFE2] // Right shift
                );

                ctrl = !!(
                        keyboard.pressed[0xFFE3] // Left ctrl
                     || keyboard.pressed[0xFFE4] // Right ctrl
                     || keyboard.pressed[0xFFE7] // Left meta (command)
                     || keyboard.pressed[0xFFE8] // Right meta (command)
                );

            };

            // Update tracking of modifier states for each key press
            $scope.$on('guacKeydown', function keydownListener(event, keysym, keyboard) {
                updateModifiers(keyboard);
            });

            // Update tracking of modifier states for each key release
            $scope.$on('guacKeyup', function keyupListener(event, keysym, keyboard) {
                updateModifiers(keyboard);
            });

            // Fire provided callback for each mouse-initiated "click" event ...
            element.addEventListener('click', function elementClicked(e) {
                if (element.contains(e.target))
                    $scope.$apply(() => guacClick(shift, ctrl));
            });

            // ... and for touch-initiated click-like events
            element.addEventListener('touchstart', function elementClicked(e) {
                if (element.contains(e.target))
                    $scope.$apply(() => guacClick(shift, ctrl));
            });

        } // end guacClick link function

    };

}]);
