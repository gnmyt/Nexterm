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
 * Directive which displays an active file transfer, providing links for
 * downloads, if applicable.
 */
angular.module('client').directive('guacFileTransfer', [function guacFileTransfer() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The file transfer to display.
             *
             * @type ManagedFileUpload|ManagedFileDownload
             */
            transfer : '='

        },

        templateUrl: 'app/client/templates/guacFileTransfer.html',
        controller: ['$scope', '$injector', function guacFileTransferController($scope, $injector) {

            // Required services
            const guacTranslate = $injector.get('guacTranslate');

            // Required types
            var ManagedFileTransferState = $injector.get('ManagedFileTransferState');

            /**
             * Returns the unit string that is most appropriate for the
             * number of bytes transferred thus far - either 'gb', 'mb', 'kb',
             * or 'b'.
             *
             * @returns {String}
             *     The unit string that is most appropriate for the number of
             *     bytes transferred thus far.
             */
            $scope.getProgressUnit = function getProgressUnit() {

                var bytes = $scope.transfer.progress;

                // Gigabytes
                if (bytes > 1000000000)
                    return 'gb';

                // Megabytes
                if (bytes > 1000000)
                    return 'mb';

                // Kilobytes
                if (bytes > 1000)
                    return 'kb';

                // Bytes
                return 'b';

            };

            /**
             * Returns the amount of data transferred thus far, in the units
             * returned by getProgressUnit().
             *
             * @returns {Number}
             *     The amount of data transferred thus far, in the units
             *     returned by getProgressUnit().
             */
            $scope.getProgressValue = function getProgressValue() {

                var bytes = $scope.transfer.progress;
                if (!bytes)
                    return bytes;

                // Convert bytes to necessary units
                switch ($scope.getProgressUnit()) {

                    // Gigabytes
                    case 'gb':
                        return (bytes / 1000000000).toFixed(1);

                    // Megabytes
                    case 'mb':
                        return (bytes / 1000000).toFixed(1);

                    // Kilobytes
                    case 'kb':
                        return (bytes / 1000).toFixed(1);

                    // Bytes
                    case 'b':
                    default:
                        return bytes;

                }

            };

            /**
             * Returns the percentage of bytes transferred thus far, if the
             * overall length of the file is known.
             *
             * @returns {Number}
             *     The percentage of bytes transferred thus far, if the
             *     overall length of the file is known.
             */
            $scope.getPercentDone = function getPercentDone() {
                return $scope.transfer.progress / $scope.transfer.length * 100;
            };

            /**
             * Determines whether the associated file transfer is in progress.
             *
             * @returns {Boolean}
             *     true if the file transfer is in progress, false othherwise.
             */
            $scope.isInProgress = function isInProgress() {

                // Not in progress if there is no transfer
                if (!$scope.transfer)
                    return false;

                // Determine in-progress status based on stream state
                switch ($scope.transfer.transferState.streamState) {

                    // IDLE or OPEN file transfers are active
                    case ManagedFileTransferState.StreamState.IDLE:
                    case ManagedFileTransferState.StreamState.OPEN:
                        return true;

                    // All others are not active
                    default:
                        return false;

                }

            };

            /**
             * Returns whether the file associated with this file transfer can
             * be saved locally via a call to save().
             *
             * @returns {Boolean}
             *     true if a call to save() will result in the file being
             *     saved, false otherwise.
             */
            $scope.isSavable = function isSavable() {
                return !!$scope.transfer.blob;
            };

            /**
             * Saves the downloaded file, if any. If this transfer is an upload
             * or the download is not yet complete, this function has no
             * effect.
             */
            $scope.save = function save() {

                // Ignore if no blob exists
                if (!$scope.transfer.blob)
                    return;

                // Save file
                saveAs($scope.transfer.blob, $scope.transfer.filename);

            };

            /**
             * Returns whether an error has occurred. If an error has occurred,
             * the transfer is no longer active, and the text of the error can
             * be read from getErrorText().
             *
             * @returns {Boolean}
             *     true if an error has occurred during transfer, false
             *     otherwise.
             */
            $scope.hasError = function hasError() {
                return $scope.transfer.transferState.streamState === ManagedFileTransferState.StreamState.ERROR;
            };

            // The translated error message for the current status code
            $scope.translatedErrorMessage = '';

            $scope.$watch('transfer.transferState.statusCode', function statusCodeChanged(statusCode) {

                // Determine translation name of error
                const errorName = 'CLIENT.ERROR_UPLOAD_' + statusCode.toString(16).toUpperCase();

                // Use translation string, or the default if no translation is found for this error code
                guacTranslate(errorName, 'CLIENT.ERROR_UPLOAD_DEFAULT').then(
                    translationResult => $scope.translatedErrorMessage = translationResult.message
                );

            });

        }] // end file transfer controller

    };
}]);
