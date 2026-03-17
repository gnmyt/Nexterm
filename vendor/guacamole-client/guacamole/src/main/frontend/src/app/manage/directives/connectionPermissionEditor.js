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
 * A directive for manipulating the connection permissions granted within a
 * given {@link PermissionFlagSet}, tracking the specific permissions added or
 * removed within a separate pair of {@link PermissionSet} objects.
 */
angular.module('manage').directive('connectionPermissionEditor', ['$injector',
    function connectionPermissionEditor($injector) {

    // Required types
    var ConnectionGroup   = $injector.get('ConnectionGroup');
    var GroupListItem     = $injector.get('GroupListItem');
    var PermissionSet     = $injector.get('PermissionSet');

    // Required services
    var connectionGroupService = $injector.get('connectionGroupService');
    var dataSourceService      = $injector.get('dataSourceService');
    var requestService         = $injector.get('requestService');

    var directive = {

        // Element only
        restrict: 'E',
        replace: true,

        scope: {

            /**
             * The unique identifier of the data source associated with the
             * permissions being manipulated.
             *
             * @type String
             */
            dataSource : '=',

            /**
             * The current state of the permissions being manipulated. This
             * {@link PemissionFlagSet} will be modified as changes are made
             * through this permission editor.
             *
             * @type PermissionFlagSet
             */
            permissionFlags : '=',

            /**
             * The set of permissions that have been added, relative to the
             * initial state of the permissions being manipulated.
             *
             * @type PermissionSet
             */
            permissionsAdded : '=',

            /**
             * The set of permissions that have been removed, relative to the
             * initial state of the permissions being manipulated.
             *
             * @type PermissionSet
             */
            permissionsRemoved : '='

        },

        templateUrl: 'app/manage/templates/connectionPermissionEditor.html'

    };

    directive.controller = ['$scope', function connectionPermissionEditorController($scope) {

        /**
         * A map of data source identifiers to all root connection groups
         * within those data sources, regardless of the permissions granted for
         * the items within those groups. As only one data source is applicable
         * to any particular permission set being edited/created, this will only
         * contain a single key. If the data necessary to produce this map has
         * not yet been loaded, this will be null.
         *
         * @type Object.<String, GroupListItem>
         */
        var allRootGroups = null;

        /**
         * A map of data source identifiers to the root connection groups within
         * those data sources, excluding all items which are not explicitly
         * readable according to $scope.permissionFlags. As only one data
         * source is applicable to any particular permission set being
         * edited/created, this will only contain a single key. If the data
         * necessary to produce this map has not yet been loaded, this will be
         * null.
         *
         * @type Object.<String, GroupListItem>
         */
        var readableRootGroups = null;

        /**
         * The name of the tab within the connection permission editor which
         * displays currently selected (readable) connections only.
         *
         * @constant
         * @type String
         */
        var CURRENT_CONNECTIONS = 'CURRENT_CONNECTIONS';

        /**
         * The name of the tab within the connection permission editor which
         * displays all connections, regardless of whether they are readable.
         *
         * @constant
         * @type String
         */
        var ALL_CONNECTIONS = 'ALL_CONNECTIONS';

        /**
         * The names of all tabs which should be available within the
         * connection permission editor, in display order.
         *
         * @type String[]
         */
        $scope.tabs = [
            CURRENT_CONNECTIONS,
            ALL_CONNECTIONS
        ];

        /**
         * The name of the currently selected tab.
         *
         * @type String
         */
        $scope.currentTab = ALL_CONNECTIONS;

        /**
         * Array of all connection properties that are filterable.
         *
         * @type String[]
         */
        $scope.filteredConnectionProperties = [
            'name',
            'protocol'
        ];

        /**
         * Array of all connection group properties that are filterable.
         *
         * @type String[]
         */
        $scope.filteredConnectionGroupProperties = [
            'name'
        ];

        /**
         * Returns the root groups which should be displayed within the
         * connection permission editor.
         *
         * @returns {Object.<String, GroupListItem>}
         *     The root groups which should be displayed within the connection
         *     permission editor as a map of data source identifiers to the
         *     root connection groups within those data sources.
         */
        $scope.getRootGroups = function getRootGroups() {
            return $scope.currentTab === CURRENT_CONNECTIONS ? readableRootGroups : allRootGroups;
        };

        /**
         * Returns whether the given PermissionFlagSet declares explicit READ
         * permission for the connection, connection group, or sharing profile
         * represented by the given GroupListItem.
         *
         * @param {GroupListItem} item
         *     The GroupListItem which should be checked against the
         *     PermissionFlagSet.
         *
         * @param {PemissionFlagSet} flags
         *     The set of permissions which should be used to determine whether
         *     explicit READ permission is granted for the given item.
         *
         * @returns {Boolean}
         *     true if explicit READ permission is granted for the given item
         *     according to the given permission set, false otherwise.
         */
        var isReadable = function isReadable(item, flags) {

            switch (item.type) {

                case GroupListItem.Type.CONNECTION:
                    return flags.connectionPermissions.READ[item.identifier];

                case GroupListItem.Type.CONNECTION_GROUP:
                    return flags.connectionGroupPermissions.READ[item.identifier];

                case GroupListItem.Type.SHARING_PROFILE:
                    return flags.sharingProfilePermissions.READ[item.identifier];

            }

            return false;

        };

        /**
         * Expands all items within the tree descending from the given
         * GroupListItem which have at least one descendant for which explicit
         * READ permission is granted. The expanded state of all other items is
         * left untouched.
         *
         * @param {GroupListItem} item
         *     The GroupListItem which should be conditionally expanded
         *     depending on whether READ permission is granted for any of its
         *     descendants.
         *
         * @param {PemissionFlagSet} flags
         *     The set of permissions which should be used to determine whether
         *     the given item and its descendants are expanded.
         *
         * @returns {Boolean}
         *     true if the given item has been expanded, false otherwise.
         */
        var expandReadable = function expandReadable(item, flags) {

            // If the current item is expandable and has defined children,
            // determine whether it should be expanded
            if (item.expandable && item.children) {
                angular.forEach(item.children, function expandReadableChild(child) {

                    // The parent should be expanded by default if the child is
                    // expanded by default OR the permission set contains READ
                    // permission on the child
                    item.expanded |= expandReadable(child, flags) || isReadable(child, flags);

                });
            }

            return item.expanded;

        };

        /**
         * Creates a deep copy of all items within the tree descending from the
         * given GroupListItem which have at least one descendant for which
         * explicit READ permission is granted. Items which lack explicit READ
         * permission and which have no descendants having explicit READ
         * permission are omitted from the copy.
         *
         * @param {GroupListItem} item
         *     The GroupListItem which should be conditionally copied
         *     depending on whether READ permission is granted for any of its
         *     descendants.
         *
         * @param {PemissionFlagSet} flags
         *     The set of permissions which should be used to determine whether
         *     the given item or any of its descendants are copied.
         *
         * @returns {GroupListItem}
         *     A new GroupListItem containing a deep copy of the given item,
         *     omitting any items which lack explicit READ permission and whose
         *     descendants also lack explicit READ permission, or null if even
         *     the given item would not be copied.
         */
        var copyReadable = function copyReadable(item, flags) {

            // Produce initial shallow copy of given item
            item = new GroupListItem(item);

            // Replace children array with an array containing only readable
            // children (or children with at least one readable descendant),
            // flagging the current item for copying if any such children exist
            if (item.children) {

                var children = [];
                angular.forEach(item.children, function copyReadableChildren(child) {

                    // Reduce child tree to only explicitly readable items and
                    // their parents
                    child = copyReadable(child, flags);

                    // Include child only if they are explicitly readable, they
                    // have explicitly readable descendants, or their parent is
                    // readable (and thus all children are relevant)
                    if ((child.children && child.children.length)
                            || isReadable(item, flags)
                            || isReadable(child, flags))
                        children.push(child);

                });

                item.children = children;

            }

            return item;

        };

        // Retrieve all connections for which we have ADMINISTER permission
        dataSourceService.apply(
            connectionGroupService.getConnectionGroupTree,
            [$scope.dataSource],
            ConnectionGroup.ROOT_IDENTIFIER,
            [PermissionSet.ObjectPermissionType.ADMINISTER]
        )
        .then(function connectionGroupReceived(rootGroups) {

            // Update default expanded state and the all / readable-only views
            // when associated permissions change
            $scope.$watchGroup(['permissionFlags'], function updateDefaultExpandedStates() {

                if (!$scope.permissionFlags)
                    return;

                allRootGroups = {};
                readableRootGroups = {};

                angular.forEach(rootGroups, function addGroupListItem(rootGroup, dataSource) {

                    // Convert all received ConnectionGroup objects into GroupListItems
                    var item = GroupListItem.fromConnectionGroup(dataSource, rootGroup);
                    allRootGroups[dataSource] = item;

                    // Automatically expand all objects with any descendants for
                    // which the permission set contains READ permission
                    expandReadable(item, $scope.permissionFlags);

                    // Create a duplicate view which contains only readable
                    // items
                    readableRootGroups[dataSource] = copyReadable(item, $scope.permissionFlags);

                });

                // Display only readable connections by default if at least one
                // readable connection exists
                $scope.currentTab = !!readableRootGroups[$scope.dataSource].children.length ? CURRENT_CONNECTIONS : ALL_CONNECTIONS;

            });

        }, requestService.DIE);

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the addition of the given connection permission.
         *
         * @param {String} identifier
         *     The identifier of the connection to add READ permission for.
         */
        var addConnectionPermission = function addConnectionPermission(identifier) {

            // If permission was previously removed, simply un-remove it
            if (PermissionSet.hasConnectionPermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier))
                PermissionSet.removeConnectionPermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier);

            // Otherwise, explicitly add the permission
            else
                PermissionSet.addConnectionPermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the removal of the given connection permission.
         *
         * @param {String} identifier
         *     The identifier of the connection to remove READ permission for.
         */
        var removeConnectionPermission = function removeConnectionPermission(identifier) {

            // If permission was previously added, simply un-add it
            if (PermissionSet.hasConnectionPermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier))
                PermissionSet.removeConnectionPermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier);

            // Otherwise, explicitly remove the permission
            else
                PermissionSet.addConnectionPermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the addition of the given connection group permission.
         *
         * @param {String} identifier
         *     The identifier of the connection group to add READ permission
         *     for.
         */
        var addConnectionGroupPermission = function addConnectionGroupPermission(identifier) {

            // If permission was previously removed, simply un-remove it
            if (PermissionSet.hasConnectionGroupPermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier))
                PermissionSet.removeConnectionGroupPermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier);

            // Otherwise, explicitly add the permission
            else
                PermissionSet.addConnectionGroupPermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the removal of the given connection group permission.
         *
         * @param {String} identifier
         *     The identifier of the connection group to remove READ permission
         *     for.
         */
        var removeConnectionGroupPermission = function removeConnectionGroupPermission(identifier) {

            // If permission was previously added, simply un-add it
            if (PermissionSet.hasConnectionGroupPermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier))
                PermissionSet.removeConnectionGroupPermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier);

            // Otherwise, explicitly remove the permission
            else
                PermissionSet.addConnectionGroupPermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the addition of the given sharing profile permission.
         *
         * @param {String} identifier
         *     The identifier of the sharing profile to add READ permission for.
         */
        var addSharingProfilePermission = function addSharingProfilePermission(identifier) {

            // If permission was previously removed, simply un-remove it
            if (PermissionSet.hasSharingProfilePermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier))
                PermissionSet.removeSharingProfilePermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier);

            // Otherwise, explicitly add the permission
            else
                PermissionSet.addSharingProfilePermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier);

        };

        /**
         * Updates the permissionsAdded and permissionsRemoved permission sets
         * to reflect the removal of the given sharing profile permission.
         *
         * @param {String} identifier
         *     The identifier of the sharing profile to remove READ permission
         *     for.
         */
        var removeSharingProfilePermission = function removeSharingProfilePermission(identifier) {

            // If permission was previously added, simply un-add it
            if (PermissionSet.hasSharingProfilePermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier))
                PermissionSet.removeSharingProfilePermission($scope.permissionsAdded, PermissionSet.ObjectPermissionType.READ, identifier);

            // Otherwise, explicitly remove the permission
            else
                PermissionSet.addSharingProfilePermission($scope.permissionsRemoved, PermissionSet.ObjectPermissionType.READ, identifier);

        };

        // Expose permission query and modification functions to group list template
        $scope.groupListContext = {

            /**
             * Returns the PermissionFlagSet that contains the current state of
             * granted permissions.
             *
             * @returns {PermissionFlagSet}
             *     The PermissionFlagSet describing the current state of granted
             *     permissions for the permission set being edited.
             */
            getPermissionFlags : function getPermissionFlags() {
                return $scope.permissionFlags;
            },

            /**
             * Notifies the controller that a change has been made to the given
             * connection permission for the permission set being edited. This
             * only applies to READ permissions.
             *
             * @param {String} identifier
             *     The identifier of the connection affected by the changed
             *     permission.
             */
            connectionPermissionChanged : function connectionPermissionChanged(identifier) {

                // Determine current permission setting
                var granted = $scope.permissionFlags.connectionPermissions.READ[identifier];

                // Add/remove permission depending on flag state
                if (granted)
                    addConnectionPermission(identifier);
                else
                    removeConnectionPermission(identifier);

            },

            /**
             * Notifies the controller that a change has been made to the given
             * connection group permission for the permission set being edited.
             * This only applies to READ permissions.
             *
             * @param {String} identifier
             *     The identifier of the connection group affected by the
             *     changed permission.
             */
            connectionGroupPermissionChanged : function connectionGroupPermissionChanged(identifier) {

                // Determine current permission setting
                var granted = $scope.permissionFlags.connectionGroupPermissions.READ[identifier];

                // Add/remove permission depending on flag state
                if (granted)
                    addConnectionGroupPermission(identifier);
                else
                    removeConnectionGroupPermission(identifier);

            },

            /**
             * Notifies the controller that a change has been made to the given
             * sharing profile permission for the permission set being edited.
             * This only applies to READ permissions.
             *
             * @param {String} identifier
             *     The identifier of the sharing profile affected by the changed
             *     permission.
             */
            sharingProfilePermissionChanged : function sharingProfilePermissionChanged(identifier) {

                // Determine current permission setting
                var granted = $scope.permissionFlags.sharingProfilePermissions.READ[identifier];

                // Add/remove permission depending on flag state
                if (granted)
                    addSharingProfilePermission(identifier);
                else
                    removeSharingProfilePermission(identifier);

            }

        };

    }];

    return directive;

}]);
