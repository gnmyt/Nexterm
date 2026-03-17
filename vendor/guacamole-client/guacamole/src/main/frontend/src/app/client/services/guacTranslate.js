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
 * A wrapper around the angular-translate $translate service that offers a
 * convenient way to fall back to a default translation if the requested
 * translation is not available.
 */
 angular.module('client').factory('guacTranslate', ['$injector', function guacTranslate($injector) {

    // Required services
    const $q = $injector.get('$q');
    const $translate = $injector.get('$translate');

    // Required types
    const TranslationResult = $injector.get('TranslationResult');

    /**
     * Returns a promise that will be resolved with a TranslationResult containg either the
     * requested ID and message (if translated), or the default ID and message if translated,
     * or the literal value of `defaultTranslationId` for both the ID and message if neither
     * is translated.
     *
     * @param {String} translationId
     *     The requested translation ID, which may or may not be translated.
     *
     * @param {Sting} defaultTranslationId
     *     The translation ID that will be used if no translation is found for `translationId`.
     *
     * @returns {Promise.<TranslationResult>}
     *     A promise which resolves with a TranslationResult containing the results from
     *     the translation attempt.
     */
    var translateWithFallback = function translateWithFallback(translationId, defaultTranslationId) {
        const deferredTranslation = $q.defer();

        // Attempt to translate the requested translation ID
        $translate(translationId).then(

            // If the requested translation is available, use that
            translation => deferredTranslation.resolve(new TranslationResult({
                id: translationId, message: translation
            })),

            // Otherwise, try the default translation ID
            () => $translate(defaultTranslationId).then(

                // Default translation worked, so use that
                defaultTranslation =>
                    deferredTranslation.resolve(new TranslationResult({
                        id: defaultTranslationId, message: defaultTranslation
                    })),

                // Neither translation is available; as a fallback, return default ID for both
                () => deferredTranslation.resolve(new TranslationResult({
                    id: defaultTranslationId, message: defaultTranslationId
                })),
            )
        );

        return deferredTranslation.promise;
    };

    return translateWithFallback;

}]);
