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
 * Service which defines the UserCredentials class.
 */
angular.module('rest').factory('UserCredentials', ['$injector', function defineUserCredentials($injector) {

    // Required services
    var $window = $injector.get('$window');

    // Required types
    var Field = $injector.get('Field');

    /**
     * The object returned by REST API calls to define a full set of valid
     * credentials, including field definitions and corresponding expected
     * values.
     *
     * @constructor
     * @param {UserCredentials|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     UserCredentials.
     */
    var UserCredentials = function UserCredentials(template) {

        // Use empty object by default
        template = template || {};

        /**
         * Any parameters which should be provided when these credentials are
         * submitted. If no such information is available, this will be null.
         *
         * @type Field[]
         */
        this.expected = template.expected;

        /**
         * A map of all field values by field name. The fields having the names
         * used within this map should be defined within the @link{Field} array
         * stored under the @link{expected} property.
         *
         * @type Object.<String, String>
         */
        this.values = template.values;

    };

    /**
     * Generates a query string containing all QUERY_PARAMETER fields from the
     * given UserCredentials object, along with their corresponding values. The
     * parameter names and values will be appropriately URL-encoded and
     * separated by ampersands.
     *
     * @param {UserCredentials} userCredentials
     *     The UserCredentials to retrieve all query parameters from.
     *
     * @returns {String}
     *     A string containing all QUERY_PARAMETER fields as name/value pairs
     *     separated by ampersands, where each name is separated by the value
     *     by an equals sign.
     */
    UserCredentials.getQueryParameters = function getQueryParameters(userCredentials) {

        // Build list of parameter name/value pairs
        var parameters = [];
        angular.forEach(userCredentials.expected, function addQueryParameter(field) {

            // Only add query parameters
            if (field.type !== Field.Type.QUERY_PARAMETER)
                return;

            // Pull parameter name and value
            var name = field.name;
            var value = userCredentials.values[name];

            // Properly encode name/value pair
            parameters.push(encodeURIComponent(name) + '=' + encodeURIComponent(value));

        });

        // Separate each name/value pair by an ampersand
        return parameters.join('&');

    };

    /**
     * Returns a fully-qualified, absolute URL to Guacamole prepopulated with
     * any query parameters dictated by the QUERY_PARAMETER fields defined in
     * the given UserCredentials.
     *
     * @param {UserCredentials} userCredentials
     *     The UserCredentials to retrieve all query parameters from.
     *
     * @returns {String}
     *     A fully-qualified, absolute URL to Guacamole prepopulated with the
     *     query parameters dictated by the given UserCredentials.
     */
    UserCredentials.getLink = function getLink(userCredentials) {

        // Work-around for IE missing window.location.origin
        if (!$window.location.origin)
            var linkOrigin = $window.location.protocol + '//' + $window.location.hostname + ($window.location.port ? (':' + $window.location.port) : '');
        else
            var linkOrigin = $window.location.origin;

        // Build base link
        var link = linkOrigin
                 + $window.location.pathname
                 + '#/';

        // Add any required parameters
        var params = UserCredentials.getQueryParameters(userCredentials);
        if (params)
            link += '?' + params;

        return link;

    };

    return UserCredentials;

}]);
