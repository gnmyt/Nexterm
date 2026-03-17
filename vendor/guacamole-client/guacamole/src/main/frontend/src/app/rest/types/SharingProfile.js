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
 * Service which defines the SharingProfile class.
 */
angular.module('rest').factory('SharingProfile', [function defineSharingProfile() {
            
    /**
     * The object returned by REST API calls when representing the data
     * associated with a sharing profile.
     * 
     * @constructor
     * @param {SharingProfile|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     SharingProfile.
     */
    var SharingProfile = function SharingProfile(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The unique identifier associated with this sharing profile.
         *
         * @type String
         */
        this.identifier = template.identifier;

        /**
         * The unique identifier of the connection that this sharing profile
         * can be used to share.
         * 
         * @type String
         */
        this.primaryConnectionIdentifier = template.primaryConnectionIdentifier;

        /**
         * The human-readable name of this sharing profile, which is not
         * necessarily unique.
         * 
         * @type String
         */
        this.name = template.name;

        /**
         * Connection configuration parameters, as dictated by the protocol in
         * use by the primary connection, arranged as name/value pairs. This
         * information may not be available until directly queried. If this
         * information is unavailable, this property will be null or undefined.
         *
         * @type Object.<String, String>
         */
        this.parameters = template.parameters;

        /**
         * Arbitrary name/value pairs which further describe this sharing
         * profile. The semantics and validity of these attributes are dictated
         * by the extension which defines them.
         *
         * @type Object.<String, String>
         */
        this.attributes = template.attributes || {};

    };

    return SharingProfile;

}]);