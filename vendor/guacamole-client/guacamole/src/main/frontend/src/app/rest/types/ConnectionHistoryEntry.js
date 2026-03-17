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
 * Service which defines the ConnectionHistoryEntry class.
 */
angular.module('rest').factory('ConnectionHistoryEntry', [function defineConnectionHistoryEntry() {
            
    /**
     * The object returned by REST API calls when representing the data
     * associated with an entry in a connection's usage history. Each history
     * entry represents the time at which a particular started using a
     * connection and, if applicable, the time that usage stopped.
     * 
     * @constructor
     * @param {ConnectionHistoryEntry|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ConnectionHistoryEntry.
     */
    var ConnectionHistoryEntry = function ConnectionHistoryEntry(template) {

        // Use empty object by default
        template = template || {};

        /**
         * An arbitrary identifier that uniquely identifies this record
         * relative to other records in the same set, or null if no such unique
         * identifier exists.
         *
         * @type {string}
         */
        this.identifier = template.identifier;

        /**
         * A UUID that uniquely identifies this record, or null if no such
         * unique identifier exists.
         *
         * @type {string}
         */
        this.uuid = template.uuid;

        /**
         * The identifier of the connection associated with this history entry.
         *
         * @type String
         */
        this.connectionIdentifier = template.connectionIdentifier;

        /**
         * The name of the connection associated with this history entry.
         *
         * @type String
         */
        this.connectionName = template.connectionName;

        /**
         * The remote host associated with this history entry.
         *
         * @type String
         */
        this.remoteHost = template.remoteHost;

        /**
         * The time that usage began, in seconds since 1970-01-01 00:00:00 UTC.
         *
         * @type Number 
         */
        this.startDate = template.startDate;

        /**
         * The time that usage ended, in seconds since 1970-01-01 00:00:00 UTC.
         * The absence of an endDate does NOT necessarily indicate that the
         * connection is still in use, particularly if the server was shutdown
         * or restarted before the history entry could be updated. To determine
         * whether a connection is still active, check the active property of
         * this history entry.
         * 
         * @type Number 
         */
        this.endDate = template.endDate;

        /**
         * The remote host that initiated this connection, if known.
         *
         * @type String
         */
        this.remoteHost = template.remoteHost;

        /**
         * The username of the user associated with this particular usage of
         * the connection.
         * 
         * @type String
         */
        this.username = template.username;

        /**
         * Whether this usage of the connection is still active. Note that this
         * is the only accurate way to check for connection activity; the
         * absence of endDate does not necessarily imply the connection is
         * active, as the history entry may simply be incomplete.
         * 
         * @type Boolean
         */
        this.active = template.active;

        /**
         * Arbitrary name/value pairs which further describe this history
         * entry. The semantics and validity of these attributes are dictated
         * by the extension which defines them.
         *
         * @type {!object.<string, string>}
         */
        this.attributes = template.attributes;

        /**
         * All logs associated and accessible via this record, stored by their
         * corresponding unique names.
         *
         * @type {!object.<string, ActivityLog>}
         */
        this.logs = template.logs;

    };

    /**
     * All possible predicates for sorting ConnectionHistoryEntry objects using
     * the REST API. By default, each predicate indicates ascending order. To
     * indicate descending order, add "-" to the beginning of the predicate.
     *
     * @type Object.<String, String>
     */
    ConnectionHistoryEntry.SortPredicate = {

        /**
         * The date and time that the connection associated with the history
         * entry began (connected).
         */
        START_DATE : 'startDate'

    };

    /**
     * Value/unit pair representing the length of time that a connection was
     * used.
     * 
     * @constructor
     * @param {Number} milliseconds
     *     The number of milliseconds that the associated connection was used.
     */
    ConnectionHistoryEntry.Duration = function Duration(milliseconds) {

        /**
         * The provided duration in seconds.
         *
         * @type Number
         */
        var seconds = milliseconds / 1000;

        /**
         * Rounds the given value to the nearest tenth.
         *
         * @param {Number} value The value to round.
         * @returns {Number} The given value, rounded to the nearest tenth.
         */
        var round = function round(value) {
            return Math.round(value * 10) / 10;
        };

        // Days
        if (seconds >= 86400) {
            this.value = round(seconds / 86400);
            this.unit  = 'day';
        }

        // Hours
        else if (seconds >= 3600) {
            this.value = round(seconds / 3600);
            this.unit  = 'hour';
        }

        // Minutes
        else if (seconds >= 60) {
            this.value = round(seconds / 60);
            this.unit  = 'minute';
        }
        
        // Seconds
        else {

            /**
             * The number of seconds (or minutes, or hours, etc.) that the
             * connection was used. The units associated with this value are
             * represented by the unit property.
             *
             * @type Number
             */
            this.value = round(seconds);

            /**
             * The units associated with the value of this duration. Valid
             * units are 'second', 'minute', 'hour', and 'day'.
             *
             * @type String
             */
            this.unit = 'second';

        }

    };

    return ConnectionHistoryEntry;

}]);
