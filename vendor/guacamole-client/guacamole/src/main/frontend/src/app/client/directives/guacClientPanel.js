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
 * A toolbar/panel which displays a list of active Guacamole connections. The
 * panel is fixed to the bottom-right corner of its container and can be
 * manually hidden/exposed by the user.
 */
angular.module('client').directive('guacClientPanel', ['$injector', function guacClientPanel($injector) {

    // Required services
    const guacClientManager     = $injector.get('guacClientManager');
    const sessionStorageFactory = $injector.get('sessionStorageFactory');

    // Required types
    const ManagedClientGroup = $injector.get('ManagedClientGroup');
    const ManagedClientState = $injector.get('ManagedClientState');

    /**
     * Getter/setter for the boolean flag controlling whether the client panel
     * is currently hidden. This flag is maintained in session-local storage to
     * allow the state of the panel to persist despite navigation within the
     * same tab. When hidden, the panel will be collapsed against the right
     * side of the container. By default, the panel is visible.
     *
     * @type Function
     */
    var panelHidden = sessionStorageFactory.create(false);

    return {
        // Element only
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The ManagedClientGroup instances associated with the active
             * connections to be displayed within this panel.
             * 
             * @type ManagedClientGroup[]
             */
            clientGroups : '='

        },
        templateUrl: 'app/client/templates/guacClientPanel.html',
        controller: ['$scope', '$element', function guacClientPanelController($scope, $element) {

            /**
             * The DOM element containing the scrollable portion of the client
             * panel.
             *
             * @type Element
             */
            var scrollableArea = $element.find('.client-panel-connection-list')[0];

            /**
             * On-scope reference to session-local storage of the flag
             * controlling whether then panel is hidden.
             */
            $scope.panelHidden = panelHidden;

            /**
             * Returns whether this panel currently has any client groups
             * associated with it.
             *
             * @return {Boolean}
             *     true if at least one client group is associated with this
             *     panel, false otherwise.
             */
            $scope.hasClientGroups = function hasClientGroups() {
                return $scope.clientGroups && $scope.clientGroups.length;
            };

            /**
             * @borrows ManagedClientGroup.getIdentifier
             */
            $scope.getIdentifier = ManagedClientGroup.getIdentifier;

            /**
             * @borrows ManagedClientGroup.getTitle
             */
            $scope.getTitle = ManagedClientGroup.getTitle;

            /**
             * Returns whether the status of any client within the given client
             * group has changed in a way that requires the user's attention.
             * This may be due to an error, or due to a server-initiated
             * disconnect.
             *
             * @param {ManagedClientGroup} clientGroup
             *     The client group to test.
             *
             * @returns {Boolean}
             *     true if the given client requires the user's attention,
             *     false otherwise.
             */
            $scope.hasStatusUpdate = function hasStatusUpdate(clientGroup) {
                return _.findIndex(clientGroup.clients, (client) => {

                    // Test whether the client has encountered an error
                    switch (client.clientState.connectionState) {
                        case ManagedClientState.ConnectionState.CONNECTION_ERROR:
                        case ManagedClientState.ConnectionState.TUNNEL_ERROR:
                        case ManagedClientState.ConnectionState.DISCONNECTED:
                            return true;
                    }

                    return false;

                }) !== -1;
            };

            /**
             * Initiates an orderly disconnect of all clients within the given
             * group. The clients are removed from management such that
             * attempting to connect to any of the same connections will result
             * in new connections being established, rather than displaying a
             * notification that the connection has ended.
             *
             * @param {ManagedClientGroup} clientGroup
             *     The group of clients to disconnect.
             */
            $scope.disconnect = function disconnect(clientGroup) {
                guacClientManager.removeManagedClientGroup(ManagedClientGroup.getIdentifier(clientGroup));
            };

            /**
             * Toggles whether the client panel is currently hidden.
             */
            $scope.togglePanel = function togglePanel() {
                panelHidden(!panelHidden());
            };

            // Override vertical scrolling, scrolling horizontally instead
            scrollableArea.addEventListener('wheel', function reorientVerticalScroll(e) {

                var deltaMultiplier = {
                    /* DOM_DELTA_PIXEL */ 0x00: 1,
                    /* DOM_DELTA_LINE  */ 0x01: 15,
                    /* DOM_DELTA_PAGE  */ 0x02: scrollableArea.offsetWidth
                };

                if (e.deltaY) {
                    this.scrollLeft += e.deltaY * (deltaMultiplier[e.deltaMode] || deltaMultiplier(0x01));
                    e.preventDefault();
                }

            });

        }]
    };
}]);