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
 * Service which defines the Connection class.
 */
angular.module('rest').factory('Connection', [function defineConnection() {
            
    /**
     * The object returned by REST API calls when representing the data
     * associated with a connection.
     * 
     * @constructor
     * @param {Connection|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     Connection.
     */
    var Connection = function Connection(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The unique identifier associated with this connection.
         *
         * @type String
         */
        this.identifier = template.identifier;

        /**
         * The unique identifier of the connection group that contains this
         * connection.
         * 
         * @type String
         */
        this.parentIdentifier = template.parentIdentifier;

        /**
         * The human-readable name of this connection, which is not necessarily
         * unique.
         * 
         * @type String
         */
        this.name = template.name;

        /**
         * The name of the protocol associated with this connection, such as
         * "vnc" or "rdp".
         *
         * @type String
         */
        this.protocol = template.protocol;

        /**
         * Connection configuration parameters, as dictated by the protocol in
         * use, arranged as name/value pairs. This information may not be
         * available until directly queried. If this information is
         * unavailable, this property will be null or undefined.
         *
         * @type Object.<String, String>
         */
        this.parameters = template.parameters;

        /**
         * Arbitrary name/value pairs which further describe this connection.
         * The semantics and validity of these attributes are dictated by the
         * extension which defines them.
         *
         * @type Object.<String, String>
         */
        this.attributes = template.attributes || {};

        /**
         * The count of currently active connections using this connection.
         * This field will be returned from the REST API during a get
         * operation, but manually setting this field will have no effect.
         * 
         * @type Number
         */
        this.activeConnections = template.activeConnections;

        /**
         * An array of all associated sharing profiles, if known. This property
         * may be null or undefined if sharing profiles have not been queried,
         * and thus the sharing profiles are unknown.
         *
         * @type SharingProfile[]
         */
        this.sharingProfiles = template.sharingProfiles;

        /**
         * The time that this connection was last used, in milliseconds since
         * 1970-01-01 00:00:00 UTC. If this information is unknown or
         * unavailable, this will be null.
         *
         * @type Number
         */
        this.lastActive = template.lastActive;

    };

    return Connection;

}]);