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
 * Service which defines the ParseError class.
 */
angular.module('import').factory('ParseError', [function defineParseError() {

    /**
     * An error representing a parsing failure when attempting to convert
     * user-provided data into a list of Connection objects.
     *
     * @constructor
     * @param {ParseError|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ParseError.
     */
    const ParseError = function ParseError(template) {

        // Use empty object by default
        template = template || {};

        /**
         * A human-readable message describing the error that occurred.
         *
         * @type String
         */
        this.message = template.message;

        /**
         * The key associated with the translation string that used when
         * displaying this message.
         *
         * @type String
         */
        this.key = template.key;

        /**
         * The object which should be passed through to the translation service
         * for the sake of variable substitution. Each property of the provided
         * object will be substituted for the variable of the same name within
         * the translation string.
         *
         * @type Object
         */
        this.variables = template.variables;

        // If no translation key is available, fall back to the untranslated
        // key, passing the raw message directly through the translation system
        if (!this.key) {
            this.key = 'APP.TEXT_UNTRANSLATED';
            this.variables = { MESSAGE: this.message };
        }

    };

    return ParseError;

}]);
