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
 * A directive that allows editing of a field.
 */
angular.module('form').directive('guacFormField', [function formField() {
    
    return {
        // Element only
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The translation namespace of the translation strings that will
             * be generated for this field. This namespace is absolutely
             * required. If this namespace is omitted, all generated
             * translation strings will be placed within the MISSING_NAMESPACE
             * namespace, as a warning.
             *
             * @type String
             */
            namespace : '=',

            /**
             * The field to display.
             *
             * @type Field
             */
            field : '=',

            /**
             * The property which contains this fields current value. When this
             * field changes, the property will be updated accordingly.
             *
             * @type String
             */
            model : '=',

            /**
             * Whether this field should be rendered as disabled. By default,
             * form fields are enabled.
             *
             * @type Boolean
             */
            disabled : '=',

            /**
             * Whether this field should be focused.
             *
             * @type Boolean
             */
            focused : '=',

            /**
             * The client associated with this form field, if any.
             *
             * @type ManagedClient
             */
            client: '='

        },
        templateUrl: 'app/form/templates/formField.html',
        controller: ['$scope', '$injector', '$element', function formFieldController($scope, $injector, $element) {

            // Required services
            var $log                     = $injector.get('$log');
            var formService              = $injector.get('formService');
            var translationStringService = $injector.get('translationStringService');

            /**
             * The element which should contain any compiled field content. The
             * actual content of a field is dynamically determined by its type.
             *
             * @type Element[]
             */
            var fieldContent = $element.find('.form-field');

            /**
             * An ID value which is reasonably likely to be unique relative to
             * other elements on the page. This ID should be used to associate
             * the relevant input element with the label provided by the
             * guacFormField directive, if there is such an input element.
             *
             * @type String
             */
            $scope.fieldId = 'guac-field-XXXXXXXXXXXXXXXX'.replace(/X/g, function getRandomCharacter() {
                return Math.floor(Math.random() * 36).toString(36);
            }) + '-' + new Date().getTime().toString(36);

            /**
             * Produces the translation string for the header of the current
             * field. The translation string will be of the form:
             *
             * <code>NAMESPACE.FIELD_HEADER_NAME<code>
             *
             * where <code>NAMESPACE</code> is the namespace provided to the
             * directive and <code>NAME</code> is the field name transformed
             * via translationStringService.canonicalize().
             *
             * @returns {String}
             *     The translation string which produces the translated header
             *     of the field.
             */
            $scope.getFieldHeader = function getFieldHeader() {

                // If no field, or no name, then no header
                if (!$scope.field || !$scope.field.name)
                    return '';

                return translationStringService.canonicalize($scope.namespace || 'MISSING_NAMESPACE')
                        + '.FIELD_HEADER_' + translationStringService.canonicalize($scope.field.name);

            };

            /**
             * Produces the translation string for the given field option
             * value. The translation string will be of the form:
             *
             * <code>NAMESPACE.FIELD_OPTION_NAME_VALUE<code>
             *
             * where <code>NAMESPACE</code> is the namespace provided to the
             * directive, <code>NAME</code> is the field name transformed
             * via translationStringService.canonicalize(), and
             * <code>VALUE</code> is the option value transformed via
             * translationStringService.canonicalize()
             *
             * @param {String} value
             *     The name of the option value.
             *
             * @returns {String}
             *     The translation string which produces the translated name of the
             *     value specified.
             */
            $scope.getFieldOption = function getFieldOption(value) {

                // If no field, or no value, then no corresponding translation string
                if (!$scope.field || !$scope.field.name)
                    return '';

                return translationStringService.canonicalize($scope.namespace || 'MISSING_NAMESPACE')
                        + '.FIELD_OPTION_' + translationStringService.canonicalize($scope.field.name)
                        + '_'              + translationStringService.canonicalize(value || 'EMPTY');

            };

            /**
             * Returns an object as would be provided to the ngClass directive
             * that defines the CSS classes that should be applied to this
             * field.
             *
             * @return {!Object.<string, boolean>}
             *     The ngClass object defining the CSS classes for the current
             *     field.
             */
            $scope.getFieldClasses = function getFieldClasses() {
                return formService.getClasses('labeled-field-', $scope.field, {
                    empty: !$scope.model
                });
            };

            /**
             * Returns whether the current field should be displayed.
             *
             * @returns {Boolean}
             *     true if the current field should be displayed, false
             *     otherwise.
             */
            $scope.isFieldVisible = function isFieldVisible() {
                return fieldContent[0].hasChildNodes();
            };

            // Update field contents when field definition is changed
            $scope.$watch('field', function setField(field) {

                // Reset contents
                fieldContent.innerHTML = '';

                // Append field content
                if (field) {
                    formService.insertFieldElement(fieldContent[0],
                        field.type, $scope)['catch'](function fieldCreationFailed() {
                            $log.warn('Failed to retrieve field with type "' + field.type + '"');
                    });
                }

            });

        }] // end controller
    };
    
}]);
