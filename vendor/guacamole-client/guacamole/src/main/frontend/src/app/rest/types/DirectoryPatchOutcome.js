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
 * Service which defines the DirectoryPatchOutcome class.
 */
angular.module('rest').factory('DirectoryPatchOutcome', [
        function defineDirectoryPatchOutcome() {
            
    /**
     * An object returned by a PATCH request to a directory REST API, 
     * representing the outcome associated with a particular patch in the
     * request. This object can indicate either a successful or unsuccessful 
     * response. The error field is only meaningful for unsuccessful patches.
     * @constructor
     * 
     * @param {DirectoryPatchOutcome|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     DirectoryPatchOutcome.
     */
    const DirectoryPatchOutcome = function DirectoryPatchOutcome(template) {

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
         * The path of the object operated on by the corresponding patch in the
         * request.
         *
         * @type {String}
         */
        this.path = template.path;

        /**
         * The identifier of the object operated on by the corresponding patch
         * in the request. If the object was newly created and the PATCH request
         * did not fail, this will be the identifier of the newly created object.
         *
         * @type {String}
         */
        this.identifier = template.identifier;

        /**
         * The error message associated with the failure, if the patch failed to
         * apply.
         *
         * @type {TranslatableMessage}
         */
        this.error = template.error;

    };

    return DirectoryPatchOutcome;

}]);
