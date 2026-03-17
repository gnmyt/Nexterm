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
 * Service which defines the ParseResult class.
 */
angular.module('import').factory('ParseResult', [function defineParseResult() {

    /**
     * The result of parsing a connection import file - containing a list of
     * API patches ready to be submitted to the PATCH REST API for batch
     * connection creation/replacement, a set of users and user groups to grant
     * access to each connection, a group path for every connection, and any
     * errors that may have occurred while parsing each connection.
     *
     * @constructor
     * @param {ParseResult|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ParseResult.
     */
    const ParseResult = function ParseResult(template) {

        // Use empty object by default
        template = template || {};

        /**
         * An array of patches, ready to be submitted to the PATCH REST API for
         * batch connection creation / replacement. Note that this array may 
         * contain more patches than connections from the original file - in the 
         * case that connections are being fully replaced, there will be a 
         * remove and a create patch for each replaced connection.
         *
         * @type {DirectoryPatch[]}
         */
        this.patches = template.patches || [];

        /**
         * An object whose keys are the user identifiers of users specified
         * in the batch import, and whose values are an array of indices of
         * connections within the patches array to which those users should be
         * granted access.
         *
         * @type {Object.<String, Integer[]>}
         */
        this.users = template.users || {};

        /**
         * An object whose keys are the user group identifiers of every user
         * group specified in the batch import. i.e. a set of all user group
         * identifiers.
         *
         * @type {Object.<String, Boolean>}
         */
        this.groups = template.users || {};

        /**
         * A map of connection index within the patch array, to connection group
         * path for that connection, of the form "ROOT/Parent/Child".
         *
         * @type {Object.<String, String>}
         */
        this.groupPaths = template.groupPaths || {};

        /**
         * An array of errors encountered while parsing the corresponding
         * connection (at the same array index in the patches array). Each 
         * connection should have an array of errors. If empty, no errors
         * occurred for this connection.
         *
         * @type {ParseError[][]}
         */
        this.errors = template.errors || [];

        /**
         * True if any errors were encountered while parsing the connections
         * represented by this ParseResult. This should always be true if there
         * are a non-zero number of elements in the errors list for any
         * connection, or false otherwise.
         *
         * @type {Boolean}
         */
        this.hasErrors = template.hasErrors || false;

        /**
         * The integer number of unique connections present in the parse result.
         * This may be less than the length of the patches array, if any REMOVE
         * patches are present.
         *
         * @Type {Number}
         */
        this.connectionCount = template.connectionCount || 0;

    };

    return ParseResult;

}]);
