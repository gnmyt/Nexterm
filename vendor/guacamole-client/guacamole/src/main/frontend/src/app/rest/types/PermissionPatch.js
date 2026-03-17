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
 * Service which defines the PermissionPatch class.
 */
angular.module('rest').factory('PermissionPatch', [function definePermissionPatch() {
            
    /**
     * The object returned by REST API calls when representing changes to the
     * permissions granted to a specific user.
     * 
     * @constructor
     * @param {PermissionPatch|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     PermissionPatch.
     */
    var PermissionPatch = function PermissionPatch(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The operation to apply to the permissions indicated by the path.
         * Valid operation values are defined within PermissionPatch.Operation.
         *
         * @type String
         */
        this.op = template.op;

        /**
         * The path of the permissions to modify. Depending on the type of the
         * permission, this will be either "/connectionPermissions/ID",
         * "/connectionGroupPermissions/ID", "/userPermissions/ID", or
         * "/systemPermissions", where "ID" is the identifier of the object
         * to which the permissions apply, if any.
         *
         * @type String
         */
        this.path = template.path;

        /**
         * The permissions being added or removed. If the permission applies to
         * an object, such as a connection or connection group, this will be a
         * value from PermissionSet.ObjectPermissionType. If the permission
         * applies to the system as a whole (the path is "/systemPermissions"),
         * this will be a value from PermissionSet.SystemPermissionType.
         *
         * @type String
         */
        this.value = template.value;

    };

    /**
     * All valid patch operations for permissions. Currently, only add and
     * remove are supported.
     */
    PermissionPatch.Operation = {

        /**
         * Adds (grants) the specified permission.
         */
        ADD : "add",

        /**
         * Removes (revokes) the specified permission.
         */
        REMOVE : "remove"

    };

    return PermissionPatch;

}]);