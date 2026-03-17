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
 * Service which defines the Protocol class.
 */
angular.module('rest').factory('Protocol', ['$injector', function defineProtocol($injector) {

    // Required services
    var translationStringService = $injector.get('translationStringService');

    /**
     * The object returned by REST API calls when representing the data
     * associated with a supported remote desktop protocol.
     * 
     * @constructor
     * @param {Protocol|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     Protocol.
     */
    var Protocol = function Protocol(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The name which uniquely identifies this protocol.
         *
         * @type String
         */
        this.name = template.name;

        /**
         * An array of forms describing all known parameters for a connection
         * using this protocol, including their types and other information.
         *
         * @type Form[]
         * @default []
         */
        this.connectionForms = template.connectionForms || [];

        /**
         * An array of forms describing all known parameters relevant to a
         * sharing profile whose primary connection uses this protocol,
         * including their types, and other information.
         *
         * @type Form[]
         * @default []
         */
        this.sharingProfileForms = template.sharingProfileForms || [];

    };

    /**
     * Returns the translation string namespace for the protocol having the
     * given name. The namespace will be of the form:
     *
     * <code>PROTOCOL_NAME</code>
     *
     * where <code>NAME</code> is the protocol name transformed via
     * translationStringService.canonicalize().
     *
     * @param {String} protocolName
     *     The name of the protocol.
     *
     * @returns {String}
     *     The translation namespace for the protocol specified, or null if no
     *     namespace could be generated.
     */
    Protocol.getNamespace = function getNamespace(protocolName) {

        // Do not generate a namespace if no protocol is selected
        if (!protocolName)
            return null;

        return 'PROTOCOL_' + translationStringService.canonicalize(protocolName);

    };

    /**
     * Given the internal name of a protocol, produces the translation string
     * for the localized version of that protocol's name. The translation
     * string will be of the form:
     *
     * <code>NAMESPACE.NAME<code>
     *
     * where <code>NAMESPACE</code> is the namespace generated from
     * $scope.getNamespace().
     *
     * @param {String} protocolName
     *     The name of the protocol.
     *
     * @returns {String}
     *     The translation string which produces the localized name of the
     *     protocol specified.
     */
    Protocol.getName = function getProtocolName(protocolName) {
        return Protocol.getNamespace(protocolName) + '.NAME';
    };

    return Protocol;

}]);