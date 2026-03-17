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
 * Directive which displays all active file transfers.
 */
angular.module('client').directive('guacFileTransferManager', [function guacFileTransferManager() {

    return {
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The client group whose file transfers should be managed by this
             * directive.
             * 
             * @type ManagedClientGroup
             */
            clientGroup : '='

        },

        templateUrl: 'app/client/templates/guacFileTransferManager.html',
        controller: ['$scope', '$injector', function guacFileTransferManagerController($scope, $injector) {

            // Required types
            const ManagedClient            = $injector.get('ManagedClient');
            const ManagedClientGroup       = $injector.get('ManagedClientGroup');
            const ManagedFileTransferState = $injector.get('ManagedFileTransferState');

            /**
             * Determines whether the given file transfer state indicates an
             * in-progress transfer.
             *
             * @param {ManagedFileTransferState} transferState
             *     The file transfer state to check.
             *
             * @returns {Boolean}
             *     true if the given file transfer state indicates an in-
             *     progress transfer, false otherwise.
             */
            var isInProgress = function isInProgress(transferState) {
                switch (transferState.streamState) {

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
             * Removes all file transfers which are not currently in-progress.
             */
            $scope.clearCompletedTransfers = function clearCompletedTransfers() {

                // Nothing to clear if no client group attached
                if (!$scope.clientGroup)
                    return;

                // Remove completed uploads
                $scope.clientGroup.clients.forEach(client =>  {
                    client.uploads = client.uploads.filter(function isUploadInProgress(upload) {
                        return isInProgress(upload.transferState);
                    });
                });

            };

            /**
             * @borrows ManagedClientGroup.hasMultipleClients
             */
            $scope.hasMultipleClients = ManagedClientGroup.hasMultipleClients;

            /**
             * @borrows ManagedClient.hasTransfers
             */
            $scope.hasTransfers = ManagedClient.hasTransfers;

        }]

    };
}]);
