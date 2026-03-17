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
 * Provides the ManagedFilesystem class used by ManagedClient to represent
 * available remote filesystems.
 */
angular.module('client').factory('ManagedFilesystem', ['$rootScope', '$injector',
    function defineManagedFilesystem($rootScope, $injector) {

    // Required types
    var tunnelService = $injector.get('tunnelService');

    /**
     * Object which serves as a surrogate interface, encapsulating a Guacamole
     * filesystem object while it is active, allowing it to be detached and
     * reattached from different client views.
     * 
     * @constructor
     * @param {ManagedFilesystem|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ManagedFilesystem.
     */
    var ManagedFilesystem = function ManagedFilesystem(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The client that originally received the "filesystem" instruction
         * that resulted in the creation of this ManagedFilesystem.
         *
         * @type ManagedClient
         */
        this.client = template.client;

        /**
         * The Guacamole filesystem object, as received via a "filesystem"
         * instruction.
         *
         * @type Guacamole.Object
         */
        this.object = template.object;

        /**
         * The declared, human-readable name of the filesystem
         *
         * @type String
         */
        this.name = template.name;

        /**
         * The root directory of the filesystem.
         *
         * @type ManagedFilesystem.File
         */
        this.root = template.root;

        /**
         * The current directory being viewed or manipulated within the
         * filesystem.
         *
         * @type ManagedFilesystem.File
         */
        this.currentDirectory = template.currentDirectory || template.root;

    };

    /**
     * Refreshes the contents of the given file, if that file is a directory.
     * Only the immediate children of the file are refreshed. Files further
     * down the directory tree are not refreshed.
     *
     * @param {ManagedFilesystem} filesystem
     *     The filesystem associated with the file being refreshed.
     *
     * @param {ManagedFilesystem.File} file
     *     The file being refreshed.
     */
    ManagedFilesystem.refresh = function updateDirectory(filesystem, file) {

        // Do not attempt to refresh the contents of directories
        if (file.mimetype !== Guacamole.Object.STREAM_INDEX_MIMETYPE)
            return;

        // Request contents of given file
        filesystem.object.requestInputStream(file.streamName, function handleStream(stream, mimetype) {

            // Ignore stream if mimetype is wrong
            if (mimetype !== Guacamole.Object.STREAM_INDEX_MIMETYPE) {
                stream.sendAck('Unexpected mimetype', Guacamole.Status.Code.UNSUPPORTED);
                return;
            }

            // Signal server that data is ready to be received
            stream.sendAck('Ready', Guacamole.Status.Code.SUCCESS);

            // Read stream as JSON
            var reader = new Guacamole.JSONReader(stream);

            // Acknowledge received JSON blobs
            reader.onprogress = function onprogress() {
                stream.sendAck("Received", Guacamole.Status.Code.SUCCESS);
            };

            // Reset contents of directory
            reader.onend = function jsonReady() {
                $rootScope.$evalAsync(function updateFileContents() {

                    // Empty contents
                    file.files = {};

                    // Determine the expected filename prefix of each stream
                    var expectedPrefix = file.streamName;
                    if (expectedPrefix.charAt(expectedPrefix.length - 1) !== '/')
                        expectedPrefix += '/';

                    // For each received stream name
                    var mimetypes = reader.getJSON();
                    for (var name in mimetypes) {

                        // Assert prefix is correct
                        if (name.substring(0, expectedPrefix.length) !== expectedPrefix)
                            continue;

                        // Extract filename from stream name
                        var filename = name.substring(expectedPrefix.length);

                        // Deduce type from mimetype
                        var type = ManagedFilesystem.File.Type.NORMAL;
                        if (mimetypes[name] === Guacamole.Object.STREAM_INDEX_MIMETYPE)
                            type = ManagedFilesystem.File.Type.DIRECTORY;

                        // Add file entry
                        file.files[filename] = new ManagedFilesystem.File({
                            mimetype   : mimetypes[name],
                            streamName : name,
                            type       : type,
                            parent     : file,
                            name       : filename
                        });

                    }

                });
            };

        });

    };

    /**
     * Creates a new ManagedFilesystem instance from the given Guacamole.Object
     * and human-readable name. Upon creation, a request to populate the
     * contents of the root directory will be automatically dispatched.
     *
     * @param {ManagedClient} client
     *     The client that originally received the "filesystem" instruction
     *     that resulted in the creation of this ManagedFilesystem.
     *
     * @param {Guacamole.Object} object
     *     The Guacamole.Object defining the filesystem.
     *
     * @param {String} name
     *     A human-readable name for the filesystem.
     *
     * @returns {ManagedFilesystem}
     *     The newly-created ManagedFilesystem.
     */
    ManagedFilesystem.getInstance = function getInstance(client, object, name) {

        // Init new filesystem object
        var managedFilesystem = new ManagedFilesystem({
            client : client,
            object : object,
            name   : name,
            root   : new ManagedFilesystem.File({
                mimetype   : Guacamole.Object.STREAM_INDEX_MIMETYPE,
                streamName : Guacamole.Object.ROOT_STREAM,
                type       : ManagedFilesystem.File.Type.DIRECTORY
            })
        });

        // Retrieve contents of root
        ManagedFilesystem.refresh(managedFilesystem, managedFilesystem.root);

        return managedFilesystem;

    };

    /**
     * Downloads the given file from the server using the given Guacamole
     * client and filesystem. The browser will automatically start the
     * download upon completion of this function.
     *
     * @param {ManagedFilesystem} managedFilesystem
     *     The ManagedFilesystem from which the file is to be downloaded. Any
     *     path information provided must be relative to this filesystem.
     *
     * @param {String} path
     *     The full, absolute path of the file to download.
     */
    ManagedFilesystem.downloadFile = function downloadFile(managedFilesystem, path) {

        // Request download
        managedFilesystem.object.requestInputStream(path, function downloadStreamReceived(stream, mimetype) {

            // Parse filename from string
            var filename = path.match(/(.*[\\/])?(.*)/)[2];

            // Start download
            tunnelService.downloadStream(managedFilesystem.client.tunnel.uuid, stream, mimetype, filename);

        });

    };

    /**
     * Changes the current directory of the given filesystem, automatically
     * refreshing the contents of that directory.
     *
     * @param {ManagedFilesystem} filesystem
     *     The filesystem whose current directory should be changed.
     *
     * @param {ManagedFilesystem.File} file
     *     The directory to change to.
     */
    ManagedFilesystem.changeDirectory = function changeDirectory(filesystem, file) {

        // Refresh contents
        ManagedFilesystem.refresh(filesystem, file);

        // Set current directory
        filesystem.currentDirectory = file;

    };

    /**
     * A file within a ManagedFilesystem. Each ManagedFilesystem.File provides
     * sufficient information for retrieval or replacement of the file's
     * contents, as well as the file's name and type.
     *
     * @param {ManagedFilesystem|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ManagedFilesystem.File.
     */
    ManagedFilesystem.File = function File(template) {

        /**
         * The mimetype of the data contained within this file.
         *
         * @type String
         */
        this.mimetype = template.mimetype;

        /**
         * The name of the stream representing this files contents within its
         * associated filesystem object.
         *
         * @type String
         */
        this.streamName = template.streamName;

        /**
         * The type of this file. All legal file type strings are defined
         * within ManagedFilesystem.File.Type.
         *
         * @type String
         */
        this.type = template.type;

        /**
         * The name of this file.
         *
         * @type String
         */
        this.name = template.name;

        /**
         * The parent directory of this file. In the case of the root
         * directory, this will be null.
         *
         * @type ManagedFilesystem.File
         */
        this.parent = template.parent;

        /**
         * Map of all known files containined within this file by name. This is
         * only applicable to directories.
         *
         * @type Object.<String, ManagedFilesystem.File>
         */
        this.files = template.files || {};

    };

    /**
     * All legal type strings for a ManagedFilesystem.File.
     *
     * @type Object.<String, String>
     */
    ManagedFilesystem.File.Type = {

        /**
         * A normal file. As ManagedFilesystem does not currently represent any
         * other non-directory types of files, like symbolic links, this type
         * string may be used for any non-directory file.
         *
         * @type String
         */
        NORMAL : 'NORMAL',

        /**
         * A directory.
         *
         * @type String
         */
        DIRECTORY : 'DIRECTORY'

    };

    return ManagedFilesystem;

}]);
