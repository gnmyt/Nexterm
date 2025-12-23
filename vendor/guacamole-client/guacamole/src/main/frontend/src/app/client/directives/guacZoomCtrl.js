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
 * A directive which converts between human-readable zoom
 * percentage and display scale.
 */
angular.module('client').directive('guacZoomCtrl', function guacZoomCtrl() {
    return {
        restrict: 'A',
        require: 'ngModel',
        priority: 101,
        link: function(scope, element, attrs, ngModel) {

            // Evaluate the ngChange attribute when the model
            // changes.
            ngModel.$viewChangeListeners.push(function() {
                scope.$eval(attrs.ngChange);
            });

            // When pushing to the menu, mutiply by 100.
            ngModel.$formatters.push(function(value) {
                return Math.round(value * 100);
            });
           
            // When parsing value from menu, divide by 100.
            ngModel.$parsers.push(function(value) {
                return Math.round(value) / 100;
            });
        }
    }
});
