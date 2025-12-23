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
 * Service for loading translation definition files, conforming to the
 * angular-translate documentation for custom translation loaders:
 * 
 * https://github.com/angular-translate/angular-translate/wiki/Asynchronous-loading#using-custom-loader-service
 */
angular.module('locale').factory('translationLoader', ['$injector', function translationLoader($injector) {

    // Required services
    var $http           = $injector.get('$http');
    var $q              = $injector.get('$q');
    var cacheService    = $injector.get('cacheService');
    var languageService = $injector.get('languageService');

    /**
     * Satisfies a translation request for the given key by searching for the
     * translation files for each key in the given array, in order. The request
     * fails only if none of the files can be found.
     *
     * @param {Deferred} deferred
     *     The Deferred object to resolve or reject depending on whether at
     *     least one translation file can be successfully loaded.
     *
     * @param {String} requestedKey
     *     The originally-requested language key.
     *
     * @param {String[]} remainingKeys
     *     The keys of the languages to attempt to load, in order, where the
     *     first key in this array is the language to try within this function
     *     call. The first key in the array is not necessarily the originally-
     *     requested language key.
     */
    var satisfyTranslation = function satisfyTranslation(deferred, requestedKey, remainingKeys) {

        // Get current language key
        var currentKey = remainingKeys.shift();

        // If no languages to try, "succeed" with an empty translation (force fallback)
        if (!currentKey) {
            deferred.resolve('{}');
            return;
        }

        /**
         * Continues trying possible translation files until no possibilities
         * exist.
         *
         * @private
         */
        var tryNextTranslation = function tryNextTranslation() {
            satisfyTranslation(deferred, requestedKey, remainingKeys);
        };

        // Retrieve list of supported languages
        languageService.getLanguages()

        // Attempt to retrieve translation if language is supported
        .then(function retrievedLanguages(languages) {

            // Skip retrieval if language is not supported
            if (!(currentKey in languages)) {
                tryNextTranslation();
                return;
            }

            // Attempt to retrieve language
            $http({
                cache   : cacheService.languages,
                method  : 'GET',
                url     : 'translations/' + encodeURIComponent(currentKey) + '.json'
            })

            // Resolve promise if translation retrieved successfully
            .then(function translationFileRetrieved(request) {
                deferred.resolve(request.data);
            },

            // Retry with remaining languages if translation file could not be
            // retrieved
            tryNextTranslation);
        },

        // Retry with remaining languages if translation does not exist
        tryNextTranslation);

    };

    /**
     * Given a valid language key, returns all possible legal variations of
     * that key. Currently, this will be the given key and the given key
     * without the country code. If the key has no country code, only the
     * given key will be included in the returned array.
     *
     * @param {String} key
     *     The language key to generate variations of.
     *
     * @returns {String[]}
     *     All possible variations of the given language key.
     */
    var getKeyVariations = function getKeyVariations(key) {

        var underscore = key.indexOf('_');

        // If no underscore, only one possibility
        if (underscore === -1)
            return [key];

        // Otherwise, include the lack of country code as an option
        return [key, key.substr(0, underscore)];

    };

    /**
     * Custom loader function for angular-translate which loads the desired
     * language file dynamically via HTTP. If the language file cannot be
     * found, the fallback language is used instead.
     *
     * @param {Object} options
     *     Arbitrary options, containing at least a "key" property which
     *     contains the requested language key.
     *
     * @returns {Promise.<Object>}
     *     A promise which resolves to the requested translation string object.
     */
    return function loadTranslationFile(options) {

        var translation = $q.defer();

        // Satisfy the translation request using possible variations of the given key
        satisfyTranslation(translation, options.key, getKeyVariations(options.key));

        // Return promise which is resolved only after the translation file is loaded
        return translation.promise;

    };

}]);
