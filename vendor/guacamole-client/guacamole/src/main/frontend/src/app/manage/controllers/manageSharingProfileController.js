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
 * The controller for editing or creating sharing profiles.
 */
angular.module('manage').controller('manageSharingProfileController', ['$scope', '$injector',
        function manageSharingProfileController($scope, $injector) {

    // Required types
    var ManagementPermissions = $injector.get('ManagementPermissions');
    var SharingProfile        = $injector.get('SharingProfile');
    var PermissionSet         = $injector.get('PermissionSet');
    var Protocol              = $injector.get('Protocol');

    // Required services
    var $location                = $injector.get('$location');
    var $q                       = $injector.get('$q');
    var $routeParams             = $injector.get('$routeParams');
    var $window                  = $injector.get('$window');
    var authenticationService    = $injector.get('authenticationService');
    var connectionService        = $injector.get('connectionService');
    var permissionService        = $injector.get('permissionService');
    var requestService           = $injector.get('requestService');
    var schemaService            = $injector.get('schemaService');
    var sharingProfileService    = $injector.get('sharingProfileService');

    /**
     * The unique identifier of the data source containing the sharing profile
     * being edited.
     *
     * @type String
     */
    $scope.selectedDataSource = $routeParams.dataSource;

    /**
     * The identifier of the original sharing profile from which this sharing
     * profile is being cloned. Only valid if this is a new sharing profile.
     *
     * @type String
     */
    var cloneSourceIdentifier = $location.search().clone;

    /**
     * The identifier of the sharing profile being edited. If a new sharing
     * profile is being created, this will not be defined.
     *
     * @type String
     */
    var identifier = $routeParams.id;

    /**
     * Map of protocol name to corresponding Protocol object.
     *
     * @type Object.<String, Protocol>
     */
    $scope.protocols = null;

    /**
     * The sharing profile being modified.
     *
     * @type SharingProfile
     */
    $scope.sharingProfile = null;

    /**
     * The parameter name/value pairs associated with the sharing profile being
     * modified.
     *
     * @type Object.<String, String>
     */
    $scope.parameters = null;

    /**
     * The management-related actions that the current user may perform on the
     * sharing profile currently being created/modified, or null if the current
     * user's permissions have not yet been loaded.
     *
     * @type ManagementPermissions
     */
    $scope.managementPermissions = null;

    /**
     * All available sharing profile attributes. This is only the set of
     * attribute definitions, organized as logical groupings of attributes, not
     * attribute values.
     *
     * @type Form[]
     */
    $scope.attributes = null;

    /**
     * Returns whether critical data has completed being loaded.
     *
     * @returns {Boolean}
     *     true if enough data has been loaded for the user interface to be
     *     useful, false otherwise.
     */
    $scope.isLoaded = function isLoaded() {

        return $scope.protocols               !== null
            && $scope.sharingProfile          !== null
            && $scope.primaryConnection       !== null
            && $scope.parameters              !== null
            && $scope.managementPermissions   !== null
            && $scope.attributes              !== null;

    };

    /**
     * Loads the data associated with the sharing profile having the given
     * identifier, preparing the interface for making modifications to that
     * existing sharing profile.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the sharing
     *     profile to load.
     *
     * @param {String} identifier
     *     The identifier of the sharing profile to load.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     editing the given sharing profile.
     */
    var loadExistingSharingProfile = function loadExistingSharingProfile(dataSource, identifier) {
        return $q.all({
            sharingProfile : sharingProfileService.getSharingProfile(dataSource, identifier),
            parameters     : sharingProfileService.getSharingProfileParameters(dataSource, identifier)
        })
        .then(function sharingProfileDataRetrieved(values) {

            $scope.sharingProfile = values.sharingProfile;
            $scope.parameters = values.parameters;

            // Load connection object for associated primary connection
            return connectionService.getConnection(
                dataSource,
                values.sharingProfile.primaryConnectionIdentifier
            )
            .then(function connectionRetrieved(connection) {
                $scope.primaryConnection = connection;
            });

        });
    };

    /**
     * Loads the data associated with the sharing profile having the given
     * identifier, preparing the interface for cloning that existing
     * sharing profile.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the sharing
     *     profile to be cloned.
     *
     * @param {String} identifier
     *     The identifier of the sharing profile being cloned.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     cloning the given sharing profile.
     */
    var loadClonedSharingProfile = function loadClonedSharingProfile(dataSource, identifier) {
        return $q.all({
            sharingProfile : sharingProfileService.getSharingProfile(dataSource, identifier),
            parameters     : sharingProfileService.getSharingProfileParameters(dataSource, identifier)
        })
        .then(function sharingProfileDataRetrieved(values) {

            $scope.sharingProfile = values.sharingProfile;
            $scope.parameters = values.parameters;

            // Clear the identifier field because this sharing profile is new
            delete $scope.sharingProfile.identifier;

            // Load connection object for associated primary connection
            return connectionService.getConnection(
                dataSource,
                values.sharingProfile.primaryConnectionIdentifier
            )
            .then(function connectionRetrieved(connection) {
                $scope.primaryConnection = connection;
            });

        });
    };

    /**
     * Loads skeleton sharing profile data, preparing the interface for
     * creating a new sharing profile.
     *
     * @param {String} dataSource
     *     The unique identifier of the data source containing the sharing
     *     profile to be created.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared for
     *     creating a new sharing profile.
     */
    var loadSkeletonSharingProfile = function loadSkeletonSharingProfile(dataSource) {

        // Use skeleton sharing profile object with no associated parameters
        $scope.sharingProfile = new SharingProfile({
            primaryConnectionIdentifier : $location.search().parent
        });
        $scope.parameters = {};

        // Load connection object for associated primary connection
        return connectionService.getConnection(
            dataSource,
            $scope.sharingProfile.primaryConnectionIdentifier
        )
        .then(function connectionRetrieved(connection) {
            $scope.primaryConnection = connection;
        });

    };

    /**
     * Loads the data required for performing the management task requested
     * through the route parameters given at load time, automatically preparing
     * the interface for editing an existing sharing profile, cloning an
     * existing sharing profile, or creating an entirely new sharing profile.
     *
     * @returns {Promise}
     *     A promise which is resolved when the interface has been prepared
     *     for performing the requested management task.
     */
    var loadRequestedSharingProfile = function loadRequestedSharingProfile() {

        // If we are editing an existing sharing profile, pull its data
        if (identifier)
            return loadExistingSharingProfile($scope.selectedDataSource, identifier);

        // If we are cloning an existing sharing profile, pull its data instead
        if (cloneSourceIdentifier)
            return loadClonedSharingProfile($scope.selectedDataSource, cloneSourceIdentifier);

        // If we are creating a new sharing profile, populate skeleton sharing
        // profile data
        return loadSkeletonSharingProfile($scope.selectedDataSource);

    };


    // Query the user's permissions for the current sharing profile
    $q.all({
        sharingProfileData : loadRequestedSharingProfile(),
        attributes  : schemaService.getSharingProfileAttributes($scope.selectedDataSource),
        protocols   : schemaService.getProtocols($scope.selectedDataSource),
        permissions : permissionService.getEffectivePermissions($scope.selectedDataSource, authenticationService.getCurrentUsername())
    })
    .then(function sharingProfileDataRetrieved(values) {

        $scope.attributes = values.attributes;
        $scope.protocols = values.protocols;

        $scope.managementPermissions = ManagementPermissions.fromPermissionSet(
                    values.permissions,
                    PermissionSet.SystemPermissionType.CREATE_CONNECTION,
                    PermissionSet.hasConnectionPermission,
                    identifier);

    }, requestService.DIE);

    /**
     * @borrows Protocol.getNamespace
     */
    $scope.getNamespace = Protocol.getNamespace;

    /**
     * Cancels all pending edits, returning to the main list of connections
     * within the selected data source.
     */
    $scope.returnToConnectionList = function returnToConnectionList() {
        $location.url('/settings/' + encodeURIComponent($scope.selectedDataSource) + '/connections');
    };

    /**
     * Cancels all pending edits, opening an edit page for a new sharing profile
     * which is prepopulated with the data from the sharing profile currently
     * being edited.
     */
    $scope.cloneSharingProfile = function cloneSharingProfile() {
        $location.path('/manage/' + encodeURIComponent($scope.selectedDataSource) + '/sharingProfiles').search('clone', identifier);
        $window.scrollTo(0,0);
    };

    /**
     * Saves the current sharing profile, creating a new sharing profile or
     * updating the existing sharing profile, returning a promise which is
     * resolved if the save operation succeeds and rejected if the save
     * operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the save operation succeeds and is
     *     rejected with an {@link Error} if the save operation fails.
     */
    $scope.saveSharingProfile = function saveSharingProfile() {

        $scope.sharingProfile.parameters = $scope.parameters;

        // Save the sharing profile
        return sharingProfileService.saveSharingProfile($scope.selectedDataSource, $scope.sharingProfile);

    };

    /**
     * Deletes the current sharing profile, returning a promise which is
     * resolved if the delete operation succeeds and rejected if the delete
     * operation fails.
     *
     * @returns {Promise}
     *     A promise which is resolved if the delete operation succeeds and is
     *     rejected with an {@link Error} if the delete operation fails.
     */
    $scope.deleteSharingProfile = function deleteSharingProfile() {
        return sharingProfileService.deleteSharingProfile($scope.selectedDataSource, $scope.sharingProfile);
    };

}]);
