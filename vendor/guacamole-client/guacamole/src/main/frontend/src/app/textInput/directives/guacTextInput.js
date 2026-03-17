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
 * A directive which displays the Guacamole text input method.
 */
angular.module('textInput').directive('guacTextInput', [function guacTextInput() {

    return {
        restrict: 'E',
        replace: true,
        scope: {},

        templateUrl: 'app/textInput/templates/guacTextInput.html',
        controller: ['$scope', '$rootScope', '$element', '$timeout',
            function guacTextInput($scope, $rootScope, $element, $timeout) {

            /**
             * The number of characters to include on either side of text input
             * content, to allow the user room to use backspace and delete.
             *
             * @type Number
             */
            var TEXT_INPUT_PADDING = 4;

            /**
             * The Unicode codepoint of the character to use for padding on
             * either side of text input content.
             *
             * @type Number
             */
            var TEXT_INPUT_PADDING_CODEPOINT = 0x200B;

            /**
             * Keys which should be allowed through to the client when in text
             * input mode, providing corresponding key events are received.
             * Keys in this set will be allowed through to the server.
             * 
             * @type Object.<Number, Boolean>
             */
            var ALLOWED_KEYS = {
                0xFE03: true, /* AltGr */
                0xFF08: true, /* Backspace */
                0xFF09: true, /* Tab */
                0xFF0D: true, /* Enter */
                0xFF1B: true, /* Escape */
                0xFF50: true, /* Home */
                0xFF51: true, /* Left */
                0xFF52: true, /* Up */
                0xFF53: true, /* Right */
                0xFF54: true, /* Down */
                0xFF57: true, /* End */
                0xFF64: true, /* Insert */
                0xFFBE: true, /* F1 */
                0xFFBF: true, /* F2 */
                0xFFC0: true, /* F3 */
                0xFFC1: true, /* F4 */
                0xFFC2: true, /* F5 */
                0xFFC3: true, /* F6 */
                0xFFC4: true, /* F7 */
                0xFFC5: true, /* F8 */
                0xFFC6: true, /* F9 */
                0xFFC7: true, /* F10 */
                0xFFC8: true, /* F11 */
                0xFFC9: true, /* F12 */
                0xFFE1: true, /* Left shift */
                0xFFE2: true, /* Right shift */
                0xFFE3: true, /* Left ctrl */
                0xFFE4: true, /* Right ctrl */
                0xFFE9: true, /* Left alt */
                0xFFEA: true, /* Right alt */
                0xFFFF: true  /* Delete */
            };

            /**
             * Recently-sent text, ordered from oldest to most recent.
             *
             * @type String[]
             */
            $scope.sentText = [];

            /**
             * Whether the "Alt" key is currently pressed within the text input
             * interface.
             * 
             * @type Boolean
             */
            $scope.altPressed = false;

            /**
             * Whether the "Ctrl" key is currently pressed within the text
             * input interface.
             * 
             * @type Boolean
             */
            $scope.ctrlPressed = false;

            /**
             * The text area input target.
             *
             * @type Element
             */
            var target = $element.find('.target')[0];

            /**
             * Whether the text input target currently has focus. Setting this
             * attribute has no effect, but any bound property will be updated
             * as focus is gained or lost.
             *
             * @type Boolean
             */
            var hasFocus = false;

            target.onfocus = function targetFocusGained() {
                hasFocus = true;
                resetTextInputTarget(TEXT_INPUT_PADDING);
            };

            target.onblur = function targetFocusLost() {
                hasFocus = false;
            };

            /**
             * Whether composition is currently active within the text input
             * target element, such as when an IME is in use.
             *
             * @type Boolean
             */
            var composingText = false;

            target.addEventListener("compositionstart", function targetComposeStart(e) {
                composingText = true;
            }, false);

            target.addEventListener("compositionend", function targetComposeEnd(e) {
                composingText = false;
            }, false);

            /**
             * Translates a given Unicode codepoint into the corresponding X11
             * keysym.
             * 
             * @param {Number} codepoint
             *     The Unicode codepoint to translate.
             *
             * @returns {Number}
             *     The X11 keysym that corresponds to the given Unicode
             *     codepoint, or null if no such keysym exists.
             */
            var keysymFromCodepoint = function keysymFromCodepoint(codepoint) {

                // Keysyms for control characters
                if (codepoint <= 0x1F || (codepoint >= 0x7F && codepoint <= 0x9F))
                    return 0xFF00 | codepoint;

                // Keysyms for ASCII chars
                if (codepoint >= 0x0000 && codepoint <= 0x00FF)
                    return codepoint;

                // Keysyms for Unicode
                if (codepoint >= 0x0100 && codepoint <= 0x10FFFF)
                    return 0x01000000 | codepoint;

                return null;

            };

            /**
             * Presses and releases the key corresponding to the given keysym,
             * as if typed by the user.
             * 
             * @param {Number} keysym The keysym of the key to send.
             */
            var sendKeysym = function sendKeysym(keysym) {
                $rootScope.$broadcast('guacSyntheticKeydown', keysym);
                $rootScope.$broadcast('guacSyntheticKeyup', keysym);
            };

            /**
             * Presses and releases the key having the keysym corresponding to
             * the Unicode codepoint given, as if typed by the user.
             * 
             * @param {Number} codepoint
             *     The Unicode codepoint of the key to send.
             */
            var sendCodepoint = function sendCodepoint(codepoint) {

                if (codepoint === 10) {
                    sendKeysym(0xFF0D);
                    releaseStickyKeys();
                    return;
                }

                var keysym = keysymFromCodepoint(codepoint);
                if (keysym) {
                    sendKeysym(keysym);
                    releaseStickyKeys();
                }

            };

            /**
             * Translates each character within the given string to keysyms and
             * sends each, in order, as if typed by the user.
             * 
             * @param {String} content
             *     The string to send.
             */
            var sendString = function sendString(content) {

                var sentText = "";

                // Send each codepoint within the string
                for (var i=0; i<content.length; i++) {
                    var codepoint = content.charCodeAt(i);
                    if (codepoint !== TEXT_INPUT_PADDING_CODEPOINT) {
                        sentText += String.fromCharCode(codepoint);
                        sendCodepoint(codepoint);
                    }
                }

                // Display the text that was sent
                $scope.$apply(function addSentText() {
                    $scope.sentText.push(sentText);
                });

                // Remove text after one second
                $timeout(function removeSentText() {
                    $scope.sentText.shift();
                }, 1000);

            };

            /**
             * Releases all currently-held sticky keys within the text input UI.
             */
            var releaseStickyKeys = function releaseStickyKeys() {

                // Reset all sticky keys
                $scope.$apply(function clearAllStickyKeys() {
                    $scope.altPressed = false;
                    $scope.ctrlPressed = false;
                });

            };

            /**
             * Removes all content from the text input target, replacing it
             * with the given number of padding characters. Padding of the
             * requested size is added on both sides of the cursor, thus the
             * overall number of characters added will be twice the number
             * specified.
             * 
             * @param {Number} padding
             *     The number of characters to pad the text area with.
             */
            var resetTextInputTarget = function resetTextInputTarget(padding) {

                var paddingChar = String.fromCharCode(TEXT_INPUT_PADDING_CODEPOINT);

                // Pad text area with an arbitrary, non-typable character (so there is something
                // to delete with backspace or del), and position cursor in middle.
                target.value = new Array(padding*2 + 1).join(paddingChar);
                target.setSelectionRange(padding, padding);

            };

            target.addEventListener("input", function(e) {

                // Ignore input events during text composition
                if (composingText)
                    return;

                var i;
                var content = target.value;
                var expectedLength = TEXT_INPUT_PADDING*2;

                // If content removed, update
                if (content.length < expectedLength) {

                    // Calculate number of backspaces and send
                    var backspaceCount = TEXT_INPUT_PADDING - target.selectionStart;
                    for (i = 0; i < backspaceCount; i++)
                        sendKeysym(0xFF08);

                    // Calculate number of deletes and send
                    var deleteCount = expectedLength - content.length - backspaceCount;
                    for (i = 0; i < deleteCount; i++)
                        sendKeysym(0xFFFF);

                }

                else
                    sendString(content);

                // Reset content
                resetTextInputTarget(TEXT_INPUT_PADDING);
                e.preventDefault();

            }, false);

            // Do not allow event target contents to be selected during input
            target.addEventListener("selectstart", function(e) {
                e.preventDefault();
            }, false);

            // If the text input UI has focus, prevent keydown events
            $scope.$on('guacBeforeKeydown', function filterKeydown(event, keysym) {
                if (hasFocus && !ALLOWED_KEYS[keysym])
                    event.preventDefault();
            });

            // If the text input UI has focus, prevent keyup events
            $scope.$on('guacBeforeKeyup', function filterKeyup(event, keysym) {
                if (hasFocus && !ALLOWED_KEYS[keysym])
                    event.preventDefault();
            });

            // Attempt to focus initially
            target.focus();

        }]

    };
}]);
