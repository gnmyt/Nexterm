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
 * Service which defines the UserGroup class.
 */
angular.module('rest').factory('UserGroup', [function defineUserGroup() {

    /**
     * The object returned by REST API calls when representing the data
     * associated with a user group.
     *
     * @constructor
     * @param {UserGroup|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     UserGroup.
     */
    var UserGroup = function UserGroup(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The name which uniquely identifies this user group.
         *
         * @type String
         */
        this.identifier = template.identifier;
        
        /**
         * True if this user group is disabled, otherwise false.
         * 
         * @type boolean
         */
        this.disabled = template.disabled;

        /**
         * Arbitrary name/value pairs which further describe this user group.
         * The semantics and validity of these attributes are dictated by the
         * extension which defines them.
         *
         * @type Object.<String, String>
         */
        this.attributes = template.attributes || {};

    };

    return UserGroup;

}]);