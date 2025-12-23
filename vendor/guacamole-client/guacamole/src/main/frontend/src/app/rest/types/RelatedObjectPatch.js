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
 * Service which defines the RelatedObjectPatch class.
 */
angular.module('rest').factory('RelatedObjectPatch', [function defineRelatedObjectPatch() {
            
    /**
     * The object returned by REST API calls when representing changes to an
     * arbitrary set of objects which share some common relation.
     * 
     * @constructor
     * @param {RelatedObjectPatch|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     RelatedObjectPatch.
     */
    var RelatedObjectPatch = function RelatedObjectPatch(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The operation to apply to the objects indicated by the path. Valid
         * operation values are defined within RelatedObjectPatch.Operation.
         *
         * @type String
         */
        this.op = template.op;

        /**
         * The path of the objects to modify. This will always be "/".
         *
         * @type String
         * @default '/'
         */
        this.path = template.path || '/';

        /**
         * The identifier of the object being added or removed from the
         * relation.
         *
         * @type String
         */
        this.value = template.value;

    };

    /**
     * All valid patch operations for objects sharing some common relation.
     * Currently, only add and remove are supported.
     */
    RelatedObjectPatch.Operation = {

        /**
         * Adds the specified object to the relation.
         */
        ADD : "add",

        /**
         * Removes the specified object from the relation.
         */
        REMOVE : "remove"

    };

    return RelatedObjectPatch;

}]);
