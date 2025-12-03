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

/* global _ */

/**
 * A directive that displays errors that occurred during parsing of a connection
 * import file, or errors that were returned from the API during the connection
 * batch creation attempt.
 */
angular.module('import').directive('connectionImportErrors', [
        function connectionImportErrors() {

    const directive = {
        restrict: 'E',
        replace: true,
        templateUrl: 'app/import/templates/connectionErrors.html',
        scope: {

            /**
             * The result of parsing the import file. Any errors in this file
             * will be displayed to the user.
             *
             * @type ParseResult
             */
            parseResult : '=',

            /**
             * The error associated with an attempt to batch create the
             * connections represented by the ParseResult, if the ParseResult
             * had no errors. If the provided ParseResult has errors, no request
             * should have been made, and any provided patch error will be
             * ignored.
             *
             * @type Error
             */
            patchFailure : '=',

        }
    };

    directive.controller = ['$scope', '$injector',
            function connectionImportErrorsController($scope, $injector) {

        // Required types
        const DirectoryPatch        = $injector.get('DirectoryPatch');
        const DisplayErrorList      = $injector.get('DisplayErrorList');
        const ImportConnectionError = $injector.get('ImportConnectionError');
        const ParseError            = $injector.get('ParseError');
        const SortOrder             = $injector.get('SortOrder');

        // Required services
        const $q                    = $injector.get('$q');
        const $translate            = $injector.get('$translate');

        // There are errors to display if the parse result generated errors, or
        // if the patch request failed
        $scope.hasErrors = () =>
            !!_.get($scope, 'parseResult.hasErrors') || !!$scope.patchFailure;

        /**
         * All connections with their associated errors for display. These may
         * be either parsing failures, or errors returned from the API. Both
         * error types will be adapted to a common display format, though the
         * error types will never be mixed, because no REST request should ever
         * be made if there are client-side parse errors.
         *
         * @type {ImportConnectionError[]}
         */
        $scope.connectionErrors = [];

        /**
         * SortOrder instance which maintains the sort order of the visible
         * connection errors.
         *
         * @type SortOrder
         */
        $scope.errorOrder = new SortOrder([
            'rowNumber',
            'name',
            'group',
            'protocol',
            'errors',
        ]);

        /**
         * Array of all connection error properties that are filterable.
         *
         * @type String[]
         */
        $scope.filteredErrorProperties = [
            'rowNumber',
            'name',
            'group',
            'protocol',
            'errors',
        ];

        /**
         * Generate a ImportConnectionError representing any errors associated
         * with the row at the given index within the given parse result.
         *
         * @param {ParseResult} parseResult
         *     The result of parsing the connection import file.
         *
         * @param {Integer} index
         *     The current row within the patches array, 0-indexed.
         *
         * @param {Integer} row
         *     The current row within the original connection, 0-indexed.
         *     If any REMOVE patches are present, this may be greater than
         *     the index.
         *
         * @returns {ImportConnectionError}
         *     The connection error object associated with the given row in the
         *     given parse result.
         */
        const generateConnectionError = (parseResult, index, row) => {

            // Get the patch associated with the current row
            const patch = parseResult.patches[index];

            // The value of a patch is just the Connection object
            const connection = patch.value;

            return new ImportConnectionError({

                // Add 1 to the provided row to get the position in the file
                rowNumber: row + 1,

                // Basic connection information - name, group, and protocol.
                name: connection.name,
                group: parseResult.groupPaths[index],
                protocol: connection.protocol,

                // The human-readable error messages
                errors: new DisplayErrorList(
                        [ ...(parseResult.errors[index] || []) ])
            });
        };

        // If a new connection patch failure is seen, update the display list
        $scope.$watch('patchFailure', function patchFailureChanged(patchFailure) {

            const { parseResult } = $scope;

            // Do not attempt to process anything before the data has loaded
            if (!patchFailure || !parseResult)
                return;

            // All promises from all translation requests. The scope will not be
            // updated until all translations are ready.
            const translationPromises = [];

            // Any error returned from the API specifically associated with the
            // preceding REMOVE patch
            let removeError = null;

            // Fetch the API error, if any, of the patch at the given index
            const getAPIError = index =>
                    _.get(patchFailure, ['patches', index, 'error']);

            // The row number for display. Unlike the index, this number will
            // skip any REMOVE patches. In other words, this is the index of
            // connections within the original import file.
            let row = 0;

            // Set up the list of connection errors based on the existing parse
            // result, with error messages fetched from the patch failure
            const connectionErrors = parseResult.patches.reduce(
                    (errors, patch, index) => {

                // Do not process display REMOVE patches - they are always
                // followed by ADD patches containing the actual content
                // (and errors, if any)
                if (patch.op === DirectoryPatch.Operation.REMOVE) {

                    // Save the API error, if any, so it can be displayed
                    // alongside the connection information associated with the
                    // following ADD patch
                    removeError = getAPIError(index);

                    // Do not add an entry for this remove patch - it should
                    // always be followed by a corresponding CREATE patch
                    // containing the relevant connection information
                    return errors;
                    
                }

                // Generate a connection error for display
                const connectionError = generateConnectionError(
                        parseResult, index, row++);

                // Add the error associated with the previous REMOVE patch, if
                // any, to the error associated with the current patch, if any
                const apiErrors = [ removeError, getAPIError(index) ];

                // Clear the previous REMOVE patch error after consuming it
                removeError = null;

                // Go through each potential API error
                apiErrors.forEach(error =>

                    // If the API error exists, fetch the translation and
                    // update it when it's ready
                    error && translationPromises.push($translate(
                        error.key, error.variables)
                        .then(translatedError =>
                            connectionError.errors.getArray().push(translatedError)
                        )));

                errors.push(connectionError);
                return errors;
                
            }, []);

            // Once all the translations have been completed, update the
            // connectionErrors all in one go, to ensure no excessive reloading
            $q.all(translationPromises).then(() => {
                $scope.connectionErrors = connectionErrors;
            });
            
        });

        // If a new parse result with errors is seen, update the display list
        $scope.$watch('parseResult', function parseResultChanged(parseResult) {

            // Do not process if there are no errors in the provided result
            if (!parseResult || !parseResult.hasErrors)
                return;

            // All promises from all translation requests. The scope will not be
            // updated until all translations are ready.
            const translationPromises = [];

            // The parse result should only be updated on a fresh file import;
            // therefore it should be safe to skip checking the patch errors
            // entirely - if set, they will be from the previous file and no
            // longer relevant.

            // The row number for display. Unlike the index, this number will
            // skip any REMOVE patches. In other words, this is the index of
            // connections within the original import file.
            let row = 0;

            // Set up the list of connection errors based on the updated parse
            // result
            const connectionErrors = parseResult.patches.reduce(
                    (errors, patch, index) => {

                // Do not process display REMOVE patches - they are always
                // followed by ADD patches containing the actual content
                // (and errors, if any)
                if (patch.op === DirectoryPatch.Operation.REMOVE)
                    return errors;

                // Generate a connection error for display
                const connectionError = generateConnectionError(
                        parseResult, index, row++);

                // Go through the errors and check if any are translateable
                connectionError.errors.getArray().forEach(
                        (error, errorIndex) => {

                    // If this error is a ParseError, it can be translated.
                    // NOTE: Generally one would translate error messages in the
                    // template, but in this case, the connection errors need to
                    // be raw strings in order to enable sorting and filtering.
                    if (error instanceof ParseError)

                        // Fetch the translation and update it when it's ready
                        translationPromises.push($translate(
                            error.key, error.variables)
                            .then(translatedError => {
                                connectionError.errors.getArray()[errorIndex] = translatedError;
                            }));

                    // If the error is not a known translatable type, add the
                    // message directly to the error array
                    else
                         connectionError.errors.getArray()[errorIndex] = (
                             error.message ? error.message : error);

                });

                errors.push(connectionError);
                return errors;

            }, []);

            // Once all the translations have been completed, update the
            // connectionErrors all in one go, to ensure no excessive reloading
            $q.all(translationPromises).then(() => {
                $scope.connectionErrors = connectionErrors;
            });

        });

    }];

    return directive;

}]);
