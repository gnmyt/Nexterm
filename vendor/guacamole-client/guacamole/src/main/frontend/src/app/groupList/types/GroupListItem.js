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
 * Provides the GroupListItem class definition.
 */
angular.module('groupList').factory('GroupListItem', ['$injector', function defineGroupListItem($injector) {

    // Required types
    var ClientIdentifier = $injector.get('ClientIdentifier');
    var ConnectionGroup  = $injector.get('ConnectionGroup');

    /**
     * Creates a new GroupListItem, initializing the properties of that
     * GroupListItem with the corresponding properties of the given template.
     *
     * @constructor
     * @param {GroupListItem|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     GroupListItem.
     */
    var GroupListItem = function GroupListItem(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The identifier of the data source associated with the connection,
         * connection group, or sharing profile this item represents.
         *
         * @type String
         */
        this.dataSource = template.dataSource;

        /**
         * The unique identifier associated with the connection, connection
         * group, or sharing profile this item represents.
         *
         * @type String
         */
        this.identifier = template.identifier;

        /**
         * The human-readable display name of this item.
         * 
         * @type String
         */
        this.name = template.name;

        /**
         * The unique identifier of the protocol, if this item represents a
         * connection. If this item does not represent a connection, this
         * property is not applicable.
         * 
         * @type String
         */
        this.protocol = template.protocol;

        /**
         * All children items of this item. If this item contains no children,
         * this will be an empty array.
         *
         * @type GroupListItem[]
         */
        this.children = template.children || [];

        /**
         * The type of object represented by this GroupListItem. Standard types
         * are defined by GroupListItem.Type, but custom types are also legal.
         *
         * @type String
         */
        this.type = template.type;

        /**
         * Whether this item, or items of the same type, can contain children.
         * This may be true even if this particular item does not presently
         * contain children.
         *
         * @type Boolean
         */
        this.expandable = template.expandable;

        /**
         * Whether this item represents a balancing connection group.
         *
         * @type Boolean
         */
        this.balancing = template.balancing;

        /**
         * Whether the children items should be displayed.
         *
         * @type Boolean
         */
        this.expanded = template.expanded;

        /**
         * Returns the number of currently active users for this connection,
         * connection group, or sharing profile, if known. If unknown, null may
         * be returned.
         * 
         * @returns {Number}
         *     The number of currently active users for this connection,
         *     connection group, or sharing profile.
         */
        this.getActiveConnections = template.getActiveConnections || (function getActiveConnections() {
            return null;
        });

        /**
         * Returns the unique string identifier that must be used when
         * connecting to a connection or connection group represented by this
         * GroupListItem.
         *
         * @returns {String}
         *     The client identifier associated with the connection or
         *     connection group represented by this GroupListItem, or null if
         *     this GroupListItem cannot have an associated client identifier.
         */
        this.getClientIdentifier = template.getClientIdentifier || function getClientIdentifier() {

            // If the item is a connection, generate a connection identifier
            if (this.type === GroupListItem.Type.CONNECTION)
                return ClientIdentifier.toString({
                    dataSource : this.dataSource,
                    type       : ClientIdentifier.Types.CONNECTION,
                    id         : this.identifier
                });

            // If the item is a connection group, generate a connection group identifier
            if (this.type === GroupListItem.Type.CONNECTION_GROUP && this.balancing)
                return ClientIdentifier.toString({
                    dataSource : this.dataSource,
                    type       : ClientIdentifier.Types.CONNECTION_GROUP,
                    id         : this.identifier
                });

            // Otherwise, no such identifier can exist
            return null;

        };

        /**
         * Returns the relative URL of the client page that connects to the
         * connection or connection group represented by this GroupListItem.
         *
         * @returns {String}
         *     The relative URL of the client page that connects to the
         *     connection or connection group represented by this GroupListItem,
         *     or null if this GroupListItem cannot be connected to.
         */
        this.getClientURL = template.getClientURL || function getClientURL() {

            // There is a client page for this item only if it has an
            // associated client identifier
            var identifier = this.getClientIdentifier();
            if (identifier)
                return '#/client/' + encodeURIComponent(identifier);

            return null;

        };

        /**
         * The connection, connection group, or sharing profile whose data is
         * exposed within this GroupListItem. If the type of this GroupListItem
         * is not one of the types defined by GroupListItem.Type, then this
         * value may be anything.
         *
         * @type Connection|ConnectionGroup|SharingProfile|*
         */
        this.wrappedItem = template.wrappedItem;

        /**
         * The sorting weight to apply when displaying this GroupListItem. This
         * weight is relative only to other sorting weights. If two items have
         * the same weight, they will be sorted based on their names.
         *
         * @type Number
         * @default 0
         */
        this.weight = template.weight || 0;

    };

    /**
     * Creates a new GroupListItem using the contents of the given connection.
     *
     * @param {String} dataSource
     *     The identifier of the data source containing the given connection
     *     group.
     *
     * @param {ConnectionGroup} connection
     *     The connection whose contents should be represented by the new
     *     GroupListItem.
     *
     * @param {Boolean} [includeSharingProfiles=true]
     *     Whether sharing profiles should be included in the contents of the
     *     resulting GroupListItem. By default, sharing profiles are included.
     *
     * @param {Function} [countActiveConnections]
     *     A getter which returns the current number of active connections for
     *     the given connection. If omitted, the number of active connections
     *     known at the time this function was called is used instead. This
     *     function will be passed, in order, the data source identifier and
     *     the connection in question.
     *
     * @returns {GroupListItem}
     *     A new GroupListItem which represents the given connection.
     */
    GroupListItem.fromConnection = function fromConnection(dataSource,
        connection, includeSharingProfiles, countActiveConnections) {

        var children = [];

        // Add any sharing profiles
        if (connection.sharingProfiles && includeSharingProfiles !== false) {
            connection.sharingProfiles.forEach(function addSharingProfile(child) {
                children.push(GroupListItem.fromSharingProfile(dataSource,
                    child, countActiveConnections));
            });
        }

        // Return item representing the given connection
        return new GroupListItem({

            // Identifying information
            name       : connection.name,
            identifier : connection.identifier,
            protocol   : connection.protocol,
            dataSource : dataSource,

            // Type information
            expandable : includeSharingProfiles !== false,
            type       : GroupListItem.Type.CONNECTION,

            // Already-converted children
            children : children,

            // Count of currently active connections using this connection
            getActiveConnections : function getActiveConnections() {

                // Use getter, if provided
                if (countActiveConnections)
                    return countActiveConnections(dataSource, connection);

                return connection.activeConnections;

            },

            // Wrapped item
            wrappedItem : connection

        });

    };

    /**
     * Creates a new GroupListItem using the contents and descendants of the
     * given connection group.
     *
     * @param {String} dataSource
     *     The identifier of the data source containing the given connection
     *     group.
     *
     * @param {ConnectionGroup} connectionGroup
     *     The connection group whose contents and descendants should be
     *     represented by the new GroupListItem and its descendants.
     *     
     * @param {Boolean} [includeConnections=true]
     *     Whether connections should be included in the contents of the
     *     resulting GroupListItem. By default, connections are included.
     *
     * @param {Boolean} [includeSharingProfiles=true]
     *     Whether sharing profiles should be included in the contents of the
     *     resulting GroupListItem. By default, sharing profiles are included.
     *
     * @param {Function} [countActiveConnections]
     *     A getter which returns the current number of active connections for
     *     the given connection. If omitted, the number of active connections
     *     known at the time this function was called is used instead. This
     *     function will be passed, in order, the data source identifier and
     *     the connection group in question.
     *
     * @param {Function} [countActiveConnectionGroups]
     *     A getter which returns the current number of active connections for
     *     the given connection group. If omitted, the number of active
     *     connections known at the time this function was called is used
     *     instead. This function will be passed, in order, the data source
     *     identifier and the connection group in question.
     *
     * @returns {GroupListItem}
     *     A new GroupListItem which represents the given connection group,
     *     including all descendants.
     */
    GroupListItem.fromConnectionGroup = function fromConnectionGroup(dataSource,
        connectionGroup, includeConnections, includeSharingProfiles,
        countActiveConnections, countActiveConnectionGroups) {

        var children = [];

        // Add any child connections
        if (connectionGroup.childConnections && includeConnections !== false) {
            connectionGroup.childConnections.forEach(function addChildConnection(child) {
                children.push(GroupListItem.fromConnection(dataSource, child,
                    includeSharingProfiles, countActiveConnections));
            });
        }

        // Add any child groups 
        if (connectionGroup.childConnectionGroups) {
            connectionGroup.childConnectionGroups.forEach(function addChildGroup(child) {
                children.push(GroupListItem.fromConnectionGroup(dataSource,
                    child, includeConnections, includeSharingProfiles,
                    countActiveConnections, countActiveConnectionGroups));
            });
        }

        // Return item representing the given connection group
        return new GroupListItem({

            // Identifying information
            name       : connectionGroup.name,
            identifier : connectionGroup.identifier,
            dataSource : dataSource,

            // Type information
            type       : GroupListItem.Type.CONNECTION_GROUP,
            balancing  : connectionGroup.type === ConnectionGroup.Type.BALANCING,
            expandable : true,

            // Already-converted children
            children : children,

            // Count of currently active connection groups using this connection
            getActiveConnections : function getActiveConnections() {

                // Use getter, if provided
                if (countActiveConnectionGroups)
                    return countActiveConnectionGroups(dataSource, connectionGroup);

                return connectionGroup.activeConnections;

            },


            // Wrapped item
            wrappedItem : connectionGroup

        });

    };

    /**
     * Creates a new GroupListItem using the contents of the given sharing
     * profile.
     *
     * @param {String} dataSource
     *     The identifier of the data source containing the given sharing
     *     profile.
     *
     * @param {SharingProfile} sharingProfile
     *     The sharing profile whose contents should be represented by the new
     *     GroupListItem.
     *
     * @returns {GroupListItem}
     *     A new GroupListItem which represents the given sharing profile.
     */
    GroupListItem.fromSharingProfile = function fromSharingProfile(dataSource,
        sharingProfile) {

        // Return item representing the given sharing profile
        return new GroupListItem({

            // Identifying information
            name       : sharingProfile.name,
            identifier : sharingProfile.identifier,
            dataSource : dataSource,

            // Type information
            type : GroupListItem.Type.SHARING_PROFILE,

            // Wrapped item
            wrappedItem : sharingProfile

        });

    };

    /**
     * All pre-defined types of GroupListItems. Note that, while these are the
     * standard types supported by GroupListItem and the related guacGroupList
     * directive, the type string is otherwise arbitrary and custom types are
     * legal.
     *
     * @type Object.<String, String>
     */
    GroupListItem.Type = {

        /**
         * The standard type string of a GroupListItem which represents a
         * connection.
         *
         * @type String
         */
        CONNECTION : 'connection',

        /**
         * The standard type string of a GroupListItem which represents a
         * connection group.
         *
         * @type String
         */
        CONNECTION_GROUP : 'connection-group',

        /**
         * The standard type string of a GroupListItem which represents a
         * sharing profile.
         *
         * @type String
         */
        SHARING_PROFILE : 'sharing-profile'

    };

    return GroupListItem;

}]);
