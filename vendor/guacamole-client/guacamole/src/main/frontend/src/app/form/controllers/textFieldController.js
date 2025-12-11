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
 * Controller for text fields.
 */
angular.module('form').controller('textFieldController', ['$scope', '$injector',
    function textFieldController($scope, $injector) {

    /**
     * The ID of the datalist element that should be associated with the text
     * field, providing a set of known-good values. If no such values are
     * defined, this will be null.
     *
     * @type String
     */
    $scope.dataListId = null;

    // Generate unique ID for datalist, if applicable
    if ($scope.field.options && $scope.field.options.length)
        $scope.dataListId = $scope.fieldId + '-datalist';

}]);
