/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* global _ */

import { parse as parseCSVData } from 'csv-parse/lib/sync'
import { parse as parseYAMLData } from 'yaml'

/**
 * A particularly unfriendly looking error that the CSV parser throws if a
 * binary file parse attempt is made. If at all possible, this message should
 * never be displayed to the user since it makes it look like the application
 * is broken. As such, the code will attempt to filter out this error and print
 * something a bit more generic. Lowercased for slightly fuzzier matching.
 *
 * @type String
 */
const BINARY_CSV_ERROR_MESSAGE = "Argument must be a Buffer".toLowerCase();

/**
 * A service for parsing user-provided JSON, YAML, or JSON connection data into
 * an appropriate format for bulk uploading using the PATCH REST endpoint.
 */
angular.module('import').factory('connectionParseService',
        ['$injector', function connectionParseService($injector) {

    // Required types
    const Connection             = $injector.get('Connection');
    const ConnectionImportConfig = $injector.get('ConnectionImportConfig');
    const DirectoryPatch         = $injector.get('DirectoryPatch');
    const ImportConnection       = $injector.get('ImportConnection');
    const ParseError             = $injector.get('ParseError');
    const ParseResult            = $injector.get('ParseResult');
    const TranslatableMessage    = $injector.get('TranslatableMessage');

    // Required services
    const $q                     = $injector.get('$q');
    const $routeParams           = $injector.get('$routeParams');
    const schemaService          = $injector.get('schemaService');
    const connectionCSVService   = $injector.get('connectionCSVService');
    const connectionGroupService = $injector.get('connectionGroupService');

    const service = {};

    /**
     * The identifier of the root connection group, under which all other groups
     * and connections exist.
     * 
     * @type String
     */
    const ROOT_GROUP_IDENTIFIER = 'ROOT';

    /**
     * Perform basic checks, common to all file types - namely that the parsed
     * data is an array, and contains at least one connection entry. Returns an
     * error if any of these basic checks fails.
     *
     * @returns {ParseError}
     *     An error describing the parsing failure, if one of the basic checks
     *     fails.
     */
    function performBasicChecks(parsedData) {

        // Make sure that the file data parses to an array (connection list)
        if (!(parsedData instanceof Array))
            return new ParseError({
                message: 'Import data must be a list of connections',
                key: 'IMPORT.ERROR_ARRAY_REQUIRED'
            });

        // Make sure that the connection list is not empty - contains at least
        // one connection
        if (!parsedData.length)
            return new ParseError({
                message: 'The provided file is empty',
                key: 'IMPORT.ERROR_EMPTY_FILE'
            });
    }

    /**
     * A collection of connection-group-tree-derived maps that are useful for
     * processing connections.
     *
     * @constructor
     * @param {TreeLookups|{}} template
     *     The object whose properties should be copied within the new
     *     ConnectionImportConfig.
     */
    const TreeLookups = template => ({

        /**
         * A map of all known group paths to the corresponding identifier for
         * that group. The is that a user-provided import file might directly
         * specify a named group path like "ROOT", "ROOT/parent", or
         * "ROOT/parent/child". This field field will map all of the above to
         * the identifier of the appropriate group, if defined.
         *
         * @type Object.<String, String>
         */
        groupPathsByIdentifier: template.groupPathsByIdentifier || {},

        /**
         * A map of all known group identifiers to the path of the corresponding
         * group. These paths are all of the form "ROOT/parent/child".
         *
         * @type Object.<String, String>
         */
        groupIdentifiersByPath: template.groupIdentifiersByPath || {},

        /**
         * A map of group identifier, to connection name, to connection 
         * identifier. These paths are all of the form "ROOT/parent/child". The 
         * idea is that existing connections can be found by checking if a
         * connection already exists with the same parent group, and with the
         * same name as an user-supplied import connection.
         *
         * @type Object.<String, String>
         */
        connectionIdsByGroupAndName : template.connectionIdsByGroupAndName || {}

    });

    /**
     * Returns a promise that resolves to a TreeLookups object containing maps
     * useful for processing user-supplied connections to be imported, derived
     * from the current connection group tree, starting at the ROOT group.
     *
     * @returns {Promise.<TreeLookups>}
     *     A promise that resolves to a TreeLookups object containing maps
     *     useful for processing connections.
     */
    function getTreeLookups() {

        // The current data source - defines all the groups that the connections
        // might be imported into
        const dataSource = $routeParams.dataSource;

        const deferredTreeLookups = $q.defer();

        connectionGroupService.getConnectionGroupTree(dataSource).then(
                rootGroup => {

            const lookups = new TreeLookups({});

            // Add the specified group to the lookup, appending all specified
            // prefixes, and then recursively call saveLookups for all children
            // of the group, appending to the prefix for each level
            const saveLookups = (prefix, group) => {

                // To get the path for the current group, add the name
                const currentPath = prefix + group.name;

                // Add the current path to the identifier map
                lookups.groupPathsByIdentifier[currentPath] = group.identifier;

                // Add the current identifier to the path map
                lookups.groupIdentifiersByPath[group.identifier] = currentPath;

                // Add each connection to the connection map
                _.forEach(group.childConnections,
                    connection => _.setWith(
                        lookups.connectionIdsByGroupAndName,
                        [group.identifier, connection.name],
                        connection.identifier, Object));

                // Add each child group to the lookup
                const nextPrefix = currentPath + "/";
                _.forEach(group.childConnectionGroups,
                        childGroup => saveLookups(nextPrefix, childGroup));

            }

            // Start at the root group
            saveLookups("", rootGroup);

            // Resolve with the now fully-populated lookups
            deferredTreeLookups.resolve(lookups);

        });

        return deferredTreeLookups.promise;
    }

    /**
     * Returns a promise that will resolve to a transformer function that will
     * perform various checks and transforms relating to the connection group
     * tree hierarchy, pushing any errors into the resolved connection object.
     * It will:
     * - Ensure that a connection specifies either a valid group path (no path
     *   defaults to ROOT), or a valid parent group identifier, but not both
     * - Ensure that this connection does not duplicate another connection
     *   earlier in the import file
     * - Handle import connections that match existing connections connections
     *   based on the provided import config.
     *
     * The group set on the connection may begin with the root identifier, a
     * leading slash, or may omit the root identifier entirely. The group may
     * optionally end with a trailing slash.
     *
     * @param {ConnectionImportConfig} importConfig
     *     The configuration options selected by the user prior to import.
     *
     * @returns {Promise.<Function<ImportConnection, ImportConnection>>}
     *     A promise that will resolve to a function that will apply various
     *     connection tree based checks and transforms to this connection.
     */
    function getTreeTransformer(importConfig) {

        // A map of group path with connection name, to connection object, used
        // for detecting duplicate connections within the import file itself
        const connectionsInFile = {};

        return getTreeLookups().then(treeLookups => connection => {

            const { groupPathsByIdentifier, groupIdentifiersByPath,
                    connectionIdsByGroupAndName } = treeLookups;

            const providedIdentifier = connection.parentIdentifier;

            // The normalized group path for this connection, of the form
            // "ROOT/parent/child"
            let group;
            
            // The identifier for the parent group of this connection
            let parentIdentifier;
            
            // The operator to apply for this connection
            let op = DirectoryPatch.Operation.ADD;

            // If both are specified, the parent group is ambigious
            if (providedIdentifier && connection.group) {
                connection.errors.push(new ParseError({
                    message: 'Only one of group or parentIdentifier can be set',
                    key: 'IMPORT.ERROR_AMBIGUOUS_PARENT_GROUP'
                }));
                return connection;
            }

            // If a parent group identifier is present, but not valid
            else if (providedIdentifier
                    && !groupPathsByIdentifier[providedIdentifier]) {
                connection.errors.push(new ParseError({
                    message: 'No group with identifier: ' + providedIdentifier,
                    key: 'IMPORT.ERROR_INVALID_GROUP_IDENTIFIER',
                    variables: { IDENTIFIER: providedIdentifier }
                }));
                return connection;
            }

            // If the parent identifier is valid, use it to determine the path
            else if (providedIdentifier) {
                parentIdentifier = providedIdentifier;
                group = groupPathsByIdentifier[providedIdentifier];
            }

            // If a user-supplied group path is provided, attempt to normalize
            // and match it to an existing connection group
            else if (connection.group) {

                // The group path extracted from the user-provided connection,
                // to be translated into an absolute path starting at the root
                group = connection.group;

                // If the provided group isn't a string, it can never be valid
                if (typeof group !== 'string') {
                    connection.errors.push(new ParseError({
                        message: 'Invalid group type - must be a string',
                        key: 'IMPORT.ERROR_INVALID_GROUP_TYPE'
                    }));
                    return connection;
                }

                // Allow the group to start with a leading slash instead instead
                // of explicitly requiring the root connection group
                if (group.startsWith('/'))
                    group = ROOT_GROUP_IDENTIFIER + group;

                // Allow groups to begin directly with the path under the root
                else if (!group.startsWith(ROOT_GROUP_IDENTIFIER))
                    group = ROOT_GROUP_IDENTIFIER + '/' + group;

                // Allow groups to end with a trailing slash
                if (group.endsWith('/'))
                    group = group.slice(0, -1);

                // Look up the parent identifier for the specified group path
                parentIdentifier = groupPathsByIdentifier[group];

                // If the group doesn't match anything in the tree
                if (!parentIdentifier) {
                    connection.errors.push(new ParseError({
                        message: 'No group found named: ' + connection.group,
                        key: 'IMPORT.ERROR_INVALID_GROUP',
                        variables: { GROUP: connection.group }
                    }));
                    return connection;
                }

            }

            // If no group is specified at all, default to the root group
            else {
                parentIdentifier = ROOT_GROUP_IDENTIFIER;
                group = ROOT_GROUP_IDENTIFIER;
            }

            // The full path, of the form "ROOT/Child Group/Connection Name"
            const path = group + '/' + connection.name;

            // Error out if this is a duplicate of a connection already in the
            // file
            if (!!_.get(connectionsInFile, path)) 
                connection.errors.push(new ParseError({
                    message: 'Duplicate connection in file: ' + path,
                    key: 'IMPORT.ERROR_DUPLICATE_CONNECTION_IN_FILE',
                    variables: { NAME: connection.name, PATH: group }
                }));

            // Mark the current path as already seen in the file
            _.setWith(connectionsInFile, path, connection, Object);

            // Check if this would be an update to an existing connection
            const existingIdentifier = _.get(connectionIdsByGroupAndName,
                    [parentIdentifier, connection.name]);

            // The default behavior is to create connections if no conflict
            let importMode = ImportConnection.ImportMode.CREATE;
            let identifier;

            // If updates to existing connections are disallowed
            if (existingIdentifier && importConfig.existingConnectionMode ===
                    ConnectionImportConfig.ExistingConnectionMode.REJECT)
                connection.errors.push(new ParseError({
                    message: 'Rejecting update to existing connection: ' + path,
                    key: 'IMPORT.ERROR_REJECT_UPDATE_CONNECTION',
                    variables: { NAME: connection.name, PATH: group }
                }));

            // If the connection is being replaced, set the existing identifer
            else if (existingIdentifier) {
                identifier = existingIdentifier;
                importMode = ImportConnection.ImportMode.REPLACE;
            }

            else
                importMode = ImportConnection.ImportMode.CREATE;

            // Set the import mode, normalized path, and validated identifier
            return new ImportConnection({ ...connection, 
                    importMode, group, identifier, parentIdentifier });

        });
    }

    /**
     * Returns a promise that resolves to a map of all valid protocols to a map
     * of connection parameter names to a map of lower-cased and trimmed option
     * values for that parameter to the actual valid option value.
     *
     * This format is designed for easy retrieval of corrected parameter values
     * if the user-provided value matches a valid option except for case or
     * leading/trailing whitespace.
     *
     * If a parameter has no options (i.e. any string value is allowed), the
     * parameter name will map to a null value.
     *
     * @returns {Promise.<Object.<String, Object.<String, Object.<String, String>>>>}
     *     A promise that resolves to a map of all valid protocols to parameter
     *     names to valid values.
     */
    function getProtocolParameterOptions() {

        // The current data source - the one that the connections will be
        // imported into
        const dataSource = $routeParams.dataSource;

        // Fetch the protocols and convert to a set of valid protocol names
        return schemaService.getProtocols(dataSource).then(
                protocols => _.mapValues(protocols, ({connectionForms}) => {

            const fieldMap = {};

            // Go through all the connection forms and get the fields for each
            connectionForms.forEach(({fields}) => fields.forEach(field => {

                const { name, options } = field;

                // Set the value to null to indicate that there are no options
                if (!options)
                    fieldMap[name] = null;

                // Set the value to a map of lowercased/trimmed option values 
                // to actual option values
                else
                    fieldMap[name] = _.mapKeys(
                        options, option => option.trim().toLowerCase());
               
            }));

            return fieldMap;
        }));
    }

    /**
     * Resolves to function that will perform field-level (not connection
     * hierarchy dependent) checks and transforms to a provided connection,
     * returning the transformed connection.
     *
     * @returns {Promise.<Function.<ImportConnection, ImportConnection>>}
     *     A promise resolving to a function that will apply field-level
     *     transforms and checks to a provided connection, returning the
     *     transformed connection.
     */
    function getFieldTransformer() {

        return getProtocolParameterOptions().then(protocols => connection => {

            // Ensure that a protocol was specified for this connection
            const protocol = connection.protocol;
            if (!protocol)
                connection.errors.push(new ParseError({
                    message: 'Missing required protocol field',
                    key: 'IMPORT.ERROR_REQUIRED_PROTOCOL_CONNECTION'
                }));

            // Ensure that a valid protocol was specified for this connection
            if (!protocols[protocol])
                connection.errors.push(new ParseError({
                    message: 'Invalid protocol: ' + protocol,
                    key: 'IMPORT.ERROR_INVALID_PROTOCOL',
                    variables: { PROTOCOL: protocol }
                }));

            // Ensure that a name was specified for this connection
            if (!connection.name)
                connection.errors.push(new ParseError({
                    message: 'Missing required name field',
                    key: 'IMPORT.ERROR_REQUIRED_NAME_CONNECTION'
                }));

            // Ensure that the specified user list, if any, is an array
            const users = connection.users;
            if (users) {

                // Ensure all users in the array are trimmed strings
                if (Array.isArray(users))
                    connection.users = users.map(user => String(user).trim());

                else
                    connection.errors.push(new ParseError({
                        message: 'Invalid users list - must be an array',
                        key: 'IMPORT.ERROR_INVALID_USERS_TYPE'
                    }));

            }

            // Ensure that the specified user group list, if any, is an array
            const groups = connection.groups;
            if (groups) {

                // Ensure all groups in the array are trimmed strings
                if (Array.isArray(groups))
                    connection.groups = groups.map(group => String(group).trim());

                else
                    connection.errors.push(new ParseError({
                        message: 'Invalid groups list - must be an array',
                        key: 'IMPORT.ERROR_INVALID_USER_GROUPS_TYPE'
                    }));
                
            }
            
            // If the protocol is not valid, there's no point in trying to check
            // parameter case sensitivity
            if (!protocols[protocol])
                return connection;

            _.forEach(connection.parameters, (value, name) => {

                // An explicit null value for a parameter is valid - do not
                // process it further
                if (value === null)
                    return;

                // All non-null connection parameters must be strings.
                const stringValue = String(value);

                // Convert the provided value to the format that would match
                // the lookup object format
                const comparisonValue = stringValue.toLowerCase().trim();

                // The validated / corrected option value for this connection
                // parameter, if any
                const validOptionValue = _.get(
                        protocols, [protocol, name, comparisonValue]);

                // If the provided value fuzzily matches a valid option value,
                // use the valid option value instead
                if (validOptionValue)
                    connection.parameters[name] = validOptionValue;

                // Even if no option is found, the value must be a string
                else
                    connection.parameters[name] = stringValue;

            });

            _.forEach(connection.attributes, (value, name) => {

                // An explicit null value for an attribute is valid - do not
                // process it further
                if (value === null)
                    return;

                // All non-null connection attributes must be strings
                connection.attributes[name] = String(value);

            });

            return connection;
        });
    }

    /**
     * Convert a provided connection array into a ParseResult. Any provided
     * transform functions will be run on each entry in `connectionData` before
     * any other processing is done.
     *
     * @param {ConnectionImportConfig} importConfig
     *     The configuration options selected by the user prior to import.
     *
     * @param {*[]} connectionData
     *     An arbitrary array of data. This must evaluate to a ImportConnection
     *     object after being run through all functions in `transformFunctions`.
     *
     * @param {Function[]} transformFunctions
     *     An array of transformation functions to run on each entry in
     *     `connection` data.
     *
     * @return {Promise.<ParseResult>}
     *     A promise resolving to ParseResult object representing the result of
     *     parsing all provided connection data.
     */
    function parseConnectionData(
            importConfig, connectionData, transformFunctions) {

        // Check that the provided connection data array is not empty
        const checkError = performBasicChecks(connectionData);
        if (checkError) {
            const deferred = $q.defer();
            deferred.reject(checkError);
            return deferred.promise;
        }

        let index = 0;

        // Get the tree transformer and relevant protocol information
        return $q.all({
            fieldTransformer : getFieldTransformer(),
            treeTransformer  : getTreeTransformer(importConfig),
        })
        .then(({fieldTransformer, treeTransformer}) =>
                connectionData.reduce((parseResult, data) => {

            const { patches, users, groups, groupPaths } = parseResult;

            // Run the array data through each provided transform
            let connectionObject = data;
            _.forEach(transformFunctions, transform => {
                connectionObject = transform(connectionObject);
            });

            // Apply the field level transforms
            connectionObject = fieldTransformer(connectionObject);

            // Apply the connection group hierarchy transforms
            connectionObject = treeTransformer(connectionObject);

            // If there are any errors for this connection, fail the whole batch
            if (connectionObject.errors.length)
                parseResult.hasErrors = true;

            // The value for the patch is a full-fledged Connection
            const value = new Connection(connectionObject);

            // If a new connection is being created
            if (connectionObject.importMode 
                    === ImportConnection.ImportMode.CREATE) 

                // Add a patch for creating the connection
                patches.push(new DirectoryPatch({
                    op: DirectoryPatch.Operation.ADD,
                    path: '/',
                    value
                }));

            // The connection is being replaced, and permissions are only being
            // added, not replaced
            else if (importConfig.existingPermissionMode ===
                    ConnectionImportConfig.ExistingPermissionMode.PRESERVE)

                // Add a patch for replacing the connection
                patches.push(new DirectoryPatch({
                    op: DirectoryPatch.Operation.REPLACE,
                    path: '/' + connectionObject.identifier,
                    value
                }));

            // The connection is being replaced, and permissions are also being
            // replaced
            else {

                // Add a patch for removing the existing connection
                patches.push(new DirectoryPatch({
                    op: DirectoryPatch.Operation.REMOVE,
                    path: '/' + connectionObject.identifier
                }));

                // Increment the index for the additional remove patch
                index += 1;

                // Add a second patch for creating the replacement connection
                patches.push(new DirectoryPatch({
                    op: DirectoryPatch.Operation.ADD,
                    path: '/',
                    value
                }));

            }

            // Save the connection group path into the parse result
            groupPaths[index] = connectionObject.group;

            // Save the errors for this connection into the parse result
            parseResult.errors[index] = connectionObject.errors;

            // Add this connection index to the list for each user
            _.forEach(connectionObject.users, identifier => {

                // If there's an existing list, add the index to that
                if (users[identifier])
                    users[identifier].push(index);

                // Otherwise, create a new list with just this index
                else
                    users[identifier] = [index];
            });

            // Add this connection index to the list for each group
            _.forEach(connectionObject.groups, identifier => {

                // If there's an existing list, add the index to that
                if (groups[identifier])
                    groups[identifier].push(index);

                // Otherwise, create a new list with just this index
                else
                    groups[identifier] = [index];
            });

            // Return the existing parse result state and continue on to the
            // next connection in the file
            index++;
            parseResult.connectionCount++;
            return parseResult;

        }, new ParseResult()));
    }

    /**
     * Convert a provided CSV representation of a connection list into a JSON
     * object to be submitted to the PATCH REST endpoint, as well as a list of
     * objects containing lists of user and user group identifiers to be granted
     * to each connection.
     *
     * @param {ConnectionImportConfig} importConfig
     *     The configuration options selected by the user prior to import.
     *
     * @param {String} csvData
     *     The CSV-encoded connection list to process.
     *
     * @return {Promise.<Object>}
     *     A promise resolving to ParseResult object representing the result of
     *     parsing all provided connection data.
     */
    service.parseCSV = function parseCSV(importConfig, csvData) {

        // Convert to an array of arrays, one per CSV row (including the header)
        // NOTE: skip_empty_lines is required, or a trailing newline will error
        let parsedData;
        try {
            parsedData = parseCSVData(csvData, {skip_empty_lines: true});
        }

        // If the CSV parser throws an error, reject with that error
        catch(error) {

            const message = error.message;
            console.error(error);

            const deferred = $q.defer();

            // If the error message looks like the expected (and ugly) message
            // that's thrown when a binary file is provided, throw a more
            // friendy error.
            if (_.trim(message).toLowerCase() == BINARY_CSV_ERROR_MESSAGE)
                deferred.reject(new ParseError({
                    message: "CSV binary parse attempt error: " + error.message,
                    key: "IMPORT.ERROR_DETECTED_INVALID_TYPE"
                }));

            // Otherwise, pass the error from the library through to the user
            else
                deferred.reject(new ParseError({
                    message: "CSV Parse Failure: " + error.message,
                    key: "IMPORT.ERROR_PARSE_FAILURE_CSV",
                    variables: { ERROR: error.message }
                }));

            return deferred.promise;
        }

        // The header row - an array of string header values
        const header = parsedData.length ? parsedData[0] : [];

        // Slice off the header row to get the data rows
        const connectionData = parsedData.slice(1);

        // Generate the CSV transform function, and apply it to every row
        // before applying all the rest of the standard transforms
        return connectionCSVService.getCSVTransformer(header).then(
            csvTransformer =>

                // Apply the CSV transform to every row
                parseConnectionData(
                        importConfig, connectionData, [csvTransformer]));

    };

    /**
     * Convert a provided YAML representation of a connection list into a JSON
     * object to be submitted to the PATCH REST endpoint, as well as a list of
     * objects containing lists of user and user group identifiers to be granted
     * to each connection.
     *
     * @param {ConnectionImportConfig} importConfig
     *     The configuration options selected by the user prior to import.
     *
     * @param {String} yamlData
     *     The YAML-encoded connection list to process.
     *
     * @return {Promise.<Object>}
     *     A promise resolving to ParseResult object representing the result of
     *     parsing all provided connection data.
     */
    service.parseYAML = function parseYAML(importConfig, yamlData) {

        // Parse from YAML into a javascript array
        let connectionData;
        try {
            connectionData = parseYAMLData(yamlData);
        }

        // If the YAML parser throws an error, reject with that error
        catch(error) {
            console.error(error);
            const deferred = $q.defer();
            deferred.reject(new ParseError({
                message: "YAML Parse Failure: " + error.message,
                key: "IMPORT.ERROR_PARSE_FAILURE_YAML",
                variables: { ERROR: error.message }
            }));
            return deferred.promise;
        }

        // Produce a ParseResult, making sure that each record is converted to
        // the ImportConnection type before further parsing
        return parseConnectionData(importConfig, connectionData,
                [connection => new ImportConnection(connection)]);
    };

    /**
     * Convert a provided JSON-encoded representation of a connection list into
     * an array of patches to be submitted to the PATCH REST endpoint, as well
     * as a list of objects containing lists of user and user group identifiers
     * to be granted to each connection.
     *
     * @param {ConnectionImportConfig} importConfig
     *     The configuration options selected by the user prior to import.
     *
     * @param {String} jsonData
     *     The JSON-encoded connection list to process.
     *
     * @return {Promise.<Object>}
     *     A promise resolving to ParseResult object representing the result of
     *     parsing all provided connection data.
     */
    service.parseJSON = function parseJSON(importConfig, jsonData) {

        // Parse from JSON into a javascript array
        let connectionData;
        try {
            connectionData = JSON.parse(jsonData);
        }

        // If the JSON parse attempt throws an error, reject with that error
        catch(error) {
            console.error(error);
            const deferred = $q.defer();
            deferred.reject(new ParseError({
                message: "JSON Parse Failure: " + error.message,
                key: "IMPORT.ERROR_PARSE_FAILURE_JSON",
                variables: { ERROR: error.message }
            }));
            return deferred.promise;
        }

        // Produce a ParseResult, making sure that each record is converted to
        // the ImportConnection type before further parsing
        return parseConnectionData(importConfig, connectionData,
                [connection => new ImportConnection(connection)]);

    };

    return service;

}]);
