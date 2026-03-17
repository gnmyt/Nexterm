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
 * Service which defines the ConnectionImportConfig class.
 */
angular.module('import').factory('ConnectionImportConfig', [
        function defineConnectionImportConfig() {

    /**
     * A representation of any user-specified configuration when
     * batch-importing connections.
     *
     * @constructor
     * @param {ConnectionImportConfig|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ConnectionImportConfig.
     */
    const ConnectionImportConfig = function ConnectionImportConfig(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The mode for handling connections that match existing connections.
         *
         * @type ConnectionImportConfig.ExistingConnectionMode
         */
        this.existingConnectionMode = template.existingConnectionMode
                || ConnectionImportConfig.ExistingConnectionMode.REJECT;

        /**
         * The mode for handling permissions on existing connections that are
         * being updated. Only meaningful if the importer is configured to
         * replace existing connections.
         *
         * @type ConnectionImportConfig.ExistingPermissionMode
         */
        this.existingPermissionMode = template.existingPermissionMode
                || ConnectionImportConfig.ExistingPermissionMode.PRESERVE;

    };

    /**
     * Valid modes for the behavior of the importer when an imported connection
     * already exists.
     */
    ConnectionImportConfig.ExistingConnectionMode = {

        /**
         * Any Connection that has the same name and parent group as an existing
         * connection will cause the entire import to be rejected with an error.
         */
        REJECT : "REJECT",

        /**
         * Replace/update any existing connections.
         */
        REPLACE : "REPLACE"

    };

    /**
     * Valid modes for the behavior of the importer with respect to connection
     * permissions when existing connections are being replaced.
     */
    ConnectionImportConfig.ExistingPermissionMode = {

        /**
         * Any new permissions specified in the imported connection will be
         * added to the existing connection, without removing any existing
         * permissions.
         */
        PRESERVE : "PRESERVE",

        /**
         * Any existing permissions will be removed, ensuring that only the
         * users or groups specified in the import file will be granted to the
         * replaced connection after import.
         */
        REPLACE : "REPLACE"

    };

    return ConnectionImportConfig;

}]);