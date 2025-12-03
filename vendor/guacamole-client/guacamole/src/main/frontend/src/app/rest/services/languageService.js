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
 * Service for operating on language metadata via the REST API.
 */
angular.module('rest').factory('languageService', ['$injector',
        function languageService($injector) {

    // Required services
    var requestService        = $injector.get('requestService');
    var authenticationService = $injector.get('authenticationService');
    var cacheService          = $injector.get('cacheService');

    var service = {};
    
    /**
     * Makes a request to the REST API to get the list of languages, returning
     * a promise that provides a map of language names by language key if 
     * successful.
     *                          
     * @returns {Promise.<Object.<String, String>>}
     *     A promise which will resolve with a map of language names by
     *     language key upon success.
     */
    service.getLanguages = function getLanguages() {

        // Retrieve available languages
        return authenticationService.request({
            cache   : cacheService.languages,
            method  : 'GET',
            url     : 'api/languages'
        });

    };
    
    return service;

}]);
