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
 * Service for operating on HTML patches via the REST API.
 */
angular.module('rest').factory('patchService', ['$injector',
        function patchService($injector) {

    // Required services
    var requestService        = $injector.get('requestService');
    var cacheService          = $injector.get('cacheService');

    var service = {};

    /**
     * Makes a request to the REST API to get the list of patches, returning
     * a promise that provides the array of all applicable patches if
     * successful. Each patch is a string of raw HTML with meta information
     * describing the patch operation stored within meta tags.
     *
     * @returns {Promise.<String[]>}
     *     A promise which will resolve with an array of HTML patches upon
     *     success.
     */
    service.getPatches = function getPatches() {

        // Retrieve all applicable HTML patches
        return requestService({
            cache   : cacheService.patches,
            method  : 'GET',
            url     : 'api/patches'
        });

    };

    return service;

}]);
