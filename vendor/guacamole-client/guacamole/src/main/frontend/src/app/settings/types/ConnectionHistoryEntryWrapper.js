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
 * A service for defining the ConnectionHistoryEntryWrapper class.
 */
angular.module('settings').factory('ConnectionHistoryEntryWrapper', ['$injector',
    function defineConnectionHistoryEntryWrapper($injector) {

    // Required types
    const ActivityLog            = $injector.get('ActivityLog');
    const ConnectionHistoryEntry = $injector.get('ConnectionHistoryEntry');

    // Required services
    const $translate = $injector.get('$translate');

    /**
     * Wrapper for ConnectionHistoryEntry which adds display-specific
     * properties, such as a duration.
     *
     * @constructor
     * @param {ConnectionHistoryEntry} historyEntry
     *     The ConnectionHistoryEntry that should be wrapped.
     */
    const ConnectionHistoryEntryWrapper = function ConnectionHistoryEntryWrapper(dataSource, historyEntry) {

        /**
         * The wrapped ConnectionHistoryEntry.
         *
         * @type ConnectionHistoryEntry
         */
        this.entry = historyEntry;

        /**
         * The total amount of time the connection associated with the wrapped
         * history record was open, in seconds.
         *
         * @type Number
         */
        this.duration = historyEntry.endDate - historyEntry.startDate;

        /**
         * An object providing value and unit properties, denoting the duration
         * and its corresponding units.
         *
         * @type ConnectionHistoryEntry.Duration
         */
        this.readableDuration = null;

        // Set the duration if the necessary information is present
        if (historyEntry.endDate && historyEntry.startDate)
            this.readableDuration = new ConnectionHistoryEntry.Duration(this.duration);

        /**
         * The string to display as the duration of this history entry. If a
         * duration is available, its value and unit will be exposed to any
         * given translation string as the VALUE and UNIT substitution
         * variables respectively.
         *
         * @type String
         */
        this.readableDurationText = 'SETTINGS_CONNECTION_HISTORY.TEXT_HISTORY_DURATION';

        // Inform user if end date is not known
        if (!historyEntry.endDate)
            this.readableDurationText = 'SETTINGS_CONNECTION_HISTORY.INFO_CONNECTION_DURATION_UNKNOWN';

        /**
         * The graphical session recording associated with this history entry,
         * if any. If no session recordings are associated with the entry, this
         * will be null. If there are multiple session recordings, this will be
         * the first such recording.
         *
         * @type {ConnectionHistoryEntryWrapper.Log}
         */
        this.sessionRecording = (function getSessionRecording() {

            var identifier = historyEntry.identifier;
            if (!identifier)
                return null;

            var name = _.findKey(historyEntry.logs, log => log.type === ActivityLog.Type.GUACAMOLE_SESSION_RECORDING);
            if (!name)
                return null;

            var log = historyEntry.logs[name];
            return new ConnectionHistoryEntryWrapper.Log({

                url : '#/settings/' + encodeURIComponent(dataSource)
                    + '/recording/' + encodeURIComponent(identifier)
                    + '/' + encodeURIComponent(name),

                description : $translate(log.description.key, log.description.variables)

            });

        })();

    };

    /**
     * Representation of the ActivityLog of a ConnectionHistoryEntry which adds
     * display-specific properties, such as a URL for viewing the log.
     *
     * @param {ConnectionHistoryEntryWrapper.Log|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ConnectionHistoryEntryWrapper.Log.
     */
    ConnectionHistoryEntryWrapper.Log = function Log(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The relative URL for a session recording player that loads the
         * session recording represented by this log.
         *
         * @type {!string}
         */
        this.url = template.url;

        /**
         * A promise that resolves with a human-readable description of the log.
         *
         * @type {!Promise.<string>}
         */
        this.description = template.description;

    };

    return ConnectionHistoryEntryWrapper;

}]);
