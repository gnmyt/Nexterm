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
 * A directive for displaying an arbitrary login form.
 */
angular.module('login').directive('guacLogin', [function guacLogin() {

    // Login directive
    var directive = {
        restrict    : 'E',
        replace     : true,
        templateUrl : 'app/login/templates/login.html'
    };

    // Login directive scope
    directive.scope = {

        /**
         * An optional instructional message to display within the login
         * dialog.
         *
         * @type TranslatableMessage
         */
        helpText : '=',

        /**
         * The login form or set of fields. This will be displayed to the user
         * to capture their credentials.
         *
         * @type Field[]
         */
        form : '=',

        /**
         * A map of all field name/value pairs that have already been provided.
         * If not null, the user will be prompted to continue their login
         * attempt using only the fields which remain.
         */
        values : '='

    };

    // Controller for login directive
    directive.controller = ['$scope', '$injector',
        function loginController($scope, $injector) {
        
        // Required types
        var Error = $injector.get('Error');
        var Field = $injector.get('Field');

        // Required services
        var $location             = $injector.get('$location');
        var $rootScope            = $injector.get('$rootScope');
        var $route                = $injector.get('$route');
        var authenticationService = $injector.get('authenticationService');
        var requestService        = $injector.get('requestService');

        /**
         * The initial value for all login fields. Note that this value must
         * not be null. If null, empty fields may not be submitted back to the
         * server at all, causing the request to misrepresent true login state.
         *
         * For example, if a user receives an insufficient credentials error
         * due to their password expiring, failing to provide that new password
         * should result in the user submitting their username, original
         * password, and empty new password. If only the username and original
         * password are sent, the invalid password reset request will be
         * indistinguishable from a normal login attempt.
         *
         * @constant
         * @type String
         */
        var DEFAULT_FIELD_VALUE = '';

        /**
         * A description of the error that occurred during login, if any.
         *
         * @type TranslatableMessage
         */
        $scope.loginError = null;

        /**
         * All form values entered by the user, as parameter name/value pairs.
         *
         * @type Object.<String, String>
         */
        $scope.enteredValues = {};

        /**
         * All form fields which have not yet been filled by the user.
         *
         * @type Field[]
         */
        $scope.remainingFields = [];

        /**
         * Whether an authentication attempt has been submitted. This will be
         * set to true once credentials have been submitted and will only be
         * reset to false once the attempt has been fully processed, including
         * rerouting the user to the requested page if the attempt succeeded.
         *
         * @type Boolean
         */
        $scope.submitted = false;

        /**
         * The field that is most relevant to the user.
         *
         * @type Field
         */
        $scope.relevantField = null;

        /**
         * Returns whether a previous login attempt is continuing.
         *
         * @return {Boolean}
         *     true if a previous login attempt is continuing, false otherwise.
         */
        $scope.isContinuation = function isContinuation() {

            // The login is continuing if any parameter values are provided
            for (var name in $scope.values)
                return true;

            return false;

        };

        // Ensure provided values are included within entered values, even if
        // they have no corresponding input fields
        $scope.$watch('values', function resetEnteredValues(values) {
            angular.extend($scope.enteredValues, values || {});
        });

        // Update field information when form is changed
        $scope.$watch('form', function resetRemainingFields(fields) {

            // If no fields are provided, then no fields remain
            if (!fields) {
                $scope.remainingFields = [];
                return;
            }

            // Filter provided fields against provided values
            $scope.remainingFields = fields.filter(function isRemaining(field) {
                return !(field.name in $scope.values);
            });

            // Set default values for all unset fields
            angular.forEach($scope.remainingFields, function setDefault(field) {
                if (!$scope.enteredValues[field.name])
                    $scope.enteredValues[field.name] = DEFAULT_FIELD_VALUE;
            });

            $scope.relevantField = getRelevantField();

        });

        /**
         * Submits the currently-specified fields to the authentication service,
         * as well as any URL parameters set for the current page, preferring
         * the values from the fields, and redirecting to the main view if
         * successful.
         */
        $scope.login = function login() {

            // Any values from URL paramters
            const urlValues = $location.search();

            // Values from the fields
            const fieldValues = $scope.enteredValues;

            // All the values to be submitted in the auth attempt, preferring
            // any values from fields over those in the URL
            const authParams = {...urlValues, ...fieldValues};

            authenticationService.authenticate(authParams)['catch'](requestService.IGNORE);
        };

        /**
         * Returns the field most relevant to the user given the current state
         * of the login process. This will normally be the first empty field.
         *
         * @return {Field}
         *     The field most relevant, null if there is no single most relevant
         *     field.
         */
        var getRelevantField = function getRelevantField() {

            for (var i = 0; i < $scope.remainingFields.length; i++) {
                var field = $scope.remainingFields[i];
                if (!$scope.enteredValues[field.name])
                    return field;
            }

            return null;

        };

        // Update UI to reflect in-progress auth status (clear any previous
        // errors, flag as pending)
        $rootScope.$on('guacLoginPending', function loginSuccessful() {
            $scope.submitted = true;
            $scope.loginError = null;
        });

        // Retry route upon success (entered values will be cleared only
        // after route change has succeeded as this can take time)
        $rootScope.$on('guacLogin', function loginSuccessful() {
            $route.reload();
        });

        // Reset upon failure
        $rootScope.$on('guacLoginFailed', function loginFailed(event, parameters, error) {

            // Initial submission is complete and has failed
            $scope.submitted = false;

            // Clear out passwords if the credentials were rejected for any reason
            if (error.type !== Error.Type.INSUFFICIENT_CREDENTIALS) {

                // Flag generic error for invalid login
                if (error.type === Error.Type.INVALID_CREDENTIALS)
                    $scope.loginError = {
                        'key' : 'LOGIN.ERROR_INVALID_LOGIN'
                    };

                // Display error if anything else goes wrong
                else
                    $scope.loginError = error.translatableMessage;

                // Reset all remaining fields to default values, but
                // preserve any usernames
                angular.forEach($scope.remainingFields, function clearEnteredValueIfPassword(field) {
                    if (field.type !== Field.Type.USERNAME && field.name in $scope.enteredValues)
                        $scope.enteredValues[field.name] = DEFAULT_FIELD_VALUE;
                });
            }

        });

        // Reset state after authentication and routing have succeeded
        $rootScope.$on('$routeChangeSuccess', function routeChanged() {
            $scope.enteredValues = {};
            $scope.submitted = false;
        });

    }];

    return directive;

}]);
