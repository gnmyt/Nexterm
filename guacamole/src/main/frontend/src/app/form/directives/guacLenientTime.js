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
 * on an HTML5 time input field, relaxing the otherwise strict parsing and
 * validation behavior. The behavior of this directive for other input elements
 * is undefined.
 */
angular.module('form').directive('guacLenientTime', ['$injector',
    function guacLenientTime($injector) {

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
    config.link = function linkGuacLenientTIme($scope, $element, $attrs, ngModel) {

        // Parse time strings leniently
        ngModel.$parsers = [function parse(viewValue) {

            // If blank, return null
            if (!viewValue)
                return null;

            // Match basic time pattern
            var match = /([0-9]*)(?::([0-9]*)(?::([0-9]*))?)?(?:\s*(a|p))?/.exec(viewValue.toLowerCase());
            if (!match)
                return null;

            // Determine hour, minute, and second based on pattern
            var hour   = parseInt(match[1] || '0');
            var minute = parseInt(match[2] || '0');
            var second = parseInt(match[3] || '0');

            // Handle AM/PM
            if (match[4]) {

                // Interpret 12 AM as 00:00 and 12 PM as 12:00
                if (hour === 12)
                    hour = 0;

                // Increment hour to evening if PM
                if (match[4] === 'p')
                    hour += 12;

            }

            // Wrap seconds and minutes into minutes and hours
            minute += second / 60; second %= 60;
            hour   += minute / 60; minute %= 60;

            // Constrain hours to 0 - 23
            hour %= 24;

            // Convert to Date object
            var parsedDate = new Date(Date.UTC(1970, 0, 1, hour, minute, second));
            if (isNaN(parsedDate.getTime()))
                return null;

            return parsedDate;

        }];

        // Format time strings as "HH:mm:ss"
        ngModel.$formatters = [function format(modelValue) {
            return modelValue ? $filter('date')(modelValue, 'HH:mm:ss', 'UTC') : '';
        }];

    };

    return config;

}]);
