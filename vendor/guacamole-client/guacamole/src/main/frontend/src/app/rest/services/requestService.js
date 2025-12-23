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
 * Service for converting $http promises that pass the entire response into
 * promises that pass only the data from that response.
 */
angular.module('rest').factory('requestService', ['$injector',
        function requestService($injector) {

    // Required services
    var $http      = $injector.get('$http');
    var $log       = $injector.get('$log');
    var $rootScope = $injector.get('$rootScope');

    // Required types
    var Error = $injector.get('Error');

    /**
     * Given a configuration object formatted for the $http service, returns
     * a promise that will resolve or reject with the data from the HTTP
     * response. If the promise is rejected due to the HTTP response indicating
     * failure, the promise will be rejected strictly with an instance of an
     * @link{Error} object.
     *
     * @param {Object} object
     *   Configuration object for $http service call.
     *
     * @returns {Promise.<Object>}
     *   A promise that will resolve with the data from the HTTP response for
     *   the underlying $http call if successful, or reject with an @link{Error}
     *   describing the failure.
     */
    var service = function wrapHttpServiceCall(object) {
        return $http(object).then(
            function success(response) { return response.data; },
            function failure(response) {

                // Wrap true error responses from $http within REST Error objects
                if (response.data)
                    throw new Error(response.data);

                // Fall back to a generic internal error if the request couldn't
                // even be issued (webapp is down, etc.)
                else if ('data' in response)
                    throw new Error({ message : 'Unknown failure sending HTTP request' });

                // The value provided is not actually a response object from
                // the $http service
                throw response;

            }
        );
    };

    /**
     * Creates a promise error callback which invokes the given callback only
     * if the promise was rejected with a REST @link{Error} object. If the
     * promise is rejected without an @link{Error} object, such as when a
     * JavaScript error occurs within a callback earlier in the promise chain,
     * the rejection is logged without invoking the given callback.
     *
     * @param {Function} callback
     *     The callback to invoke if the promise is rejected with an
     *     @link{Error} object.
     *
     * @returns {Function}
     *     A function which can be provided as the error callback for a
     *     promise.
     */
    service.createErrorCallback = function createErrorCallback(callback) {
        return (function generatedErrorCallback(error) {

            // Invoke given callback ONLY if due to a legitimate REST error
            if (error instanceof Error)
                return callback(error);

            // Log all other errors
            $log.error(error);

        });
    };

    /**
     * Creates a promise error callback which resolves the promise with the
     * given default value only if the @link{Error} in the original rejection
     * is a NOT_FOUND error. All other errors are passed through and must be
     * handled as yet more rejections.
     *
     * @param {*} value
     *     The default value to use to resolve the promise if the promise is
     *     rejected with a NOT_FOUND error.
     *
     * @returns {Function}
     *     A function which can be provided as the error callback for a
     *     promise.
     */
    service.defaultValue = function defaultValue(value) {
        return service.createErrorCallback(function resolveIfNotFound(error) {

            // Return default value only if not found
            if (error.type === Error.Type.NOT_FOUND)
                return value;

            // Reject promise with original error otherwise
            throw error;

        });
    };

    /**
     * Promise error callback which ignores all rejections due to REST errors,
     * but logs all other rejections, such as those due to JavaScript errors.
     * This callback should be used in favor of angular.noop in cases where
     * a REST response is being handled but REST errors should be ignored.
     *
     * @constant
     * @type Function
     */
    service.IGNORE = service.createErrorCallback(angular.noop);

    /**
     * Promise error callback which logs all rejections due to REST errors as
     * warnings to the browser console, and logs all other rejections as
     * errors. This callback should be used in favor of angular.noop or
     * @link{IGNORE} if REST errors are simply not expected.
     *
     * @constant
     * @type Function
     */
    service.WARN = service.createErrorCallback(function warnRequestFailed(error) {
        $log.warn(error.type, error.message || error.translatableMessage);
    });

    /**
     * Promise error callback which replaces the content of the page with a
     * generic error message warning that the page could not be displayed. All
     * rejections are logged to the browser console as errors. This callback
     * should be used in favor of @link{WARN} if REST errors will result in the
     * page being unusable.
     *
     * @constant
     * @type Function
     */
    service.DIE = service.createErrorCallback(function fatalPageError(error) {
        $rootScope.$broadcast('guacFatalPageError', error);
        $log.error(error.type, error.message || error.translatableMessage);
    });

    return service;

}]);
