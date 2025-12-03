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
 * Controller for the language field type. The language field type allows the
 * user to select a language from the set of languages supported by the
 * Guacamole web application.
 */
angular.module('form').controller('languageFieldController', ['$scope', '$injector',
    function languageFieldController($scope, $injector) {

    // Required services
    var languageService = $injector.get('languageService');
    var requestService  = $injector.get('requestService');

    /**
     * A map of all available language keys to their human-readable
     * names.
     *
     * @type Object.<String, String>
     */
    $scope.languages = null;

    // Retrieve defined languages
    languageService.getLanguages().then(function languagesRetrieved(languages) {
        $scope.languages = languages;
    }, requestService.DIE);

    // Interpret undefined/null as empty string
    $scope.$watch('model', function setModel(model) {
        if (!model && model !== '')
            $scope.model = '';
    });

}]);
