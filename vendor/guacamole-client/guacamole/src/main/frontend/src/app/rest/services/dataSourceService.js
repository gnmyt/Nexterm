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
 * Service which contains all REST API response caches.
 */
angular.module('rest').factory('dataSourceService', ['$injector',
        function dataSourceService($injector) {

    // Required types
    var Error = $injector.get('Error');

    // Required services
    var $q             = $injector.get('$q');
    var requestService = $injector.get('requestService');

    // Service containing all caches
    var service = {};

    /**
     * Invokes the given function once for each of the given data sources,
     * passing that data source as the first argument to each invocation,
     * followed by any additional arguments passed to apply(). The results of
     * each invocation are aggregated into a map by data source identifier,
     * and handled through a single promise which is resolved or rejected
     * depending on the success/failure of each resulting REST call. Any error
     * results in rejection of the entire apply() operation, except 404 ("NOT
     * FOUND") errors, which are ignored.
     *
     * @param {Function} fn
     *     The function to call for each of the given data sources. The data
     *     source identifier will be given as the first argument, followed by
     *     the rest of the arguments given to apply(), in order. The function
     *     must return a Promise which is resolved or rejected depending on the
     *     result of the REST call.
     *
     * @param {String[]} dataSources
     *     The array or data source identifiers against which the given
     *     function should be called.
     *
     * @param {...*} args
     *     Any additional arguments to pass to the given function each time it
     *     is called.
     *
     * @returns {Promise.<Object.<String, *>>}
     *     A Promise which resolves with a map of data source identifier to
     *     corresponding result. The result will be the exact object or value
     *     provided as the resolution to the Promise returned by calls to the
     *     given function.
     */
    service.apply = function apply(fn, dataSources) {

        var deferred = $q.defer();

        var requests = [];
        var results = {};

        // Build array of arguments to pass to the given function
        var args = [];
        for (var i = 2; i < arguments.length; i++)
            args.push(arguments[i]);

        // Retrieve the root group from all data sources
        angular.forEach(dataSources, function invokeAgainstDataSource(dataSource) {

            // Add promise to list of pending requests
            var deferredRequest = $q.defer();
            requests.push(deferredRequest.promise);

            // Retrieve root group from data source
            fn.apply(this, [dataSource].concat(args))

            // Store result on success
            .then(function immediateRequestSucceeded(data) {
                results[dataSource] = data;
                deferredRequest.resolve();
            },

            // Fail on any errors (except "NOT FOUND")
            requestService.createErrorCallback(function immediateRequestFailed(error) {

                if (error.type === Error.Type.NOT_FOUND)
                    deferredRequest.resolve();

                // Explicitly abort for all other errors
                else
                    deferredRequest.reject(error);

            }));

        });

        // Resolve if all requests succeed
        $q.all(requests).then(function requestsSucceeded() {
            deferred.resolve(results);
        },

        // Reject if at least one request fails
        requestService.createErrorCallback(function requestFailed(error) {
            deferred.reject(error);
        }));

        return deferred.promise;

    };

    return service;

}]);
