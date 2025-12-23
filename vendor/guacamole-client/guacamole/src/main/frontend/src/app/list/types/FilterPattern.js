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
 * A service for defining the FilterPattern class.
 */
angular.module('list').factory('FilterPattern', ['$injector',
    function defineFilterPattern($injector) {

    // Required types
    var FilterToken = $injector.get('FilterToken');
    var IPv4Network = $injector.get('IPv4Network');
    var IPv6Network = $injector.get('IPv6Network');

    // Required services
    var $parse = $injector.get('$parse');

    /**
     * Object which handles compilation of filtering predicates as used by
     * the Angular "filter" filter. Predicates are compiled from a user-
     * specified search string.
     *
     * @constructor
     * @param {String[]} expressions 
     *     The Angular expressions whose values are to be filtered.
     */
    var FilterPattern = function FilterPattern(expressions) {

        /**
         * Reference to this instance.
         *
         * @type FilterPattern
         */
        var filterPattern = this;

        /**
         * Filter predicate which simply matches everything. This function
         * always returns true.
         *
         * @returns {Boolean}
         *     true.
         */
        var nullPredicate = function nullPredicate() {
            return true;
        };

        /**
         * Array of getters corresponding to the Angular expressions provided
         * to the constructor of this class. The functions returns are those
         * produced by the $parse service.
         *
         * @type Function[]
         */
        var getters = [];

        // Parse all expressions
        angular.forEach(expressions, function parseExpression(expression) {
            getters.push($parse(expression));
        });

        /**
         * Determines whether the given object contains properties that match
         * the given string, according to the provided getters.
         * 
         * @param {Object} object
         *     The object to match against.
         * 
         * @param {String} str
         *     The string to match.
         *
         * @returns {Boolean}
         *     true if the object matches the given string, false otherwise. 
         */
        var matchesString = function matchesString(object, str) {

            // For each defined getter
            for (var i=0; i < getters.length; i++) {

                // Retrieve value of current getter
                var value = getters[i](object);

                // If the value matches the pattern, the whole object matches
                if (String(value).toLowerCase().indexOf(str) !== -1) 
                    return true;

            }

            // No matches found
            return false;

        };

        /**
         * Determines whether the given object contains properties that match
         * the given IPv4 network, according to the provided getters.
         * 
         * @param {Object} object
         *     The object to match against.
         * 
         * @param {IPv4Network} network
         *     The IPv4 network to match.
         *
         * @returns {Boolean}
         *     true if the object matches the given network, false otherwise. 
         */
        var matchesIPv4 = function matchesIPv4(object, network) {

            // For each defined getter
            for (var i=0; i < getters.length; i++) {

                // Test each possible IPv4 address within the string against
                // the given IPv4 network
                var addresses = String(getters[i](object)).split(/[^0-9.]+/);
                for (var j=0; j < addresses.length; j++) {
                    var value = IPv4Network.parse(addresses[j]);
                    if (value && network.contains(value))
                        return true;
                }

            }

            // No matches found
            return false;

        };

        /**
         * Determines whether the given object contains properties that match
         * the given IPv6 network, according to the provided getters.
         * 
         * @param {Object} object
         *     The object to match against.
         * 
         * @param {IPv6Network} network
         *     The IPv6 network to match.
         *
         * @returns {Boolean}
         *     true if the object matches the given network, false otherwise. 
         */
        var matchesIPv6 = function matchesIPv6(object, network) {

            // For each defined getter
            for (var i=0; i < getters.length; i++) {

                // Test each possible IPv6 address within the string against
                // the given IPv6 network
                var addresses = String(getters[i](object)).split(/[^0-9A-Fa-f:]+/);
                for (var j=0; j < addresses.length; j++) {
                    var value = IPv6Network.parse(addresses[j]);
                    if (value && network.contains(value))
                        return true;
                }

            }

            // No matches found
            return false;

        };


        /**
         * Determines whether the given object matches the given filter pattern
         * token.
         *
         * @param {Object} object
         *     The object to match the token against.
         * 
         * @param {FilterToken} token
         *     The token from the tokenized filter pattern to match aginst the
         *     given object.
         *
         * @returns {Boolean}
         *     true if the object matches the token, false otherwise.
         */
        var matchesToken = function matchesToken(object, token) {

            // Match depending on token type
            switch (token.type) {

                // Simple string literal
                case 'LITERAL': 
                    return matchesString(object, token.value);

                // IPv4 network address / subnet
                case 'IPV4_NETWORK': 
                    return matchesIPv4(object, token.value);

                // IPv6 network address / subnet
                case 'IPV6_NETWORK': 
                    return matchesIPv6(object, token.value);

                // Unsupported token type
                default:
                    return false;

            }

        };

        /**
         * The current filtering predicate.
         *
         * @type Function
         */
        this.predicate = nullPredicate;

        /**
         * Compiles the given pattern string, assigning the resulting filter
         * predicate. The resulting predicate will accept only objects that
         * match the given pattern.
         * 
         * @param {String} pattern
         *     The pattern to compile.
         */
        this.compile = function compile(pattern) {

            // If no pattern provided, everything matches
            if (!pattern) {
                filterPattern.predicate = nullPredicate;
                return;
            }
                
            // Tokenize pattern, converting to lower case for case-insensitive matching
            var tokens = FilterToken.tokenize(pattern.toLowerCase());

            // Return predicate which matches against the value of any getter in the getters array
            filterPattern.predicate = function matchesAllTokens(object) {

                // False if any token does not match
                for (var i=0; i < tokens.length; i++) {
                    if (!matchesToken(object, tokens[i]))
                        return false;
                }

                // True if all tokens matched
                return true;

            };
            
        };

    };

    return FilterPattern;

}]);