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
 * The configuration block for setting up everything having to do with i18n.
 */
angular.module('index').config(['$injector', function($injector) {

    // Required providers
    var $translateProvider        = $injector.get('$translateProvider');
    var preferenceServiceProvider = $injector.get('preferenceServiceProvider');

    // Fallback to US English
    $translateProvider.fallbackLanguage('en');

    // Prefer chosen language
    $translateProvider.preferredLanguage(preferenceServiceProvider.preferences.language);

    // Escape any HTML in translation strings
    $translateProvider.useSanitizeValueStrategy('escape');

    // Load translations via translationLoader service
    $translateProvider.useLoader('translationLoader');

    // Provide pluralization, etc. via messageformat.js
    $translateProvider.useMessageFormatInterpolation();

}]);
