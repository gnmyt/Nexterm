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
 * A directive which allows files to be uploaded. Clicking on the associated
 * element will result in a file selector dialog, which then calls the provided
 * callback function with any chosen files.
 */
angular.module('element').directive('guacUpload', ['$document', function guacUpload($document) {

    return {
        restrict: 'A',

        link: function linkGuacUpload($scope, $element, $attrs) {

            /**
             * The function to call whenever files are chosen. The callback is
             * provided a single parameter: the FileList containing all chosen
             * files.
             *
             * @type Function 
             */
            const guacUpload = $scope.$eval($attrs.guacUpload);

            /**
             * Whether upload of multiple files should be allowed. If false, the
             * file dialog will only allow a single file to be chosen at once,
             * otherwise any number of files may be chosen. Defaults to true if
             * not set.
             *
             * @type Boolean
             */
            const guacMultiple = 'guacMultiple' in $attrs
                ? $scope.$eval($attrs.guacMultiple) : true;

            /**
             * The element which will register the click.
             *
             * @type Element
             */
            const element = $element[0];

            /**
             * Internal form, containing a single file input element.
             *
             * @type HTMLFormElement
             */
            const form = $document[0].createElement('form');

            /**
             * Internal file input element.
             *
             * @type HTMLInputElement
             */
            const input = $document[0].createElement('input');

            // Init input element
            input.type = 'file';
            input.multiple = guacMultiple;

            // Add input element to internal form
            form.appendChild(input);

            // Notify of any chosen files
            input.addEventListener('change', function filesSelected() {
                $scope.$apply(function setSelectedFiles() {

                    // Only set chosen files selection is not canceled
                    if (guacUpload && input.files.length > 0)
                        guacUpload(input.files);

                    // Reset selection
                    form.reset();

                });
            });

            // Open file chooser when element is clicked
            element.addEventListener('click', function elementClicked() {
                input.click();
            });

        } // end guacUpload link function

    };

}]);
