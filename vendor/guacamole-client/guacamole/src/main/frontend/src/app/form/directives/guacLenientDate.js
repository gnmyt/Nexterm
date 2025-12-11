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
 * A directive which modifies the parsing and formatting of ngModel when used
 * on an HTML5 date input field, relaxing the otherwise strict parsing and
 * validation behavior. The behavior of this directive for other input elements
 * is undefined.
 */
angular.module('form').directive('guacLenientDate', ['$injector',
    function guacLenientDate($injector) {

    // Required services
    var $filter = $injector.get('$filter');

    /**
     * Directive configuration object.
     *
     * @type Object.<String, Object>
     */
    var config = {
        restrict : 'A',
        require  : 'ngModel'
    };

    // Linking function
    config.link = function linkGuacLenientDate($scope, $element, $attrs, ngModel) {

        // Parse date strings leniently
        ngModel.$parsers = [function parse(viewValue) {

            // If blank, return null
            if (!viewValue)
                return null;

            // Match basic date pattern
            var match = /([0-9]*)(?:-([0-9]*)(?:-([0-9]*))?)?/.exec(viewValue);
            if (!match)
                return null;

            // Determine year, month, and day based on pattern
            var year  = parseInt(match[1] || '0') || new Date().getFullYear();
            var month = parseInt(match[2] || '0') || 1;
            var day   = parseInt(match[3] || '0') || 1;

            // Convert to Date object
            var parsedDate = new Date(Date.UTC(year, month - 1, day));
            if (isNaN(parsedDate.getTime()))
                return null;

            return parsedDate;

        }];

        // Format date strings as "yyyy-MM-dd"
        ngModel.$formatters = [function format(modelValue) {
            return modelValue ? $filter('date')(modelValue, 'yyyy-MM-dd', 'UTC') : '';
        }];

    };

    return config;

}]);
