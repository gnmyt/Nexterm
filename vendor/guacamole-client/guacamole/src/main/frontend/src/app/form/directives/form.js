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

/* global _ */

/**
 * A directive that allows editing of a collection of fields.
 */
angular.module('form').directive('guacForm', [function form() {

    return {
        // Element only
        restrict: 'E',
        replace: true,
        scope: {

            /**
             * The translation namespace of the translation strings that will
             * be generated for all fields. This namespace is absolutely
             * required. If this namespace is omitted, all generated
             * translation strings will be placed within the MISSING_NAMESPACE
             * namespace, as a warning.
             *
             * @type String
             */
            namespace : '=',

            /**
             * The form content to display. This may be a form, an array of
             * forms, or a simple array of fields.
             *
             * @type Form[]|Form|Field[]|Field
             */
            content : '=',

            /**
             * The object which will receive all field values. Each field value
             * will be assigned to the property of this object having the same
             * name.
             *
             * @type Object.<String, String>
             */
            model : '=',

            /**
             * Whether the contents of the form should be restricted to those
             * fields/forms which match properties defined within the given
             * model object. By default, all fields will be shown.
             *
             * @type Boolean
             */
            modelOnly : '=',

            /**
             * Whether the contents of the form should be rendered as disabled.
             * By default, form fields are enabled.
             *
             * @type Boolean
             */
            disabled : '=',

            /**
             * The name of the field to be focused, if any.
             *
             * @type String
             */
            focused : '=',

            /**
             * The client associated with this form, if any.
             *
             * NOTE: If the provided client has any managed arguments in the
             * pending state, any fields with the same name rendered by this
             * form will be disabled. The fields will be re-enabled when guacd
             * sends an updated argument with a the same name.
             *
             * @type ManagedClient
             */
            client: '='

        },
        templateUrl: 'app/form/templates/form.html',
        controller: ['$scope', '$injector', function formController($scope, $injector) {

            // Required services
            var formService              = $injector.get('formService');
            var translationStringService = $injector.get('translationStringService');

            /**
             * The array of all forms to display.
             *
             * @type Form[]
             */
            $scope.forms = [];

            /**
             * The object which will receive all field values. Normally, this
             * will be the object provided within the "model" attribute. If
             * no such object has been provided, a blank model will be used
             * instead as a placeholder, such that the fields of this form
             * will have something to bind to.
             *
             * @type Object.<String, String>
             */
            $scope.values = {};

            /**
             * Produces the translation string for the section header of the
             * given form. The translation string will be of the form:
             *
             * <code>NAMESPACE.SECTION_HEADER_NAME<code>
             *
             * where <code>NAMESPACE</code> is the namespace provided to the
             * directive and <code>NAME</code> is the form name transformed
             * via translationStringService.canonicalize().
             *
             * @param {Form} form
             *     The form for which to produce the translation string.
             *
             * @returns {String}
             *     The translation string which produces the translated header
             *     of the form.
             */
            $scope.getSectionHeader = function getSectionHeader(form) {

                // If no form, or no name, then no header
                if (!form || !form.name)
                    return '';

                return translationStringService.canonicalize($scope.namespace || 'MISSING_NAMESPACE')
                        + '.SECTION_HEADER_' + translationStringService.canonicalize(form.name);

            };

            /**
             * Returns an object as would be provided to the ngClass directive
             * that defines the CSS classes that should be applied to the given
             * form.
             *
             * @param {Form} form
             *     The form to generate the CSS classes for.
             *
             * @return {!Object.<string, boolean>}
             *     The ngClass object defining the CSS classes for the given
             *     form.
             */
            $scope.getFormClasses = function getFormClasses(form) {
                return formService.getClasses('form-', form);
            };

            /**
             * Determines whether the given object is a form, under the
             * assumption that the object is either a form or a field.
             *
             * @param {Form|Field} obj
             *     The object to test.
             *
             * @returns {Boolean}
             *     true if the given object appears to be a form, false
             *     otherwise.
             */
            var isForm = function isForm(obj) {
                return !!('name' in obj && 'fields' in obj);
            };

            // Produce set of forms from any given content
            $scope.$watch('content', function setContent(content) {

                // If no content provided, there are no forms
                if (!content) {
                    $scope.forms = [];
                    return;
                }

                // Ensure content is an array
                if (!angular.isArray(content))
                    content = [content];

                // If content is an array of fields, convert to an array of forms
                if (content.length && !isForm(content[0])) {
                    content = [{
                        fields : content
                    }];
                }

                // Content is now an array of forms
                $scope.forms = content;

            });

            // Update string value and re-assign to model when field is changed
            $scope.$watch('model', function setModel(model) {

                // Assign new model only if provided
                if (model)
                    $scope.values = model;

                // Otherwise, use blank model
                else
                    $scope.values = {};

            });

            /**
             * Returns whether the given field should be focused or not.
             *
             * @param {Field} field
             *     The field to check.
             *
             * @returns {Boolean}
             *     true if the given field should be focused, false otherwise.
             */
            $scope.isFocused = function isFocused(field) {
                return field && (field.name === $scope.focused);
            };

            /**
             * Returns whether the given field should be displayed to the
             * current user.
             *
             * @param {Field} field
             *     The field to check.
             *
             * @returns {Boolean}
             *     true if the given field should be visible, false otherwise.
             */
            $scope.isVisible = function isVisible(field) {

                // All fields are visible if contents are not restricted to
                // model properties only
                if (!$scope.modelOnly)
                    return true;

                // Otherwise, fields are only visible if they are present
                // within the model
                return field && (field.name in $scope.values);

            };


            /**
             * Returns whether the given field should be disabled (read-only)
             * when presented to the current user.
             *
             * @param {Field} field
             *     The field to check.
             *
             * @returns {Boolean}
             *     true if the given field should be disabled, false otherwise.
             */
            $scope.isDisabled = function isDisabled(field) {

                /*
                 * The field is disabled if either the form as a whole is disabled,
                 * or if a client is provided to the directive, and the field is
                 * marked as pending.
                 */
                return $scope.disabled ||
                        _.get($scope.client, ['arguments', field.name, 'pending']);
            };

            /**
             * Returns whether at least one of the given fields should be
             * displayed to the current user.
             *
             * @param {Field[]} fields
             *     The array of fields to check.
             *
             * @returns {Boolean}
             *     true if at least one field within the given array should be
             *     visible, false otherwise.
             */
            $scope.containsVisible = function containsVisible(fields) {

                // If fields are defined, check whether at least one is visible
                if (fields) {
                    for (var i = 0; i < fields.length; i++) {
                        if ($scope.isVisible(fields[i]))
                            return true;
                    }
                }

                // Otherwise, there are no visible fields
                return false;

            };

        }] // end controller
    };

}]);
