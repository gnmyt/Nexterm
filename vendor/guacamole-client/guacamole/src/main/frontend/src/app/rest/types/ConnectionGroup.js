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
 * Service which defines the ConnectionGroup class.
 */
angular.module('rest').factory('ConnectionGroup', [function defineConnectionGroup() {
            
    /**
     * The object returned by REST API calls when representing the data
     * associated with a connection group.
     * 
     * @constructor
     * @param {ConnectionGroup|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ConnectionGroup.
     */
    var ConnectionGroup = function ConnectionGroup(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The unique identifier associated with this connection group.
         *
         * @type String
         */
        this.identifier = template.identifier;

        /**
         * The unique identifier of the connection group that contains this
         * connection group.
         * 
         * @type String
         * @default ConnectionGroup.ROOT_IDENTIFIER
         */
        this.parentIdentifier = template.parentIdentifier || ConnectionGroup.ROOT_IDENTIFIER;

        /**
         * The human-readable name of this connection group, which is not
         * necessarily unique.
         * 
         * @type String
         */
        this.name = template.name;

        /**
         * The type of this connection group, which may be either
         * ConnectionGroup.Type.ORGANIZATIONAL or
         * ConnectionGroup.Type.BALANCING.
         * 
         * @type String
         * @default ConnectionGroup.Type.ORGANIZATIONAL
         */
        this.type = template.type || ConnectionGroup.Type.ORGANIZATIONAL;

        /**
         * An array of all child connections, if known. This property may be
         * null or undefined if children have not been queried, and thus the
         * child connections are unknown.
         *
         * @type Connection[]
         */
        this.childConnections = template.childConnections;

        /**
         * An array of all child connection groups, if known. This property may
         * be null or undefined if children have not been queried, and thus the
         * child connection groups are unknown.
         *
         * @type ConnectionGroup[]
         */
        this.childConnectionGroups = template.childConnectionGroups;

        /**
         * Arbitrary name/value pairs which further describe this connection
         * group. The semantics and validity of these attributes are dictated
         * by the extension which defines them.
         *
         * @type Object.<String, String>
         */
        this.attributes = template.attributes || {};

        /**
         * The count of currently active connections using this connection
         * group. This field will be returned from the REST API during a get
         * operation, but manually setting this field will have no effect.
         * 
         * @type Number
         */
        this.activeConnections = template.activeConnections;

    };

    /**
     * The reserved identifier which always represents the root connection
     * group.
     * 
     * @type String
     */
    ConnectionGroup.ROOT_IDENTIFIER = "ROOT";

    /**
     * All valid connection group types.
     */
    ConnectionGroup.Type = {

        /**
         * The type string associated with balancing connection groups.
         *
         * @type String
         */
        BALANCING : "BALANCING",

        /**
         * The type string associated with organizational connection groups.
         *
         * @type String
         */
        ORGANIZATIONAL : "ORGANIZATIONAL"

    };

    return ConnectionGroup;

}]);