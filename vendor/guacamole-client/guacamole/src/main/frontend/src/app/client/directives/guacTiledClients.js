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
 * A directive which displays one or more Guacamole clients in an evenly-tiled
 * view. The number of rows and columns used for the arrangement of tiles is
 * automatically determined by the number of clients present.
 */
angular.module('client').directive('guacTiledClients', [function guacTiledClients() {

    const directive = {
        restrict: 'E',
        templateUrl: 'app/client/templates/guacTiledClients.html',
    };

    directive.scope = {

        /**
         * The function to invoke when the "close" button in the header of a
         * client tile is clicked. The ManagedClient that is closed will be
         * made available to the Angular expression defining the callback as
         * "$client".
         *
         * @type function
         */
        onClose : '&',

        /**
         * The group of Guacamole clients that should be displayed in an
         * evenly-tiled grid arrangement.
         *
         * @type ManagedClientGroup
         */
        clientGroup : '=',

        /**
         * Whether translation of touch to mouse events should emulate an
         * absolute pointer device, or a relative pointer device.
         *
         * @type boolean
         */
        emulateAbsoluteMouse : '='

    };

    directive.controller = ['$scope', '$injector', '$element',
            function guacTiledClientsController($scope, $injector, $element) {

        // Required services
        const $rootScope = $injector.get('$rootScope');

        // Required types
        const ManagedClient      = $injector.get('ManagedClient');
        const ManagedClientGroup = $injector.get('ManagedClientGroup');

        /**
         * Returns the currently-focused ManagedClient. If there is no such
         * client, or multiple clients are focused, null is returned.
         *
         * @returns {ManagedClient}
         *     The currently-focused client, or null if there are no focused
         *     clients or if multiple clients are focused.
         */
        $scope.getFocusedClient = function getFocusedClient() {

            const managedClientGroup = $scope.clientGroup;
            if (managedClientGroup) {
                const focusedClients = _.filter(managedClientGroup.clients, client => client.clientProperties.focused);
                if (focusedClients.length === 1)
                    return focusedClients[0];
            }

            return null;

        };

        // Notify whenever identify of currently-focused client changes
        $scope.$watch('getFocusedClient()', function focusedClientChanged(focusedClient) {
            $rootScope.$broadcast('guacClientFocused', focusedClient);
        });

        // Notify whenever arguments of currently-focused client changes
        $scope.$watch('getFocusedClient().arguments', function focusedClientParametersChanged() {
            $rootScope.$broadcast('guacClientArgumentsUpdated', $scope.getFocusedClient());
        }, true);

        // Notify whenever protocol of currently-focused client changes
        $scope.$watch('getFocusedClient().protocol', function focusedClientParametersChanged() {
            $rootScope.$broadcast('guacClientProtocolUpdated', $scope.getFocusedClient());
        }, true);

        /**
         * Returns a callback for guacClick that assigns or updates keyboard
         * focus to the given client, allowing that client to receive and
         * handle keyboard events. Multiple clients may have keyboard focus
         * simultaneously.
         *
         * @param {ManagedClient} client
         *     The client that should receive keyboard focus.
         *
         * @return {guacClick~callback}
         *     The callback that guacClient should invoke when the given client
         *     has been clicked.
         */
        $scope.getFocusAssignmentCallback = function getFocusAssignmentCallback(client) {
            return (shift, ctrl) => {

                // Clear focus of all other clients if not selecting multiple
                if (!shift && !ctrl) {
                    $scope.clientGroup.clients.forEach(client => {
                        client.clientProperties.focused = false;
                    });
                }

                client.clientProperties.focused = true;

                // Fill in any gaps if performing rectangular multi-selection
                // via shift-click
                if (shift) {

                    let minRow = $scope.clientGroup.rows - 1;
                    let minColumn = $scope.clientGroup.columns - 1;
                    let maxRow = 0;
                    let maxColumn = 0;

                    // Determine extents of selected area
                    ManagedClientGroup.forEach($scope.clientGroup, (client, row, column) => {
                        if (client.clientProperties.focused) {
                            minRow = Math.min(minRow, row);
                            minColumn = Math.min(minColumn, column);
                            maxRow = Math.max(maxRow, row);
                            maxColumn = Math.max(maxColumn, column);
                        }
                    });

                    ManagedClientGroup.forEach($scope.clientGroup, (client, row, column) => {
                        client.clientProperties.focused =
                                row >= minRow
                             && row <= maxRow
                             && column >= minColumn
                             && column <= maxColumn;
                    });

                }

            };
        };

        /**
         * @borrows ManagedClientGroup.hasMultipleClients
         */
        $scope.hasMultipleClients = ManagedClientGroup.hasMultipleClients;

        /**
         * @borrows ManagedClientGroup.getClientGrid
         */
        $scope.getClientGrid = ManagedClientGroup.getClientGrid;

        /**
         * @borrows ManagedClient.isShared
         */
        $scope.isShared = ManagedClient.isShared;

    }];

    return directive;

}]);
