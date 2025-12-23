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
 * A service for defining the ManageableUser class.
 */
angular.module('manage').factory('ManageableUser', [function defineManageableUser() {

    /**
     * A pairing of an @link{User} with the identifier of its corresponding
     * data source.
     *
     * @constructor
     * @param {Object|ManageableUser} template
     */
    var ManageableUser = function ManageableUser(template) {

        /**
         * The unique identifier of the data source containing this user.
         *
         * @type String
         */
        this.dataSource = template.dataSource;

        /**
         * The @link{User} object represented by this ManageableUser and
         * contained within the associated data source.
         *
         * @type User
         */
        this.user = template.user;
        
        /**
         * Return true if the underlying user account is disabled, otherwise
         * return false.
         * 
         * @returns
         *     True if the underlying user account is disabled, otherwise false.
         */
        this.isDisabled = function isDisabled() {
            return template.user.disabled;
        };

    };

    return ManageableUser;

}]);
