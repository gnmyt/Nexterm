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
 * Defaults for the AngularJS $http service.
 */
angular.module('index').config(['$httpProvider', function httpDefaults($httpProvider) {

    // Do not cache the responses of GET requests
    $httpProvider.defaults.headers.get = {
        'Cache-Control' : 'no-cache',
        'Pragma' : 'no-cache'
    };

    // Use "application/json" content type by default for PATCH requests
    $httpProvider.defaults.headers.patch = {
        'Content-Type' : 'application/json'
    };

}]);
