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
 * A directive which allows multiple files to be uploaded. Dragging files onto
 * the associated element will call the provided callback function with any
 * dragged files.
 */
angular.module('element').directive('guacDrop', ['$injector', function guacDrop($injector) {

    // Required services
    const guacNotification = $injector.get('guacNotification');

    return {
        restrict: 'A',

        link: function linkGuacDrop($scope, $element, $attrs) {

            /**
             * The function to call whenever files are dragged. The callback is
             * provided a single parameter: the FileList containing all dragged
             * files.
             *
             * @type Function
             */
            const guacDrop = $scope.$eval($attrs.guacDrop);

            /**
             * Any number of space-seperated classes to be applied to the
             * element a drop is pending: when the user has dragged something
             * over the element, but not yet dropped. These classes will be 
             * removed when a drop is not pending.
             *
             * @type String
             */
            const guacDraggedClass = $scope.$eval($attrs.guacDraggedClass);

            /**
             * Whether upload of multiple files should be allowed. If false, an
             * error will be displayed explaining the restriction, otherwise
             * any number of files may be dragged. Defaults to true if not set.
             *
             * @type Boolean
             */
            const guacMultiple = 'guacMultiple' in $attrs
                ? $scope.$eval($attrs.guacMultiple) : true;

            /**
             * The element which will register drag event.
             *
             * @type Element
             */
            const element = $element[0];

            /**
             * Applies any classes provided in the guacDraggedClass attribute.
             * Further propagation and default behavior of the given event is
             * automatically prevented.
             *
             * @param {Event} e
             *     The event related to the in-progress drag/drop operation.
             */
            const notifyDragStart = function notifyDragStart(e) {

                e.preventDefault();
                e.stopPropagation();

                // Skip further processing if no classes were provided
                if (!guacDraggedClass)
                    return;

                // Add each provided class
                guacDraggedClass.split(' ').forEach(classToApply =>
                    element.classList.add(classToApply));

            };

            /**
             * Removes any classes provided in the guacDraggedClass attribute.
             * Further propagation and default behavior of the given event is
             * automatically prevented.
             *
             * @param {Event} e
             *     The event related to the end of the drag/drop operation.
             */
            const notifyDragEnd = function notifyDragEnd(e) {

                e.preventDefault();
                e.stopPropagation();

                // Skip further processing if no classes were provided
                if (!guacDraggedClass)
                    return;

                // Remove each provided class
                guacDraggedClass.split(' ').forEach(classToRemove =>
                    element.classList.remove(classToRemove));

            };

            // Add listeners to the drop target to ensure that the visual state
            // stays up to date
            element.addEventListener('dragenter', notifyDragStart);
            element.addEventListener('dragover',  notifyDragStart);
            element.addEventListener('dragleave', notifyDragEnd);

            /**
             * Event listener that will be invoked if the user drops anything
             * onto the event. If a valid file is provided, the onFile callback
             * provided to this directive will be called; otherwise an error
             * will be displayed, if appropriate.
             *
             * @param {Event} e
             *     The drop event that triggered this handler.
             */
            element.addEventListener('drop', e => {

                notifyDragEnd(e);

                const files = e.dataTransfer.files;

                // Ignore any non-files that are dragged into the drop area
                if (files.length < 1)
                    return;

                // If multi-file upload is disabled, If more than one file was
                // provided, print an error explaining the problem
                if (!guacMultiple && files.length >= 2) {

                    guacNotification.showStatus({
                        className   : 'error',
                        title       : 'APP.DIALOG_HEADER_ERROR',
                        text: { key : 'APP.ERROR_SINGLE_FILE_ONLY'},

                        // Add a button to hide the error
                        actions    : [{
                            name      : 'APP.ACTION_ACKNOWLEDGE',
                            callback  : () => guacNotification.showStatus(false)
                        }]
                    });
                    return;

                }

                // Invoke the callback with the files. Note that if guacMultiple
                // is set to false, this will always be a single file.
                guacDrop(files);

            });

        } // end guacDrop link function

    };

}]);
