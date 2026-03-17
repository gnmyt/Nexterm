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
 * Provides the HistoryEntry class used by the guacHistory service.
 */
angular.module('history').factory('HistoryEntry', [function defineHistoryEntry() {

    /**
     * A single entry in the connection history.
     * 
     * @constructor
     * @param {String} id The ID of the connection.
     * 
     * @param {String} thumbnail
     *     The URL of the thumbnail to use to represent the connection.
     */
    var HistoryEntry = function HistoryEntry(id, thumbnail) {

        /**
         * The ID of the connection associated with this history entry,
         * including type prefix.
         */
        this.id = id;

        /**
         * The thumbnail associated with the connection associated with this
         * history entry.
         */
        this.thumbnail = thumbnail;

    };

    return HistoryEntry;

}]);
