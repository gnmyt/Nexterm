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
 * Provides the TranslationResult class used by the guacTranslate service. This class contains
 * both the translated message and the translation ID that generated the message, in the case
 * where it's unknown whether a translation is defined or not.
 */
 angular.module('client').factory('TranslationResult', [function defineTranslationResult() {

    /**
     * Object which represents the result of a translation as returned from
     * the guacTranslate service.
     *
     * @constructor
     * @param {TranslationResult|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     TranslationResult.
     */
    const TranslationResult = function TranslationResult(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The translation ID.
         *
         * @type {String}
         */
        this.id = template.id;

        /**
         * The translated message.
         *
         * @type {String}
         */
        this.message = template.message;

    };

    return TranslationResult;

}]);