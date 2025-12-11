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
 * A directive which displays the Guacamole on-screen keyboard.
 */
angular.module('osk').directive('guacOsk', [function guacOsk() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The URL for the Guacamole on-screen keyboard layout to use.
             *
             * @type String
             */
            layout : '='

        },

        templateUrl: 'app/osk/templates/guacOsk.html',
        controller: ['$scope', '$injector', '$element',
            function guacOsk($scope, $injector, $element) {

            // Required services
            var $http        = $injector.get('$http');
            var $rootScope   = $injector.get('$rootScope');
            var cacheService = $injector.get('cacheService');

            /**
             * The current on-screen keyboard, if any.
             *
             * @type Guacamole.OnScreenKeyboard
             */
            var keyboard = null;

            /**
             * The main containing element for the entire directive.
             * 
             * @type Element
             */
            var main = $element[0];

            // Size keyboard to same size as main element
            $scope.keyboardResized = function keyboardResized() {

                // Resize keyboard, if defined
                if (keyboard)
                    keyboard.resize(main.offsetWidth);

            };

            // Set layout whenever URL changes
            $scope.$watch("layout", function setLayout(url) {

                // Remove current keyboard
                if (keyboard) {
                    main.removeChild(keyboard.getElement());
                    keyboard = null;
                }

                // Load new keyboard
                if (url) {

                    // Retrieve layout JSON
                    $http({
                        cache   : cacheService.languages,
                        method  : 'GET',
                        url     : url
                    })

                    // Build OSK with retrieved layout
                    .then(function layoutRetrieved(request) {

                        var layout = request.data;

                        // Abort if the layout changed while we were waiting for a response
                        if ($scope.layout !== url)
                            return;

                        // Add OSK element
                        keyboard = new Guacamole.OnScreenKeyboard(layout);
                        main.appendChild(keyboard.getElement());

                        // Init size
                        keyboard.resize(main.offsetWidth);

                        // Broadcast keydown for each key pressed
                        keyboard.onkeydown = function(keysym) {
                            $rootScope.$broadcast('guacSyntheticKeydown', keysym);
                        };
                        
                        // Broadcast keydown for each key released 
                        keyboard.onkeyup = function(keysym) {
                            $rootScope.$broadcast('guacSyntheticKeyup', keysym);
                        };

                    }, angular.noop);

                }

            }); // end layout scope watch

        }]

    };
}]);
