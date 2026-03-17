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
 * Controller for time fields.
 */
angular.module('form').controller('timeFieldController', ['$scope', '$injector',
    function timeFieldController($scope, $injector) {

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
     * Parses the time components of the given string into a Date with only the
     * time components set. The resulting Date will be in the UTC timezone,
     * with the date left as 1970-01-01. The input string must be in the format
     * HH:MM:SS (zero-padded, 24-hour).
     *
     * @param {String} str
     *     The time string to parse.
     *
     * @returns {Date}
     *     A Date object, in the UTC timezone, with only the time components
     *     set.
     */
    var parseTime = function parseTime(str) {

        // Parse time, return blank if invalid
        var parsedDate = new Date('1970-01-01T' + str + 'Z');
        if (isNaN(parsedDate.getTime()))
            return null;
        
        return parsedDate;

    };

    // Update typed value when model is changed
    $scope.$watch('model', function modelChanged(model) {
        $scope.typedValue = (model ? parseTime(model) : null);
    });

    // Update string value in model when typed value is changed
    $scope.$watch('typedValue', function typedValueChanged(typedValue) {
        $scope.model = (typedValue ? $filter('date')(typedValue, 'HH:mm:ss', 'UTC') : '');
    });

}]);
