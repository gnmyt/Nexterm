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
 * A service for defining the PermissionFlagSet class.
 */
angular.module('rest').factory('PermissionFlagSet', ['PermissionSet',
    function definePermissionFlagSet(PermissionSet) {

    /**
     * Alternative view of a @link{PermissionSet} which allows manipulation of
     * each permission through the setting (or retrieval) of boolean property
     * values.
     * 
     * @constructor
     * @param {PermissionFlagSet|Object} template 
     *     The object whose properties should be copied within the new
     *     PermissionFlagSet.
     */
    var PermissionFlagSet = function PermissionFlagSet(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The granted state of each system permission, as a map of system
         * permission type string to boolean value. A particular permission is
         * granted if its corresponding boolean value is set to true. Valid
         * permission type strings are defined within
         * PermissionSet.SystemPermissionType. Permissions which are not
         * granted may be set to false, but this is not required.
         * 
         * @type Object.<String, Boolean>
         */
        this.systemPermissions = template.systemPermissions || {};

        /**
         * The granted state of each permission for each connection, as a map
         * of object permission type string to permission map. The permission
         * map is, in turn, a map of connection identifier to boolean value. A
         * particular permission is granted if its corresponding boolean value
         * is set to true. Valid permission type strings are defined within
         * PermissionSet.ObjectPermissionType. Permissions which are not
         * granted may be set to false, but this is not required.
         * 
         * @type Object.<String, Object.<String, Boolean>>
         */
        this.connectionPermissions = template.connectionPermissions || {
            'READ'       : {},
            'UPDATE'     : {},
            'DELETE'     : {},
            'ADMINISTER' : {}
        };

        /**
         * The granted state of each permission for each connection group, as a
         * map of object permission type string to permission map. The
         * permission map is, in turn, a map of connection group identifier to
         * boolean value. A particular permission is granted if its
         * corresponding boolean value is set to true. Valid permission type
         * strings are defined within PermissionSet.ObjectPermissionType.
         * Permissions which are not granted may be set to false, but this is
         * not required.
         * 
         * @type Object.<String, Object.<String, Boolean>>
         */
        this.connectionGroupPermissions = template.connectionGroupPermissions || {
            'READ'       : {},
            'UPDATE'     : {},
            'DELETE'     : {},
            'ADMINISTER' : {}
        };

        /**
         * The granted state of each permission for each sharing profile, as a
         * map of object permission type string to permission map. The
         * permission map is, in turn, a map of sharing profile identifier to
         * boolean value. A particular permission is granted if its
         * corresponding boolean value is set to true. Valid permission type
         * strings are defined within PermissionSet.ObjectPermissionType.
         * Permissions which are not granted may be set to false, but this is
         * not required.
         *
         * @type Object.<String, Object.<String, Boolean>>
         */
        this.sharingProfilePermissions = template.sharingProfilePermissions || {
            'READ'       : {},
            'UPDATE'     : {},
            'DELETE'     : {},
            'ADMINISTER' : {}
        };

        /**
         * The granted state of each permission for each active connection, as
         * a map of object permission type string to permission map. The
         * permission map is, in turn, a map of active connection identifier to
         * boolean value. A particular permission is granted if its
         * corresponding boolean value is set to true. Valid permission type
         * strings are defined within PermissionSet.ObjectPermissionType.
         * Permissions which are not granted may be set to false, but this is
         * not required.
         * 
         * @type Object.<String, Object.<String, Boolean>>
         */
        this.activeConnectionPermissions = template.activeConnectionPermissions || {
            'READ'       : {},
            'UPDATE'     : {},
            'DELETE'     : {},
            'ADMINISTER' : {}
        };

        /**
         * The granted state of each permission for each user, as a map of
         * object permission type string to permission map. The permission map
         * is, in turn, a map of username to boolean value. A particular
         * permission is granted if its corresponding boolean value is set to
         * true. Valid permission type strings are defined within
         * PermissionSet.ObjectPermissionType. Permissions which are not
         * granted may be set to false, but this is not required.
         *
         * @type Object.<String, Object.<String, Boolean>>
         */
        this.userPermissions = template.userPermissions || {
            'READ'       : {},
            'UPDATE'     : {},
            'DELETE'     : {},
            'ADMINISTER' : {}
        };

        /**
         * The granted state of each permission for each user group, as a map of
         * object permission type string to permission map. The permission map
         * is, in turn, a map of group identifier to boolean value. A particular
         * permission is granted if its corresponding boolean value is set to
         * true. Valid permission type strings are defined within
         * PermissionSet.ObjectPermissionType. Permissions which are not
         * granted may be set to false, but this is not required.
         *
         * @type Object.<String, Object.<String, Boolean>>
         */
        this.userGroupPermissions = template.userGroupPermissions || {
            'READ'       : {},
            'UPDATE'     : {},
            'DELETE'     : {},
            'ADMINISTER' : {}
        };

    };

    /**
     * Iterates through all permissions in the given permission map, setting
     * the corresponding permission flags in the given permission flag map.
     *
     * @param {Object.<String, String[]>} permMap
     *     Map of object identifiers to the set of granted permissions. Each
     *     permission is represented by a string listed within
     *     PermissionSet.ObjectPermissionType.
     *
     * @param {Object.<String, Object.<String, Boolean>>} flagMap
     *     Map of permission type strings to identifier/flag pairs representing
     *     whether the permission of that type is granted for the object having
     *     having the associated identifier.
     */
    var addObjectPermissions = function addObjectPermissions(permMap, flagMap) {

        // For each defined identifier in the permission map
        for (var identifier in permMap) {

            // Pull the permission array and loop through each permission
            var permissions = permMap[identifier];
            permissions.forEach(function addObjectPermission(type) {

                // Get identifier/flag mapping, creating first if necessary
                var objectFlags = flagMap[type] = flagMap[type] || {};

                // Set flag for current permission
                objectFlags[identifier] = true;

            });

        }

    };

    /**
     * Creates a new PermissionFlagSet, populating it with all the permissions
     * indicated as granted within the given PermissionSet.
     *
     * @param {PermissionSet} permissionSet
     *     The PermissionSet containing the permissions to be copied into a new
     *     PermissionFlagSet.
     *
     * @returns {PermissionFlagSet}
     *     A new PermissionFlagSet containing flags representing all granted
     *     permissions from the given PermissionSet.
     */
    PermissionFlagSet.fromPermissionSet = function fromPermissionSet(permissionSet) {

        var permissionFlagSet = new PermissionFlagSet();

        // Add all granted system permissions
        permissionSet.systemPermissions.forEach(function addSystemPermission(type) {
            permissionFlagSet.systemPermissions[type] = true;
        });

        // Add all granted connection permissions
        addObjectPermissions(permissionSet.connectionPermissions, permissionFlagSet.connectionPermissions);

        // Add all granted connection group permissions
        addObjectPermissions(permissionSet.connectionGroupPermissions, permissionFlagSet.connectionGroupPermissions);

        // Add all granted sharing profile permissions
        addObjectPermissions(permissionSet.sharingProfilePermissions, permissionFlagSet.sharingProfilePermissions);

        // Add all granted active connection permissions
        addObjectPermissions(permissionSet.activeConnectionPermissions, permissionFlagSet.activeConnectionPermissions);

        // Add all granted user permissions
        addObjectPermissions(permissionSet.userPermissions, permissionFlagSet.userPermissions);

        // Add all granted user group permissions
        addObjectPermissions(permissionSet.userGroupPermissions, permissionFlagSet.userGroupPermissions);

        return permissionFlagSet;

    };

    return PermissionFlagSet;

}]);