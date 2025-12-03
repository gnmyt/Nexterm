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
 * Service which defines the User class.
 */
angular.module('rest').factory('User', [function defineUser() {
            
    /**
     * The object returned by REST API calls when representing the data
     * associated with a user.
     * 
     * @constructor
     * @param {User|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     User.
     */
    var User = function User(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The name which uniquely identifies this user.
         *
         * @type String
         */
        this.username = template.username;

        /**
         * This user's password. Note that the REST API may not populate this
         * property for the sake of security. In most cases, it's not even
         * possible for the authentication layer to retrieve the user's true
         * password.
         * 
         * @type String
         */
        this.password = template.password;

        /**
         * The time that this user was last logged in, in milliseconds since
         * 1970-01-01 00:00:00 UTC. If this information is unknown or
         * unavailable, this will be null.
         *
         * @type Number
         */
        this.lastActive = template.lastActive;
        
        /**
         * True if this user account is disabled, otherwise false.
         * 
         * @type boolean
         */
        this.disabled = template.disabled;

        /**
         * Arbitrary name/value pairs which further describe this user. The
         * semantics and validity of these attributes are dictated by the
         * extension which defines them.
         *
         * @type Object.<String, String>
         */
        this.attributes = template.attributes || {};

    };

    /**
     * All standard attribute names with semantics defined by the Guacamole web
     * application. Extensions may additionally define their own attributes
     * with completely arbitrary names and semantics, so long as those names do
     * not conflict with the names listed here. All standard attribute names
     * have a "guac-" prefix to avoid such conflicts.
     */
    User.Attributes = {

        /**
         * The user's full name.
         *
         * @type String
         */
        FULL_NAME : 'guac-full-name',

        /**
         * The email address of the user.
         *
         * @type String
         */
        EMAIL_ADDRESS : 'guac-email-address',

        /**
         * The organization, company, group, etc. that the user belongs to.
         *
         * @type String
         */
        ORGANIZATION : 'guac-organization',

        /**
         * The role that the user has at the organization, company, group, etc.
         * they belong to.
         *
         * @type String
         */
        ORGANIZATIONAL_ROLE : 'guac-organizational-role'

    };

    return User;

}]);