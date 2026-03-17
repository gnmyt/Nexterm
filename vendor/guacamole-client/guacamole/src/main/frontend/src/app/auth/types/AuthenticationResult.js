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
 * Service which defines the AuthenticationResult class.
 */
angular.module('auth').factory('AuthenticationResult', [function defineAuthenticationResult() {
            
    /**
     * The object returned by REST API calls when representing the successful
     * result of an authentication attempt.
     * 
     * @constructor
     * @param {AuthenticationResult|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     AuthenticationResult.
     */
    var AuthenticationResult = function AuthenticationResult(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The unique token generated for the user that authenticated.
         *
         * @type String
         */
        this.authToken = template.authToken;

        /**
         * The name which uniquely identifies the user that authenticated.
         *
         * @type String
         */
        this.username = template.username;

        /**
         * The unique identifier of the data source which authenticated the
         * user.
         *
         * @type String
         */
        this.dataSource = template.dataSource;

        /**
         * The identifiers of all data sources available to the user that
         * authenticated.
         *
         * @type String[]
         */
        this.availableDataSources = template.availableDataSources;

    };

    /**
     * The username reserved by the Guacamole extension API for users which have
     * authenticated anonymously.
     *
     * @type String
     */
    AuthenticationResult.ANONYMOUS_USERNAME = '';

    return AuthenticationResult;

}]);
