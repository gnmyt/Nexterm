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
 * A directive which displays the contents of a filesystem received through the
 * Guacamole client.
 */
angular.module('client').directive('guacFileBrowser', [function guacFileBrowser() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * @type ManagedFilesystem
             */
            filesystem : '='

        },

        templateUrl: 'app/client/templates/guacFileBrowser.html',
        controller: ['$scope', '$element', '$injector', function guacFileBrowserController($scope, $element, $injector) {

            // Required types
            var ManagedFilesystem = $injector.get('ManagedFilesystem');

            // Required services
            var $interpolate     = $injector.get('$interpolate');
            var $templateRequest = $injector.get('$templateRequest');

            /**
             * The jQuery-wrapped element representing the contents of the
             * current directory within the file browser.
             *
             * @type Element[]
             */
            var currentDirectoryContents = $element.find('.current-directory-contents');

            /**
             * Statically-cached template HTML used to render each file within
             * a directory. Once available, this will be used through
             * createFileElement() to generate the DOM elements which make up
             * a directory listing.
             *
             * @type String
             */
            var fileTemplate = null;

            /**
             * Returns whether the given file is a normal file.
             *
             * @param {ManagedFilesystem.File} file
             *     The file to test.
             *
             * @returns {Boolean}
             *     true if the given file is a normal file, false otherwise.
             */
            $scope.isNormalFile = function isNormalFile(file) {
                return file.type === ManagedFilesystem.File.Type.NORMAL;
            };

            /**
             * Returns whether the given file is a directory.
             *
             * @param {ManagedFilesystem.File} file
             *     The file to test.
             *
             * @returns {Boolean}
             *     true if the given file is a directory, false otherwise.
             */
            $scope.isDirectory = function isDirectory(file) {
                return file.type === ManagedFilesystem.File.Type.DIRECTORY;
            };

            /**
             * Changes the currently-displayed directory to the given
             * directory.
             *
             * @param {ManagedFilesystem.File} file
             *     The directory to change to.
             */
            $scope.changeDirectory = function changeDirectory(file) {
                ManagedFilesystem.changeDirectory($scope.filesystem, file);
            };

            /**
             * Initiates a download of the given file. The progress of the
             * download can be observed through guacFileTransferManager.
             *
             * @param {ManagedFilesystem.File} file
             *     The file to download.
             */
            $scope.downloadFile = function downloadFile(file) {
                ManagedFilesystem.downloadFile($scope.filesystem, file.streamName);
            };

            /**
             * Recursively interpolates all text nodes within the DOM tree of
             * the given element. All other node types, attributes, etc. will
             * be left uninterpolated.
             *
             * @param {Element} element
             *     The element at the root of the DOM tree to be interpolated.
             *
             * @param {Object} context
             *     The evaluation context to use when evaluating expressions
             *     embedded in text nodes within the provided element.
             */
            var interpolateElement = function interpolateElement(element, context) {

                // Interpolate the contents of text nodes directly
                if (element.nodeType === Node.TEXT_NODE)
                    element.nodeValue = $interpolate(element.nodeValue)(context);

                // Recursively interpolate the contents of all descendant text
                // nodes
                if (element.hasChildNodes()) {
                    var children = element.childNodes;
                    for (var i = 0; i < children.length; i++)
                        interpolateElement(children[i], context);
                }

            };

            /**
             * Creates a new element representing the given file and properly
             * handling user events, bypassing the overhead incurred through
             * use of ngRepeat and related techniques.
             *
             * Note that this function depends on the availability of the
             * statically-cached fileTemplate.
             *
             * @param {ManagedFilesystem.File} file
             *     The file to generate an element for.
             *
             * @returns {Element[]}
             *     A jQuery-wrapped array containing a single DOM element
             *     representing the given file.
             */
            var createFileElement = function createFileElement(file) {

                // Create from internal template
                var element = angular.element(fileTemplate);
                interpolateElement(element[0], file);

                // Double-clicking on unknown file types will do nothing
                var fileAction = function doNothing() {};

                // Change current directory when directories are clicked
                if ($scope.isDirectory(file)) {
                    element.addClass('directory');
                    fileAction = function changeDirectory() {
                        $scope.changeDirectory(file);
                    };
                }

                // Initiate downloads when normal files are clicked
                else if ($scope.isNormalFile(file)) {
                    element.addClass('normal-file');
                    fileAction = function downloadFile() {
                        $scope.downloadFile(file);
                    };
                }

                // Mark file as focused upon click
                element.on('click', function handleFileClick() {

                    // Fire file-specific action if already focused
                    if (element.hasClass('focused')) {
                        fileAction();
                        element.removeClass('focused');
                    }

                    // Otherwise mark as focused
                    else {
                        element.parent().children().removeClass('focused');
                        element.addClass('focused');
                    }

                });

                // Prevent text selection during navigation
                element.on('selectstart', function avoidSelect(e) {
                    e.preventDefault();
                    e.stopPropagation();
                });

                return element;

            };

            /**
             * Sorts the given map of files, returning an array of those files
             * grouped by file type (directories first, followed by non-
             * directories) and sorted lexicographically.
             *
             * @param {Object.<String, ManagedFilesystem.File>} files
             *     The map of files to sort.
             *
             * @returns {ManagedFilesystem.File[]}
             *     An array of all files in the given map, sorted
             *     lexicographically with directories first, followed by non-
             *     directories.
             */
            var sortFiles = function sortFiles(files) {

                // Get all given files as an array
                var unsortedFiles = [];
                for (var name in files)
                    unsortedFiles.push(files[name]);

                // Sort files - directories first, followed by all other files
                // sorted by name
                return unsortedFiles.sort(function fileComparator(a, b) {

                    // Directories come before non-directories
                    if ($scope.isDirectory(a) && !$scope.isDirectory(b))
                        return -1;

                    // Non-directories come after directories
                    if (!$scope.isDirectory(a) && $scope.isDirectory(b))
                        return 1;

                    // All other combinations are sorted by name
                    return a.name.localeCompare(b.name);

                });

            };

            // Watch directory contents once file template is available
            $templateRequest('app/client/templates/file.html').then(function fileTemplateRetrieved(html) {

                // Store file template statically
                fileTemplate = html;

                // Update the contents of the file browser whenever the current directory (or its contents) changes
                $scope.$watch('filesystem.currentDirectory.files', function currentDirectoryChanged(files) {

                    // Clear current content
                    currentDirectoryContents.html('');

                    // Display all files within current directory, sorted
                    angular.forEach(sortFiles(files), function displayFile(file) {
                        currentDirectoryContents.append(createFileElement(file));
                    });

                });

            }, angular.noop); // end retrieve file template

            // Refresh file browser when any upload completes
            $scope.$on('guacUploadComplete', function uploadComplete(event, filename) {

                // Refresh filesystem, if it exists
                if ($scope.filesystem)
                    ManagedFilesystem.refresh($scope.filesystem, $scope.filesystem.currentDirectory);

            });

        }]

    };
}]);
