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
 * Directive which displays a set of tabs dividing a section of a page into
 * logical subsections or views. The currently selected tab is communicated
 * through assignment to the variable bound to the <code>current</code>
 * attribute. No navigation occurs as a result of selecting a tab.
 */
angular.module('navigation').directive('guacSectionTabs', ['$injector',
    function guacSectionTabs($injector) {

    // Required services
    var translationStringService = $injector.get('translationStringService');

    var directive = {

        restrict    : 'E',
        replace     : true,
        templateUrl : 'app/navigation/templates/guacSectionTabs.html',

        scope : {

            /**
             * The translation namespace to use when producing translation
             * strings for each tab. Tab translation strings will be of the
             * form:
             *
             * <code>NAMESPACE.SECTION_HEADER_NAME<code>
             *
             * where <code>NAMESPACE</code> is the namespace provided to this
             * attribute and <code>NAME</code> is one of the names within the
             * array provided to the <code>tabs</code> attribute and
             * transformed via translationStringService.canonicalize().
             */
            namespace : '@',

            /**
             * The name of the currently selected tab. This name MUST be one of
             * the names present in the array given via the <code>tabs</code>
             * attribute. This directive will not automatically choose an
             * initially selected tab, and a default value should be manually
             * assigned to <code>current</code> to ensure a tab is initially
             * selected.
             *
             * @type String
             */
            current : '=',

            /**
             * The unique names of all tabs which should be made available, in
             * display order. These names will be assigned to the variable
             * bound to the <code>current</code> attribute when the current
             * tab changes.
             *
             * @type String[]
             */
            tabs : '='

        }

    };

    directive.controller = ['$scope', function dataSourceTabsController($scope) {

        /**
         * Produces the translation string for the section header representing
         * the tab having the given name. The translation string will be of the
         * form:
         *
         * <code>NAMESPACE.SECTION_HEADER_NAME<code>
         *
         * where <code>NAMESPACE</code> is the namespace provided to the
         * directive and <code>NAME</code> is the given name transformed
         * via translationStringService.canonicalize().
         *
         * @param {String} name
         *     The name of the tab.
         *
         * @returns {String}
         *     The translation string which produces the translated header
         *     of the tab having the given name.
         */
        $scope.getSectionHeader = function getSectionHeader(name) {

            // If no name, then no header
            if (!name)
                return '';

            return translationStringService.canonicalize($scope.namespace || 'MISSING_NAMESPACE')
                    + '.SECTION_HEADER_' + translationStringService.canonicalize(name);

        };

        /**
         * Selects the tab having the given name. The name of the currently
         * selected tab will be communicated outside the directive through
         * $scope.current.
         *
         * @param {String} name
         *     The name of the tab to select.
         */
        $scope.selectTab = function selectTab(name) {
            $scope.current = name;
        };

        /**
         * Returns whether the tab having the given name is currently
         * selected. A tab is currently selected if its name is stored within
         * $scope.current, as assigned externally or by selectTab().
         *
         * @param {String} name
         *     The name of the tab to test.
         *
         * @returns {Boolean}
         *     true if the tab having the given name is currently selected,
         *     false otherwise.
         */
        $scope.isSelected = function isSelected(name) {
            return $scope.current === name;
        };

    }];

    return directive;

}]);
