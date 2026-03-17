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
 * Service which contains all REST API response caches.
 */
angular.module('rest').factory('cacheService', ['$injector',
        function cacheService($injector) {

    // Required services
    var $cacheFactory = $injector.get('$cacheFactory');
    var $rootScope    = $injector.get('$rootScope');

    // Service containing all caches
    var service = {};

    /**
     * Shared cache used by both connectionGroupService and
     * connectionService.
     *
     * @type $cacheFactory.Cache
     */
    service.connections = $cacheFactory('API-CONNECTIONS');

    /**
     * Cache used by languageService.
     *
     * @type $cacheFactory.Cache
     */
    service.languages = $cacheFactory('API-LANGUAGES');

    /**
     * Cache used by patchService.
     *
     * @type $cacheFactory.Cache
     */
    service.patches = $cacheFactory('API-PATCHES');

    /**
     * Cache used by schemaService.
     *
     * @type $cacheFactory.Cache
     */
    service.schema = $cacheFactory('API-SCHEMA');

    /**
     * Shared cache used by userService, userGroupService, permissionService,
     * and membershipService.
     *
     * @type $cacheFactory.Cache
     */
    service.users = $cacheFactory('API-USERS');

    /**
     * Clear all caches defined in this service.
     */
    service.clearCaches = function clearCaches() {
        service.connections.removeAll();
        service.languages.removeAll();
        service.schema.removeAll();
        service.users.removeAll();
    };

    // Clear caches on logout
    $rootScope.$on('guacLogout', function handleLogout() {
        service.clearCaches();
    });

    return service;

}]);
