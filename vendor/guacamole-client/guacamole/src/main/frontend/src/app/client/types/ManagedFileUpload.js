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
 * Provides the ManagedFileUpload class used by the guacClientManager service.
 */
angular.module('client').factory('ManagedFileUpload', ['$rootScope', '$injector',
    function defineManagedFileUpload($rootScope, $injector) {

    // Required types
    var Error                    = $injector.get('Error');
    var ManagedFileTransferState = $injector.get('ManagedFileTransferState');

    // Required services
    var requestService = $injector.get('requestService');
    var tunnelService  = $injector.get('tunnelService');

    /**
     * Object which serves as a surrogate interface, encapsulating a Guacamole
     * file upload while it is active, allowing it to be detached and
     * reattached from different client views.
     * 
     * @constructor
     * @param {ManagedFileUpload|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ManagedFileUpload.
     */
    var ManagedFileUpload = function ManagedFileUpload(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The current state of the file transfer stream.
         *
         * @type ManagedFileTransferState
         */
        this.transferState = template.transferState || new ManagedFileTransferState();

        /**
         * The mimetype of the file being transferred.
         *
         * @type String
         */
        this.mimetype = template.mimetype;

        /**
         * The filename of the file being transferred.
         *
         * @type String
         */
        this.filename = template.filename;

        /**
         * The number of bytes transferred so far.
         *
         * @type Number
         */
        this.progress = template.progress;

        /**
         * The total number of bytes in the file.
         *
         * @type Number
         */
        this.length = template.length;

    };

    /**
     * Creates a new ManagedFileUpload which uploads the given file to the
     * server through the given Guacamole client.
     * 
     * @param {ManagedClient} managedClient
     *     The ManagedClient through which the file is to be uploaded.
     * 
     * @param {File} file
     *     The file to upload.
     *     
     * @param {Object} [object]
     *     The object to upload the file to, if any, such as a filesystem
     *     object.
     *
     * @param {String} [streamName]
     *     The name of the stream to upload the file to. If an object is given,
     *     this must be specified.
     *
     * @return {ManagedFileUpload}
     *     A new ManagedFileUpload object which can be used to track the
     *     progress of the upload.
     */
    ManagedFileUpload.getInstance = function getInstance(managedClient, file, object, streamName) {

        var managedFileUpload = new ManagedFileUpload();

        // Pull Guacamole.Tunnel and Guacamole.Client from given ManagedClient
        var client = managedClient.client;
        var tunnel = managedClient.tunnel;

        // Open file for writing
        var stream;
        if (!object)
            stream = client.createFileStream(file.type, file.name);

        // If object/streamName specified, upload to that instead of a file
        // stream
        else
            stream = object.createOutputStream(file.type, streamName);

        // Notify that the file transfer is pending
        $rootScope.$evalAsync(function uploadStreamOpen() {

            // Init managed upload
            managedFileUpload.filename = file.name;
            managedFileUpload.mimetype = file.type;
            managedFileUpload.progress = 0;
            managedFileUpload.length   = file.size;

            // Notify that stream is open
            ManagedFileTransferState.setStreamState(managedFileUpload.transferState,
                ManagedFileTransferState.StreamState.OPEN);

        });

        // Upload file once stream is acknowledged
        stream.onack = function beginUpload(status) {

            // Notify of any errors from the Guacamole server
            if (status.isError()) {
                $rootScope.$apply(function uploadStreamError() {
                    ManagedFileTransferState.setStreamState(managedFileUpload.transferState,
                        ManagedFileTransferState.StreamState.ERROR,
                        status.code);
                });
                return;
            }

            // Begin upload
            tunnelService.uploadToStream(tunnel.uuid, stream, file, function uploadContinuing(length) {
                $rootScope.$apply(function uploadStreamProgress() {
                    managedFileUpload.progress = length;
                });
            })

            // Notify if upload succeeds
            .then(function uploadSuccessful() {

                // Upload complete
                managedFileUpload.progress = file.size;

                // Close the stream
                stream.sendEnd();
                ManagedFileTransferState.setStreamState(managedFileUpload.transferState,
                    ManagedFileTransferState.StreamState.CLOSED);

                // Notify of upload completion
                $rootScope.$broadcast('guacUploadComplete', file.name);
            },

            // Notify if upload fails
            requestService.createErrorCallback(function uploadFailed(error) {
                
                // Use provide status code if the error is coming from the stream
                if (error.type === Error.Type.STREAM_ERROR)
                    ManagedFileTransferState.setStreamState(managedFileUpload.transferState,
                        ManagedFileTransferState.StreamState.ERROR,
                        error.statusCode);

                // Fail with internal error for all other causes
                else
                    ManagedFileTransferState.setStreamState(managedFileUpload.transferState,
                        ManagedFileTransferState.StreamState.ERROR,
                        Guacamole.Status.Code.INTERNAL_ERROR);
                
                // Close the stream
                stream.sendEnd();

            }));

            // Ignore all further acks
            stream.onack = null;
    

        };

        return managedFileUpload;

    };

    return ManagedFileUpload;

}]);