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
 * Factory for session-local storage. Creating session-local storage creates a
 * getter/setter with semantics tied to the user's session. If a user is logged
 * in, the storage is consistent. If the user logs out, the storage will not
 * persist new values, and attempts to retrieve the existing value will result
 * only in the default value.
 */
angular.module('storage').factory('sessionStorageFactory', ['$injector', function sessionStorageFactory($injector) {

    // Required services
    var $rootScope            = $injector.get('$rootScope');
    var authenticationService = $injector.get('authenticationService');

    var service = {};

    /**
     * Creates session-local storage that uses the provided default value or
     * getter to obtain new values as necessary. Beware that if the default is
     * an object, the resulting getter provide deep copies for new values.
     *
     * @param {Function|*} [template]
     *     The default value for new users, or a getter which returns a newly-
     *     created default value.
     *
     * @param {Function} [destructor]
     *     Function which will be called just before the stored value is
     *     destroyed on logout, if a value is stored.
     *
     * @returns {Function}
     *     A getter/setter which returns or sets the current value of the new
     *     session-local storage. Newly-set values will only persist of the
     *     user is actually logged in.
     */
    service.create = function create(template, destructor) {

        /**
         * Whether new values may be stored and retrieved.
         *
         * @type Boolean
         */
        var enabled = !!authenticationService.getCurrentToken();

        /**
         * Getter which returns the default value for this storage.
         *
         * @type Function
         */
        var getter;

        // If getter provided, use that
        if (typeof template === 'function')
            getter = template;

        // Otherwise, create and maintain a deep copy (automatically cached to
        // avoid "infdig" errors)
        else {
            var cached = angular.copy(template);
            getter = function getIndependentCopy() {

                // Reset to template only if changed externally, such that
                // session storage values can be safely used in scope watches
                // even if not logged in
                if (!_.isEqual(cached, template))
                    cached = angular.copy(template);

                return cached;

            };
        }

        /**
         * The current value of this storage, or undefined if not yet set.
         */
        var value = undefined;

        // Reset value and allow storage when the user is logged in
        $rootScope.$on('guacLogin', function userLoggedIn() {
            enabled = true;
            value = undefined;
        });

        // Reset value and disallow storage when the user is logged out
        $rootScope.$on('guacLogout', function userLoggedOut() {

            // Call destructor before storage is teared down
            if (angular.isDefined(value) && destructor)
                destructor(value);

            // Destroy storage
            enabled = false;
            value = undefined;

        });

        // Return getter/setter for value
        return function sessionLocalGetterSetter(newValue) {

            // Only actually store/retrieve values if enabled
            if (enabled) {

                // Set value if provided
                if (angular.isDefined(newValue))
                    value = newValue;

                // Obtain new value if unset
                if (!angular.isDefined(value))
                    value = getter();

                // Return current value
                return value;

            }

            // Otherwise, just pretend to store/retrieve
            return angular.isDefined(newValue) ? newValue : getter();

        };

    };

    return service;

}]);
