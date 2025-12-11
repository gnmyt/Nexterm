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
 * Service which defines the ActiveConnection class.
 */
angular.module('rest').factory('ActiveConnection', [function defineActiveConnection() {
            
    /**
     * The object returned by REST API calls when representing the data
     * associated with an active connection. Each active connection is
     * effectively a pairing of a connection and the user currently using it,
     * along with other information.
     * 
     * @constructor
     * @param {ActiveConnection|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ActiveConnection.
     */
    var ActiveConnection = function ActiveConnection(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The identifier which uniquely identifies this specific active
         * connection.
         * 
         * @type String
         */
        this.identifier = template.identifier;

        /**
         * The identifier of the connection associated with this active
         * connection.
         *
         * @type String
         */
        this.connectionIdentifier = template.connectionIdentifier;

        /**
         * The time that the connection began, in seconds since
         * 1970-01-01 00:00:00 UTC, if known.
         *
         * @type Number 
         */
        this.startDate = template.startDate;

        /**
         * The remote host that initiated the connection, if known.
         *
         * @type String
         */
        this.remoteHost = template.remoteHost;

        /**
         * The username of the user associated with the connection, if known.
         * 
         * @type String
         */
        this.username = template.username;

        /**
         * Whether this active connection may be connected to, just as a
         * normal connection.
         *
         * @type Boolean
         */
        this.connectable = template.connectable;

    };

    return ActiveConnection;

}]);