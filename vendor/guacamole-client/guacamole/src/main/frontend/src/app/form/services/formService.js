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
 * A service for maintaining form-related metadata and linking that data to
 * corresponding controllers and templates.
 */
angular.module('form').provider('formService', function formServiceProvider() {

    /**
     * Reference to the provider itself.
     *
     * @type formServiceProvider
     */
    var provider = this;

    /**
     * Map of all registered field type definitions by name.
     *
     * @type Object.<String, FieldType>
     */
    this.fieldTypes = {

        /**
         * Text field type.
         *
         * @see {@link Field.Type.TEXT}
         * @type FieldType
         */
        'TEXT' : {
            module      : 'form',
            controller  : 'textFieldController',
            templateUrl : 'app/form/templates/textField.html'
        },

        /**
         * Email address field type.
         *
         * @see {@link Field.Type.EMAIL}
         * @type FieldType
         */
        'EMAIL' : {
            templateUrl : 'app/form/templates/emailField.html'
        },

        /**
         * Numeric field type.
         *
         * @see {@link Field.Type.NUMERIC}
         * @type FieldType
         */
        'NUMERIC' : {
            module      : 'form',
            controller  : 'numberFieldController',
            templateUrl : 'app/form/templates/numberField.html'
        },

        /**
         * Boolean field type.
         *
         * @see {@link Field.Type.BOOLEAN}
         * @type FieldType
         */
        'BOOLEAN' : {
            module      : 'form',
            controller  : 'checkboxFieldController',
            templateUrl : 'app/form/templates/checkboxField.html'
        },

        /**
         * Username field type. Identical in principle to a text field, but may
         * have different semantics.
         *
         * @see {@link Field.Type.USERNAME}
         * @type FieldType
         */
        'USERNAME' : {
            templateUrl : 'app/form/templates/usernameField.html'
        },

        /**
         * Password field type. Similar to a text field, but the contents of
         * the field are masked.
         *
         * @see {@link Field.Type.PASSWORD}
         * @type FieldType
         */
        'PASSWORD' : {
            module      : 'form',
            controller  : 'passwordFieldController',
            templateUrl : 'app/form/templates/passwordField.html'
        },

        /**
         * Enumerated field type. The user is presented a finite list of values
         * to choose from.
         *
         * @see {@link Field.Type.ENUM}
         * @type FieldType
         */
        'ENUM' : {
            module      : 'form',
            controller  : 'selectFieldController',
            templateUrl : 'app/form/templates/selectField.html'
        },

        /**
         * Multiline field type. The user may enter multiple lines of text.
         *
         * @see {@link Field.Type.MULTILINE}
         * @type FieldType
         */
        'MULTILINE' : {
            templateUrl : 'app/form/templates/textAreaField.html'
        },

        /**
         * Field type which allows selection of languages. The languages
         * displayed are the set of languages supported by the Guacamole web
         * application. Legal values are valid language IDs, as dictated by
         * the filenames of Guacamole's available translations.
         *
         * @see {@link Field.Type.LANGUAGE}
         * @type FieldType
         */
        'LANGUAGE' : {
            module      : 'form',
            controller  : 'languageFieldController',
            templateUrl : 'app/form/templates/languageField.html'
        },

        /**
         * Field type which allows selection of time zones.
         *
         * @see {@link Field.Type.TIMEZONE}
         * @type FieldType
         */
        'TIMEZONE' : {
            module      : 'form',
            controller  : 'timeZoneFieldController',
            templateUrl : 'app/form/templates/timeZoneField.html'
        },

        /**
         * Field type which allows selection of individual dates.
         *
         * @see {@link Field.Type.DATE}
         * @type FieldType
         */
        'DATE' : {
            module      : 'form',
            controller  : 'dateFieldController',
            templateUrl : 'app/form/templates/dateField.html'
        },

        /**
         * Field type which allows selection of times of day.
         *
         * @see {@link Field.Type.TIME}
         * @type FieldType
         */
        'TIME' : {
            module      : 'form',
            controller  : 'timeFieldController',
            templateUrl : 'app/form/templates/timeField.html'
        },

        /**
         * Field type which allows selection of color schemes accepted by the
         * Guacamole server terminal emulator and protocols which leverage it.
         *
         * @see {@link Field.Type.TERMINAL_COLOR_SCHEME}
         * @type FieldType
         */
        'TERMINAL_COLOR_SCHEME' : {
            module      : 'form',
            controller  : 'terminalColorSchemeFieldController',
            templateUrl : 'app/form/templates/terminalColorSchemeField.html'
        },
        
        /**
         * Field type that supports redirecting the client browser to another
         * URL.
         * 
         * @see {@link Field.Type.REDIRECT}
         * @type FieldType
         */
        'REDIRECT' : {
            module      : 'form',
            controller  : 'redirectFieldController',
            templateUrl : 'app/form/templates/redirectField.html'
        }

    };

    /**
     * Registers a new field type under the given name.
     *
     * @param {String} fieldTypeName
     *     The name which uniquely identifies the field type being registered.
     *
     * @param {FieldType} fieldType
     *     The field type definition to associate with the given name.
     */
    this.registerFieldType = function registerFieldType(fieldTypeName, fieldType) {

        // Store field type
        provider.fieldTypes[fieldTypeName] = fieldType;

    };

    // Factory method required by provider
    this.$get = ['$injector', function formServiceFactory($injector) {

        // Required services
        var $compile         = $injector.get('$compile');
        var $q               = $injector.get('$q');
        var $templateRequest = $injector.get('$templateRequest');

        /**
         * Map of module name to the injector instance created for that module.
         *
         * @type {Object.<String, injector>}
         */
        var injectors = {};

        var service = {};

        service.fieldTypes = provider.fieldTypes;

        /**
         * Given the name of a module, returns an injector instance which
         * injects dependencies within that module. A new injector may be
         * created and initialized if no such injector has yet been requested.
         * If the injector available to formService already includes the
         * requested module, that injector will simply be returned.
         *
         * @param {String} module
         *     The name of the module to produce an injector for.
         *
         * @returns {injector}
         *     An injector instance which injects dependencies for the given
         *     module.
         */
        var getInjector = function getInjector(module) {

            // Use the formService's injector if possible
            if ($injector.modules[module])
                return $injector;

            // If the formService's injector does not include the requested
            // module, create the necessary injector, reusing that injector for
            // future calls
            injectors[module] = injectors[module] || angular.injector(['ng', module]);
            return injectors[module];

        };

        /**
         * Given form content and an arbitrary prefix, returns a corresponding
         * CSS class object as would be provided to the ngClass directive that
         * assigns a content-specific CSS class based on the prefix and
         * form/field name. Generated class names follow the lowercase with
         * dashes naming convention. For example, if the prefix is "field-" and
         * the provided content is a field with the name "Swap red/blue", the
         * object { 'field-swap-red-blue' : true } would be returned.
         *
         * @param {!string} prefix
         *     The arbitrary prefix to prepend to the name of the generated CSS
         *     class.
         *
         * @param {!(Form|Field)} [content]
         *     The form or field whose name should be used to produce the CSS
         *     class name.
         *
         * @param {Object.<string, boolean>} [object={}]
         *     The optional base ngClass object that should be used to provide
         *     additional name/value pairs within the returned object.
         *
         * @return {!Object.<string, boolean>}
         *     The ngClass object based on the provided object and defining a
         *     CSS class name for the given content.
         */
        service.getClasses = function getClasses(prefix, content, object) {

            // Default to no additional properties
            object = object || {};

            // Perform no transformation if there is no content or
            // corresponding name
            if (!content || !content.name)
                return object;

            // Transform content name and prefix into lowercase-with-dashes
            // CSS class name
            var className = prefix + content.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

            // Add CSS class name to provided base object (without touching
            // base object)
            var classes = angular.extend({}, object);
            classes[className] = true;
            return classes;

        };

        /**
         * Compiles and links the field associated with the given name to the given
         * scope, producing a distinct and independent DOM Element which functions
         * as an instance of that field. The scope object provided must include at
         * least the following properties:
         *
         * namespace:
         *     A String which defines the unique namespace associated the
         *     translation strings used by the form using a field of this type.
         *
         * fieldId:
         *     A String value which is reasonably likely to be unique and may
         *     be used to associate the main element of the field with its
         *     label.
         *
         * field:
         *     The Field object that is being rendered, representing a field of
         *     this type.
         *
         * model:
         *     The current String value of the field, if any.
         *
         * disabled:
         *     A boolean value which is true if the field should be disabled.
         *     If false or undefined, the field should be enabled.
         *
         * @param {Element} fieldContainer
         *     The DOM Element whose contents should be replaced with the
         *     compiled field template.
         *
         * @param {String} fieldTypeName
         *     The name of the field type defining the nature of the element to be
         *     created.
         *
         * @param {Object} scope
         *     The scope to which the new element will be linked.
         *
         * @return {Promise.<Element>}
         *     A Promise which resolves to the compiled Element. If an error occurs
         *     while retrieving the field type, this Promise will be rejected.
         */
        service.insertFieldElement = function insertFieldElement(fieldContainer,
            fieldTypeName, scope) {

            // Ensure field type is defined
            var fieldType = provider.fieldTypes[fieldTypeName];
            if (!fieldType)
                return $q.reject();

            var templateRequest;

            // Use raw HTML template if provided
            if (fieldType.template) {
                var deferredTemplate = $q.defer();
                deferredTemplate.resolve(fieldType.template);
                templateRequest = deferredTemplate.promise;
            }

            // If no raw HTML template is provided, retrieve template from URL
            else if (fieldType.templateUrl)
                templateRequest = $templateRequest(fieldType.templateUrl);

            // Otherwise, use empty template
            else {
                var emptyTemplate= $q.defer();
                emptyTemplate.resolve('');
                templateRequest = emptyTemplate.promise;
            }

            // Defer compilation of template pending successful retrieval
            var compiledTemplate = $q.defer();

            // Resolve with compiled HTML upon success
            templateRequest.then(function templateRetrieved(html) {

                // Insert template into DOM
                fieldContainer.innerHTML = html;

                // Populate scope using defined controller
                if (fieldType.module && fieldType.controller) {
                    var $controller = getInjector(fieldType.module).get('$controller');
                    $controller(fieldType.controller, {
                        '$scope'   : scope,
                        '$element' : angular.element(fieldContainer.childNodes)
                    });
                }

                // Compile DOM with populated scope
                compiledTemplate.resolve($compile(fieldContainer.childNodes)(scope));

            })

            // Reject on failure
            ['catch'](function templateError() {
                compiledTemplate.reject();
            });

            // Return promise which resolves to the compiled template
            return compiledTemplate.promise;

        };

        return service;

    }];

});
