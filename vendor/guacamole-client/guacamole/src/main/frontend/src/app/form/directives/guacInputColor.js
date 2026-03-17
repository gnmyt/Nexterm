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
 * A directive which implements a color input field. If the underlying color
 * picker implementation cannot be used due to a lack of browser support, this
 * directive will become read-only, functioning essentially as a color preview.
 *
 * @see colorPickerService
 */
angular.module('form').directive('guacInputColor', [function guacInputColor() {

    var config = {
        restrict: 'E',
        replace: true,
        templateUrl: 'app/form/templates/guacInputColor.html',
        transclude: true
    };

    config.scope = {

        /**
         * The current selected color value, in standard 6-digit hexadecimal
         * RGB notation. When the user selects a different color using this
         * directive, this value will updated accordingly.
         *
         * @type String
         */
        model: '=',

        /**
         * An optional array of colors to include within the color picker as a
         * convenient selection of pre-defined colors. The colors within the
         * array must be in standard 6-digit hexadecimal RGB notation.
         *
         * @type String[]
         */
        palette: '='

    };

    config.controller = ['$scope', '$element', '$injector',
        function guacInputColorController($scope, $element, $injector) {

        // Required services
        var colorPickerService = $injector.get('colorPickerService');

        /**
         * @borrows colorPickerService.isAvailable()
         */
        $scope.isColorPickerAvailable = colorPickerService.isAvailable;

        /**
         * Returns whether the color currently selected is "dark" in the sense
         * that the color white will have higher contrast against it than the
         * color black.
         *
         * @returns {Boolean}
         *     true if the currently selected color is relatively dark (white
         *     text would provide better contrast than black), false otherwise.
         */
        $scope.isDark = function isDark() {

            // Assume not dark if color is invalid or undefined
            var rgb = $scope.model && /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec($scope.model);
            if (!rgb)
                return false;

            // Parse color component values as hexadecimal
            var red = parseInt(rgb[1], 16);
            var green = parseInt(rgb[2], 16);
            var blue = parseInt(rgb[3], 16);

            // Convert RGB to luminance in HSL space (as defined by the
            // relative luminance formula given by the W3C for accessibility)
            var luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

            // Consider the background to be dark if white text over that
            // background would provide better contrast than black
            return luminance <= 153; // 153 is the component value 0.6 converted from 0-1 to the 0-255 range

        };

        /**
         * Prompts the user to choose a color by displaying a color selection
         * dialog. If the user chooses a color, this directive's model is
         * automatically updated. If the user cancels the dialog, the model is
         * left untouched.
         */
        $scope.selectColor = function selectColor() {
            colorPickerService.selectColor($element[0], $scope.model, $scope.palette)
            .then(function colorSelected(color) {
                $scope.model = color;
            }, angular.noop);
        };

    }];

    return config;

}]);
