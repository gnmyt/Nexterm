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
 * Service which defines the DirectoryPatch class.
 */
angular.module('rest').factory('DirectoryPatch', [function defineDirectoryPatch() {
            
    /**
     * The object consumed by REST API calls when representing changes to an
     * arbitrary set of directory-based objects.
     * @constructor
     * 
     * @template DirectoryObject
     *     The directory-based object type that this DirectoryPatch will 
     *     operate on.
     * 
     * @param {DirectoryObject|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     DirectoryPatch.
     */
    var DirectoryPatch = function DirectoryPatch(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The operation to apply to the objects indicated by the path. Valid
         * operation values are defined within DirectoryPatch.Operation.
         *
         * @type {String}
         */
        this.op = template.op;

        /**
         * The path of the objects to modify. For creation of new objects, this
         * should be "/". Otherwise, it should be "/{identifier}", specifying
         * the identifier of the existing object being modified.
         *
         * @type {String}
         * @default '/'
         */
        this.path = template.path || '/';

        /**
         * The object being added/replaced, or undefined if deleting.
         *
         * @type {DirectoryObject}
         */
        this.value = template.value;

    };

    /**
     * All valid patch operations for directory-based objects.
     */
    DirectoryPatch.Operation = {

        /**
         * Adds the specified object to the relation.
         */
        ADD : 'add',

        /**
         * Replaces (updates) the specified object from the relation.
         */
        REPLACE : 'replace',

        /**
         * Removes the specified object from the relation.
         */
        REMOVE : 'remove'

    };

    return DirectoryPatch;

}]);
