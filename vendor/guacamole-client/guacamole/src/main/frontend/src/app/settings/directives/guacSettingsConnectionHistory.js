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
 * A directive for viewing connection history records.
 */
angular.module('settings').directive('guacSettingsConnectionHistory', [function guacSettingsConnectionHistory() {
        
    return {
        // Element only
        restrict: 'E',
        replace: true,

        scope: {
        },

        templateUrl: 'app/settings/templates/settingsConnectionHistory.html',
        controller: ['$scope', '$injector', function settingsConnectionHistoryController($scope, $injector) {
                
            // Get required types
            var ConnectionHistoryEntryWrapper = $injector.get('ConnectionHistoryEntryWrapper');
            var FilterToken                   = $injector.get('FilterToken');
            var SortOrder                     = $injector.get('SortOrder');

            // Get required services
            var $filter        = $injector.get('$filter');
            var $routeParams   = $injector.get('$routeParams');
            var $translate     = $injector.get('$translate');
            var csvService     = $injector.get('csvService');
            var historyService = $injector.get('historyService');
            var requestService = $injector.get('requestService');

            /**
             * The identifier of the currently-selected data source.
             *
             * @type String
             */
            $scope.dataSource = $routeParams.dataSource;

            /**
             * All wrapped matching connection history entries, or null if these
             * entries have not yet been retrieved.
             *
             * @type ConnectionHistoryEntryWrapper[]
             */
            $scope.historyEntryWrappers = null;

            /**
             * The search terms to use when filtering the history records.
             *
             * @type String
             */
            $scope.searchString = '';

            /**
             * The date format for use for start/end dates.
             *
             * @type String
             */
            $scope.dateFormat = null;

            /**
             * SortOrder instance which stores the sort order of the history
             * records.
             *
             * @type SortOrder
             */
            $scope.order = new SortOrder([
                '-entry.startDate',
                '-duration',
                'entry.username',
                'entry.connectionName',
                'entry.remoteHost'
            ]);

            /**
             * The names of sortable properties supported by the REST API that
             * correspond to the properties that may be stored within
             * $scope.order.
             *
             * @type {!Object.<string, string>}
             */
            const apiSortProperties = {
                 'entry.startDate' :  'startDate',
                '-entry.startDate' : '-startDate'
            };

            /**
             * Converts the given sort predicate to a correponding array of
             * sortable properties supported by the REST API. Any properties
             * within the predicate that are not supported will be dropped.
             *
             * @param {!string[]} predicate
             *     The sort predicate to convert, as exposed by the predicate
             *     property of SortOrder.
             *
             * @returns {!string[]}
             *     A corresponding array of sortable properties, omitting any
             *     properties not supported by the REST API.
             */
            var toAPISortPredicate = function toAPISortPredicate(predicate) {
                return predicate
                        .map((name) => apiSortProperties[name])
                        .filter((name) => !!name);
            };

            // Get session date format
            $translate('SETTINGS_CONNECTION_HISTORY.FORMAT_DATE')
            .then(function dateFormatReceived(retrievedDateFormat) {

                // Store received date format
                $scope.dateFormat = retrievedDateFormat;

            }, angular.noop);
            
            /**
             * Returns true if the connection history records have been loaded,
             * indicating that information needed to render the page is fully 
             * loaded.
             * 
             * @returns {Boolean} 
             *     true if the history records have been loaded, false
             *     otherwise.
             * 
             */
            $scope.isLoaded = function isLoaded() {
                return $scope.historyEntryWrappers !== null
                    && $scope.dateFormat           !== null;
            };

            /**
             * Returns whether the search has completed but contains no history
             * records. This function will return false if there are history
             * records in the results OR if the search has not yet completed.
             *
             * @returns {Boolean}
             *     true if the search results have been loaded but no history
             *     records are present, false otherwise.
             */
            $scope.isHistoryEmpty = function isHistoryEmpty() {
                return $scope.isLoaded() && $scope.historyEntryWrappers.length === 0;
            };

            /**
             * Query the API for the connection record history, filtered by 
             * searchString, and ordered by order.
             */
            $scope.search = function search() {

                // Clear current results
                $scope.historyEntryWrappers = null;

                // Tokenize search string
                var tokens = FilterToken.tokenize($scope.searchString);

                // Transform tokens into list of required string contents
                var requiredContents = [];
                angular.forEach(tokens, function addRequiredContents(token) {

                    // Transform depending on token type
                    switch (token.type) {

                        // For string literals, use parsed token value
                        case 'LITERAL':
                            requiredContents.push(token.value);

                        // Ignore whitespace
                        case 'WHITESPACE':
                            break;

                        // For all other token types, use the relevant portion
                        // of the original search string
                        default:
                            requiredContents.push(token.consumed);

                    }

                });

                // Fetch history records
                historyService.getConnectionHistory(
                    $scope.dataSource,
                    requiredContents,
                    toAPISortPredicate($scope.order.predicate)
                )
                .then(function historyRetrieved(historyEntries) {

                    // Wrap all history entries for sake of display
                    $scope.historyEntryWrappers = [];
                    angular.forEach(historyEntries, function wrapHistoryEntry(historyEntry) {
                       $scope.historyEntryWrappers.push(new ConnectionHistoryEntryWrapper($scope.dataSource, historyEntry)); 
                    });

                }, requestService.DIE);

            };
            
            /**
             * Initiates a download of a CSV version of the displayed history
             * search results.
             */
            $scope.downloadCSV = function downloadCSV() {

                // Translate CSV header
                $translate([
                    'SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_USERNAME',
                    'SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_STARTDATE',
                    'SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_DURATION',
                    'SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_CONNECTION_NAME',
                    'SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_REMOTEHOST',
                    'SETTINGS_CONNECTION_HISTORY.FILENAME_HISTORY_CSV'
                ]).then(function headerTranslated(translations) {

                    // Initialize records with translated header row
                    var records = [[
                        translations['SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_USERNAME'],
                        translations['SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_STARTDATE'],
                        translations['SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_DURATION'],
                        translations['SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_CONNECTION_NAME'],
                        translations['SETTINGS_CONNECTION_HISTORY.TABLE_HEADER_SESSION_REMOTEHOST']
                    ]];

                    // Add rows for all history entries, using the same sort
                    // order as the displayed table
                    angular.forEach(
                        $filter('orderBy')(
                            $scope.historyEntryWrappers,
                            $scope.order.predicate
                        ),
                        function pushRecord(historyEntryWrapper) {
                            records.push([
                                historyEntryWrapper.entry.username,
                                $filter('date')(historyEntryWrapper.entry.startDate, $scope.dateFormat),
                                historyEntryWrapper.duration / 1000,
                                historyEntryWrapper.entry.connectionName,
                                historyEntryWrapper.entry.remoteHost
                            ]);
                        }
                    );

                    // Save the result
                    saveAs(csvService.toBlob(records), translations['SETTINGS_CONNECTION_HISTORY.FILENAME_HISTORY_CSV']);

                }, angular.noop);

            };

            // Initialize search results
            $scope.search();
            
        }]
    };
    
}]);
