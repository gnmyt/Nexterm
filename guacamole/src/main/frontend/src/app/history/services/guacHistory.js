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
 * A service for reading and manipulating the Guacamole connection history.
 */
angular.module('history').factory('guacHistory', ['$injector',
        function guacHistory($injector) {

    // Required types
    var HistoryEntry = $injector.get('HistoryEntry');

    // Required services
    var localStorageService = $injector.get('localStorageService');
    var preferenceService   = $injector.get('preferenceService');

    var service = {};

    // The parameter name for getting the history from local storage
    var GUAC_HISTORY_STORAGE_KEY = "GUAC_HISTORY";

    /**
     * The top few recent connections, sorted in order of most recent access.
     * 
     * @type HistoryEntry[]
     */
    service.recentConnections = [];

    /**
     * Remove from the list of connection history the item having the given
     * identfier.
     * 
     * @param {String} id
     *     The identifier of the item to remove from the history list.
     *     
     * @returns {boolean}
     *     True if the removal was successful, otherwise false.
     */
    service.removeEntry = function removeEntry(id) {
    
        return _.remove(service.recentConnections, entry => entry.id === id).length > 0;
    
    };

    /**
     * Updates the thumbnail and access time of the history entry for the
     * connection with the given ID.
     * 
     * @param {String} id
     *     The ID of the connection whose history entry should be updated.
     * 
     * @param {String} thumbnail
     *     The URL of the thumbnail image to associate with the history entry.
     */
    service.updateThumbnail = function(id, thumbnail) {

        var i;

        // Remove any existing entry for this connection
        for (i=0; i < service.recentConnections.length; i++) {
            if (service.recentConnections[i].id === id) {
                service.recentConnections.splice(i, 1);
                break;
            }
        }

        // Store new entry in history
        service.recentConnections.unshift(new HistoryEntry(
            id,
            thumbnail,
            new Date().getTime()
        ));

        // Truncate history to ideal length
        if (service.recentConnections.length > preferenceService.preferences.numberOfRecentConnections)
            service.recentConnections.length = preferenceService.preferences.numberOfRecentConnections;

        // Save updated history
        localStorageService.setItem(GUAC_HISTORY_STORAGE_KEY, service.recentConnections);

    };

    // Init stored connection history from localStorage
    var storedHistory = localStorageService.getItem(GUAC_HISTORY_STORAGE_KEY) || [];
    if (storedHistory instanceof Array)
        service.recentConnections = storedHistory;

    return service;

}]);
