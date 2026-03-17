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
 * Directive which displays a set of tabs pointing to the same object within
 * different data sources, such as user accounts which span multiple data
 * sources.
 */
angular.module('manage').directive('dataSourceTabs', ['$injector',
    function dataSourceTabs($injector) {

    // Required types
    var PageDefinition = $injector.get('PageDefinition');

    // Required services
    var translationStringService = $injector.get('translationStringService');

    var directive = {

        restrict    : 'E',
        replace     : true,
        templateUrl : 'app/manage/templates/dataSourceTabs.html',

        scope : {

            /**
             * The permissions which dictate the management actions available
             * to the current user.
             *
             * @type Object.<String, ManagementPermissions>
             */
            permissions : '=',

            /**
             * A function which returns the URL of the object within a given
             * data source. The relevant data source will be made available to
             * the Angular expression defining this function as the
             * "dataSource" variable. No other values will be made available,
             * including values from the scope.
             *
             * @type Function
             */
            url : '&'

        }

    };

    directive.controller = ['$scope', function dataSourceTabsController($scope) {

        /**
         * The set of pages which each manage the same object within different
         * data sources.
         *
         * @type PageDefinition[]
         */
        $scope.pages = null;

        // Keep pages synchronized with permissions
        $scope.$watch('permissions', function permissionsChanged(permissions) {

            $scope.pages = [];

            var dataSources = _.keys($scope.permissions).sort();
            angular.forEach(dataSources, function addDataSourcePage(dataSource) {

                // Determine whether data source contains this object
                var managementPermissions = permissions[dataSource];
                var exists = !!managementPermissions.identifier;

                // Data source is not relevant if the associated object does not
                // exist and cannot be created
                var readOnly = !managementPermissions.canSaveObject;
                if (!exists && readOnly)
                    return;

                // Determine class name based on read-only / linked status
                var className;
                if (readOnly)    className = 'read-only';
                else if (exists) className = 'linked';
                else             className = 'unlinked';

                // Add page entry
                $scope.pages.push(new PageDefinition({
                    name      : translationStringService.canonicalize('DATA_SOURCE_' + dataSource) + '.NAME',
                    url       : $scope.url({ dataSource : dataSource }),
                    className : className
                }));

            });

        });

    }];

    return directive;

}]);
