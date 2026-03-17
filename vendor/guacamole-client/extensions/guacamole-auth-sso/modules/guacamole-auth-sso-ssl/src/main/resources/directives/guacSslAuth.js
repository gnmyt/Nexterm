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
 * A directive which automatically attempts to log the current user in using
 * SSL/TLS client authentication when the associated element is clicked.
 */
angular.module('element').directive('guacSslAuth', ['$injector', function guacSslAuth($injector) {

    // Required services
    var clientAuthService = $injector.get('clientAuthService');

    var directive = {
        restrict: 'A'
    };

    directive.link = function linkGuacSslAuth($scope, $element) {

        /**
         * The element which will register the click.
         *
         * @type Element
         */
        const element = $element[0];

        // Attempt SSL/TLS client authentication upon click
        element.addEventListener('click', function elementClicked() {
            clientAuthService.authenticate();
        });

    };

    return directive;

}]);
