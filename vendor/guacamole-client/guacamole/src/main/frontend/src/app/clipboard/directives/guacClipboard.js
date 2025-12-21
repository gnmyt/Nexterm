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
 * A directive provides an editor for the clipboard content maintained by
 * clipboardService. Changes to the clipboard by clipboardService will
 * automatically be reflected in the editor, and changes in the editor will
 * automatically be reflected in the clipboard by clipboardService.
 */
angular.module('clipboard').directive('guacClipboard', ['$injector',
    function guacClipboard($injector) {

    // Required types
    const ClipboardData = $injector.get('ClipboardData');

    // Required services
    const $window          = $injector.get('$window');
    const clipboardService = $injector.get('clipboardService');

    /**
     * Configuration object for the guacClipboard directive.
     *
     * @type Object.<String, Object>
     */
    var config = {
        restrict    : 'E',
        replace     : true,
        templateUrl : 'app/clipboard/templates/guacClipboard.html'
    };

    // guacClipboard directive controller
    config.controller = ['$scope', '$injector', '$element',
            function guacClipboardController($scope, $injector, $element) {

        /**
         * The DOM element which will contain the clipboard contents within the
         * user interface provided by this directive. We populate the clipboard
         * editor via this DOM element rather than updating a model so that we
         * are prepared for future support of rich text contents.
         *
         * @type {!Element}
         */
        var element = $element[0].querySelectorAll('.clipboard')[0];

        /**
         * Whether clipboard contents should be displayed in the clipboard
         * editor. If false, clipboard contents will not be displayed until
         * the user manually reveals them.
         *
         * @type {!boolean}
         */
        $scope.contentsShown = false;

        /**
         * Reveals the contents of the clipboard editor, automatically
         * assigning input focus to the editor if possible.
         */
        $scope.showContents = function showContents() {
            $scope.contentsShown = true;
            $window.setTimeout(function setFocus() {
                element.focus();
            }, 0);
        };

        /**
         * Rereads the contents of the clipboard field, updating the
         * ClipboardData object on the scope as necessary. The type of data
         * stored within the ClipboardData object will be heuristically
         * determined from the HTML contents of the clipboard field.
         */
        var updateClipboardData = function updateClipboardData() {

            // Read contents of clipboard textarea
            clipboardService.setClipboard(new ClipboardData({
                type : 'text/plain',
                data : element.value
            }));

        };

        /**
         * Updates the contents of the clipboard editor to the given data.
         *
         * @param {ClipboardData} data
         *     The ClipboardData to display within the clipboard editor for
         *     editing.
         */
        const updateClipboardEditor = function updateClipboardEditor(data) {

            // If the clipboard data is a string, render it as text
            if (typeof data.data === 'string')
                element.value = data.data;

            // Ignore other data types for now

        };

        // Update the internally-stored clipboard data when events are fired
        // that indicate the clipboard field may have been changed
        element.addEventListener('input', updateClipboardData);
        element.addEventListener('change', updateClipboardData);

        // Update remote clipboard if local clipboard changes
        $scope.$on('guacClipboard', function clipboardChanged(event, data) {
            updateClipboardEditor(data);
        });

        // Init clipboard editor with current clipboard contents
        clipboardService.getClipboard().then((data) => {
            updateClipboardEditor(data);
        }, angular.noop);

    }];

    return config;

}]);
