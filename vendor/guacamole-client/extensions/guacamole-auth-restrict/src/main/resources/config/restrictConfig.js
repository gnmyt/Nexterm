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
 * Config block which registers restrict-specific field types.
 */
angular.module('guacRestrict').config(['formServiceProvider',
        function guacRestrictConfig(formServiceProvider) {

    // Define the time restriction field
    formServiceProvider.registerFieldType('GUAC_TIME_RESTRICTION', {
        module      : 'guacRestrict',
        controller  : 'timeRestrictionFieldController',
        templateUrl : 'app/ext/restrict/templates/timeRestrictionField.html'
    });
    
    // Define the host restriction field
    formServiceProvider.registerFieldType('GUAC_HOST_RESTRICTION', {
        module      : 'guacRestrict',
        controller  : 'hostRestrictionFieldController',
        templateUrl : 'app/ext/restrict/templates/hostRestrictionField.html'
    });

}]);
