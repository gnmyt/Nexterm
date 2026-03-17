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
 * Service which defines the UserPasswordUpdate class.
 */
angular.module('rest').factory('UserPasswordUpdate', [function defineUserPasswordUpdate() {
            
    /**
     * The object sent to the REST API when representing the data
     * associated with a user password update.
     * 
     * @constructor
     * @param {UserPasswordUpdate|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     UserPasswordUpdate.
     */
    var UserPasswordUpdate = function UserPasswordUpdate(template) {

        // Use empty object by default
        template = template || {};

        /**
         * This user's current password. Required for authenticating the user
         * as part of to the password update operation.
         * 
         * @type String
         */
        this.oldPassword = template.oldPassword;

        /**
         * The new password to set for the user.
         * 
         * @type String
         */
        this.newPassword = template.newPassword;

    };

    return UserPasswordUpdate;

}]);