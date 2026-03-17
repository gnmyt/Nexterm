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
 * Controller for terminal color scheme fields.
 */
angular.module('form').controller('terminalColorSchemeFieldController', ['$scope', '$injector',
    function terminalColorSchemeFieldController($scope, $injector) {

    // Required types
    var ColorScheme = $injector.get('ColorScheme');

    /**
     * The currently selected color scheme. If a pre-defined color scheme is
     * selected, this will be the connection parameter value associated with
     * that color scheme. If a custom color scheme is selected, this will be
     * the string "custom".
     *
     * @type String
     */
    $scope.selectedColorScheme = '';

    /**
     * The current custom color scheme, if a custom color scheme has been
     * specified. If no custom color scheme has yet been specified, this will
     * be a ColorScheme instance that has been initialized to the default
     * colors.
     *
     * @type ColorScheme
     */
    $scope.customColorScheme = new ColorScheme();

    /**
     * The array of colors to include within the color picker as pre-defined
     * options for convenience.
     *
     * @type String[]
     */
    $scope.defaultPalette = new ColorScheme().colors;

    /**
     * Whether the raw details of the custom color scheme should be shown. By
     * default, such details are hidden.
     *
     * @type Boolean
     */
    $scope.detailsShown = false;

    /**
     * The palette indices of all colors which are considered low-intensity.
     *
     * @type Number[]
     */
    $scope.lowIntensity = [ 0, 1, 2, 3, 4, 5, 6, 7 ];

    /**
     * The palette indices of all colors which are considered high-intensity.
     *
     * @type Number[]
     */
    $scope.highIntensity = [ 8, 9, 10, 11, 12, 13, 14, 15 ];

    /**
     * The string value which is assigned to selectedColorScheme if a custom
     * color scheme is selected.
     *
     * @constant
     * @type String
     */
    var CUSTOM_COLOR_SCHEME = 'custom';

    /**
     * Returns whether a custom color scheme has been selected.
     *
     * @returns {Boolean}
     *     true if a custom color scheme has been selected, false otherwise.
     */
    $scope.isCustom = function isCustom() {
        return $scope.selectedColorScheme === CUSTOM_COLOR_SCHEME;
    };

    /**
     * Shows the raw details of the custom color scheme. If the details are
     * already shown, this function has no effect.
     */
    $scope.showDetails = function showDetails() {
        $scope.detailsShown = true;
    };

    /**
     * Hides the raw details of the custom color scheme. If the details are
     * already hidden, this function has no effect.
     */
    $scope.hideDetails = function hideDetails() {
        $scope.detailsShown = false;
    };

    // Keep selected color scheme and custom color scheme in sync with changes
    // to model
    $scope.$watch('model', function modelChanged(model) {
        if ($scope.selectedColorScheme === CUSTOM_COLOR_SCHEME || (model && !_.includes($scope.field.options, model))) {
            $scope.customColorScheme = ColorScheme.fromString(model);
            $scope.selectedColorScheme = CUSTOM_COLOR_SCHEME;
        }
        else
            $scope.selectedColorScheme = model || '';
    });

    // Keep model in sync with changes to selected color scheme
    $scope.$watch('selectedColorScheme', function selectedColorSchemeChanged(selectedColorScheme) {
        if (!selectedColorScheme)
            $scope.model = '';
        else if (selectedColorScheme === CUSTOM_COLOR_SCHEME)
            $scope.model = ColorScheme.toString($scope.customColorScheme);
        else
            $scope.model = selectedColorScheme;
    });

    // Keep model in sync with changes to custom color scheme
    $scope.$watch('customColorScheme', function customColorSchemeChanged(customColorScheme) {
        if ($scope.selectedColorScheme === CUSTOM_COLOR_SCHEME)
            $scope.model = ColorScheme.toString(customColorScheme);
    }, true);

}]);
