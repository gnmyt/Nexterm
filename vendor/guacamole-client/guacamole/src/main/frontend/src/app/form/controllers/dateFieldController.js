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
 * Controller for date fields.
 */
angular.module('form').controller('dateFieldController', ['$scope', '$injector',
    function dateFieldController($scope, $injector) {

    // Required services
    var $filter = $injector.get('$filter');

    /**
     * Options which dictate the behavior of the input field model, as defined
     * by https://docs.angularjs.org/api/ng/directive/ngModelOptions
     *
     * @type Object.<String, String>
     */
    $scope.modelOptions = {

        /**
         * Space-delimited list of events on which the model will be updated.
         *
         * @type String
         */
        updateOn : 'blur',

        /**
         * The time zone to use when reading/writing the Date object of the
         * model.
         *
         * @type String
         */
        timezone : 'UTC'

    };

    /**
     * Parses the date components of the given string into a Date with only the
     * date components set. The resulting Date will be in the UTC timezone,
     * with the time left as midnight. The input string must be in the format
     * YYYY-MM-DD (zero-padded).
     *
     * @param {String} str
     *     The date string to parse.
     *
     * @returns {Date}
     *     A Date object, in the UTC timezone, with only the date components
     *     set.
     */
    var parseDate = function parseDate(str) {

        // Parse date, return blank if invalid
        var parsedDate = new Date(str + 'T00:00Z');
        if (isNaN(parsedDate.getTime()))
            return null;

        return parsedDate;

    };

    // Update typed value when model is changed
    $scope.$watch('model', function modelChanged(model) {
        $scope.typedValue = (model ? parseDate(model) : null);
    });

    // Update string value in model when typed value is changed
    $scope.$watch('typedValue', function typedValueChanged(typedValue) {
        $scope.model = (typedValue ? $filter('date')(typedValue, 'yyyy-MM-dd', 'UTC') : '');
    });

}]);
