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
 * Service for operating on sharing profiles via the REST API.
 */
angular.module('rest').factory('sharingProfileService', ['$injector',
        function sharingProfileService($injector) {

    // Required services
    var requestService        = $injector.get('requestService');
    var authenticationService = $injector.get('authenticationService');
    var cacheService          = $injector.get('cacheService');
    
    var service = {};
    
    /**
     * Makes a request to the REST API to get a single sharing profile,
     * returning a promise that provides the corresponding @link{SharingProfile}
     * if successful.
     * 
     * @param {String} id The ID of the sharing profile.
     * 
     * @returns {Promise.<SharingProfile>}
     *     A promise which will resolve with a @link{SharingProfile} upon
     *     success.
     * 
     * @example
     * 
     * sharingProfileService.getSharingProfile('mySharingProfile').then(function(sharingProfile) {
     *     // Do something with the sharing profile
     * });
     */
    service.getSharingProfile = function getSharingProfile(dataSource, id) {

        // Retrieve sharing profile
        return authenticationService.request({
            cache   : cacheService.connections,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/sharingProfiles/' + encodeURIComponent(id)
        });

    };

    /**
     * Makes a request to the REST API to get the parameters of a single
     * sharing profile, returning a promise that provides the corresponding
     * map of parameter name/value pairs if successful.
     * 
     * @param {String} id
     *     The identifier of the sharing profile.
     * 
     * @returns {Promise.<Object.<String, String>>}
     *     A promise which will resolve with an map of parameter name/value
     *     pairs upon success.
     */
    service.getSharingProfileParameters = function getSharingProfileParameters(dataSource, id) {

        // Retrieve sharing profile parameters
        return authenticationService.request({
            cache   : cacheService.connections,
            method  : 'GET',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/sharingProfiles/' + encodeURIComponent(id) + '/parameters'
        });
 
    };

    /**
     * Makes a request to the REST API to save a sharing profile, returning a
     * promise that can be used for processing the results of the call. If the
     * sharing profile is new, and thus does not yet have an associate
     * identifier, the identifier will be automatically set in the provided
     * sharing profile upon success.
     * 
     * @param {SharingProfile} sharingProfile
     *     The sharing profile to update.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     save operation is successful.
     */
    service.saveSharingProfile = function saveSharingProfile(dataSource, sharingProfile) {
        
        // If sharing profile is new, add it and set the identifier automatically
        if (!sharingProfile.identifier) {
            return authenticationService.request({
                method  : 'POST',
                url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/sharingProfiles',
                data    : sharingProfile
            })

            // Set the identifier on the new sharing profile and clear the cache
            .then(function sharingProfileCreated(newSharingProfile){
                sharingProfile.identifier = newSharingProfile.identifier;
                cacheService.connections.removeAll();

                // Clear users cache to force reload of permissions for this
                // newly created sharing profile
                cacheService.users.removeAll();
            });
        }

        // Otherwise, update the existing sharing profile
        else {
            return authenticationService.request({
                method  : 'PUT',
                url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/sharingProfiles/' + encodeURIComponent(sharingProfile.identifier),
                data    : sharingProfile
            })
            
            // Clear the cache
            .then(function sharingProfileUpdated(){
                cacheService.connections.removeAll();

                // Clear users cache to force reload of permissions for this
                // newly updated sharing profile
                cacheService.users.removeAll();
            });
        }

    };
    
    /**
     * Makes a request to the REST API to delete a sharing profile,
     * returning a promise that can be used for processing the results of the call.
     * 
     * @param {SharingProfile} sharingProfile
     *     The sharing profile to delete.
     *                          
     * @returns {Promise}
     *     A promise for the HTTP call which will succeed if and only if the
     *     delete operation is successful.
     */
    service.deleteSharingProfile = function deleteSharingProfile(dataSource, sharingProfile) {

        // Delete sharing profile
        return authenticationService.request({
            method  : 'DELETE',
            url     : 'api/session/data/' + encodeURIComponent(dataSource) + '/sharingProfiles/' + encodeURIComponent(sharingProfile.identifier)
        })

        // Clear the cache
        .then(function sharingProfileDeleted(){
            cacheService.connections.removeAll();
        });

    };
    
    return service;
}]);
