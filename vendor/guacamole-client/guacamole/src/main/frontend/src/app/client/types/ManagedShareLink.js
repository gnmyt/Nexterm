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
 * Provides the ManagedShareLink class used by ManagedClient to represent
 * generated connection sharing links.
 */
angular.module('client').factory('ManagedShareLink', ['$injector',
    function defineManagedShareLink($injector) {

    // Required types
    var UserCredentials = $injector.get('UserCredentials');

    /**
     * Object which represents a link which can be used to gain access to an
     * active Guacamole connection.
     * 
     * @constructor
     * @param {ManagedShareLink|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ManagedShareLink.
     */
    var ManagedShareLink = function ManagedShareLink(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The human-readable display name of this share link.
         *
         * @type String
         */
        this.name = template.name;

        /**
         * The actual URL of the link which can be used to access the shared
         * connection.
         *
         * @type String
         */
        this.href = template.href;

        /**
         * The sharing profile which was used to generate the share link.
         *
         * @type SharingProfile
         */
        this.sharingProfile = template.sharingProfile;

        /**
         * The credentials from which the share link was derived.
         *
         * @type UserCredentials
         */
        this.sharingCredentials = template.sharingCredentials;

    };

    /**
     * Creates a new ManagedShareLink from a set of UserCredentials and the
     * SharingProfile which was used to generate those UserCredentials.
     * 
     * @param {SharingProfile} sharingProfile
     *     The SharingProfile which was used, via the REST API, to generate the
     *     given UserCredentials.
     * 
     * @param {UserCredentials} sharingCredentials
     *     The UserCredentials object returned by the REST API in response to a
     *     request to share a connection using the given SharingProfile.
     *
     * @return {ManagedShareLink}
     *     A new ManagedShareLink object can be used to access the connection
     *     shared via the given SharingProfile and resulting UserCredentials.
     */
    ManagedShareLink.getInstance = function getInstance(sharingProfile, sharingCredentials) {

        // Generate new share link using the given profile and credentials
        return new ManagedShareLink({
            'name'               : sharingProfile.name,
            'href'               : UserCredentials.getLink(sharingCredentials),
            'sharingProfile'     : sharingProfile,
            'sharingCredentials' : sharingCredentials
        });

    };

    return ManagedShareLink;

}]);
