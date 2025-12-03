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
 * Provides the ActiveConnection class used by the guacRecentConnections
 * directive.
 */
angular.module('home').factory('ActiveConnection', [function defineActiveConnection() {

    /**
     * A recently-user connection, visible to the current user, with an
     * associated history entry.
     * 
     * @constructor
     */
    var ActiveConnection = function ActiveConnection(name, client) {

        /**
         * The human-readable name of this connection.
         * 
         * @type String
         */
        this.name = name;

        /**
         * The client associated with this active connection.
         * 
         * @type ManagedClient 
         */
        this.client = client;

    };

    return ActiveConnection;

}]);
