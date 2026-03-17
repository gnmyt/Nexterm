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
 * A service for defining the FilterToken class.
 */
angular.module('list').factory('FilterToken', ['$injector',
    function defineFilterToken($injector) {

    // Required types
    var IPv4Network = $injector.get('IPv4Network');
    var IPv6Network = $injector.get('IPv6Network');

    /**
     * An arbitrary token having an associated type and value.
     *
     * @constructor
     * @param {String} consumed
     *     The input string consumed to produce this token.
     *
     * @param {String} type
     *     The type of this token. Each legal type name is a property within
     *     FilterToken.Types.
     *
     * @param {Object} value
     *     The value of this token. The type of this value is determined by
     *     the token type.
     */
    var FilterToken = function FilterToken(consumed, type, value) {

        /**
         * The input string that was consumed to produce this token.
         *
         * @type String
         */
        this.consumed = consumed;

        /**
         * The type of this token. Each legal type name is a property within
         * FilterToken.Types.
         *
         * @type String
         */
        this.type = type;

        /**
         * The value of this token.
         *
         * @type Object
         */
        this.value = value;

    };

    /**
     * All legal token types, and corresponding functions which match them.
     * Each function returns the parsed token, or null if no such token was
     * found.
     *
     * @type Object.<String, Function>
     */
    FilterToken.Types = {

        /**
         * An IPv4 address or subnet. The value of an IPV4_NETWORK token is an
         * IPv4Network.
         */
        IPV4_NETWORK: function parseIPv4(str) {

            var pattern = /^\S+/;

            // Read first word via regex
            var matches = pattern.exec(str);
            if (!matches)
                return null;

            // Validate and parse as IPv4 address
            var network = IPv4Network.parse(matches[0]);
            if (!network)
                return null;

            return new FilterToken(matches[0], 'IPV4_NETWORK', network);

        },

        /**
         * An IPv6 address or subnet. The value of an IPV6_NETWORK token is an
         * IPv6Network.
         */
        IPV6_NETWORK: function parseIPv6(str) {

            var pattern = /^\S+/;

            // Read first word via regex
            var matches = pattern.exec(str);
            if (!matches)
                return null;

            // Validate and parse as IPv6 address
            var network = IPv6Network.parse(matches[0]);
            if (!network)
                return null;

            return new FilterToken(matches[0], 'IPV6_NETWORK', network);

        },

        /**
         * A string literal, which may be quoted. The value of a LITERAL token
         * is a String.
         */
        LITERAL: function parseLiteral(str) {

            var pattern = /^"([^"]*)"|^\S+/;

            // Validate against pattern
            var matches = pattern.exec(str);
            if (!matches)
                return null;

            // If literal is quoted, parse within the quotes
            if (matches[1])
                return new FilterToken(matches[0], 'LITERAL', matches[1]);

            //  Otherwise, literal is unquoted
            return new FilterToken(matches[0], 'LITERAL', matches[0]);

        },

        /**
         * Arbitrary contiguous whitespace. The value of a WHITESPACE token is
         * a String.
         */
        WHITESPACE: function parseWhitespace(str) {

            var pattern = /^\s+/;

            // Validate against pattern
            var matches = pattern.exec(str);
            if (!matches)
                return null;

            //  Generate token from matching whitespace
            return new FilterToken(matches[0], 'WHITESPACE', matches[0]);

        }

    };

    /**
     * Tokenizes the given string, returning an array of tokens. Whitespace
     * tokens are dropped.
     *
     * @param {String} str
     *     The string to tokenize.
     *
     * @returns {FilterToken[]}
     *     All tokens identified within the given string, in order.
     */
    FilterToken.tokenize = function tokenize(str) {

        var tokens = [];

        /**
         * Returns the first token on the current string, removing the token
         * from that string.
         *
         * @returns FilterToken
         *     The first token on the string, or null if no tokens match.
         */
        var popToken = function popToken() {

            // Attempt to find a matching token
            for (var type in FilterToken.Types) {

                // Get matching function for current type
                var matcher = FilterToken.Types[type];

                // If token matches, return the matching group
                var token = matcher(str);
                if (token) {
                    str = str.substring(token.consumed.length);
                    return token;
                }

            }

            // No match
            return null;

        };

        // Tokenize input until no input remains
        while (str) {

            // Remove first token
            var token = popToken();
            if (!token)
                break;

            // Add token to tokens array, if not whitespace
            if (token.type !== 'WHITESPACE')
                tokens.push(token);

        }

        return tokens;

    };

    return FilterToken;

}]);