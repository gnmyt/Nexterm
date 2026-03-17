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
 * Provides the ManagedArgument class used by ManagedClient.
 */
angular.module('client').factory('ManagedArgument', ['$q', function defineManagedArgument($q) {

    /**
     * Object which represents an argument (connection parameter) which may be
     * changed by the user while the connection is open.
     * 
     * @constructor
     * @param {ManagedArgument|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ManagedArgument.
     */
    var ManagedArgument = function ManagedArgument(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The name of the connection parameter.
         *
         * @type {String}
         */
        this.name = template.name;

        /**
         * The current value of the connection parameter.
         *
         * @type {String}
         */
        this.value = template.value;

        /**
         * A valid, open output stream which may be used to apply a new value
         * to the connection parameter.
         *
         * @type {Guacamole.OutputStream}
         */
        this.stream = template.stream;

        /**
         * True if this argument has been modified in the webapp, but yet to
         * be confirmed by guacd, or false in any other case. A pending
         * argument cannot be modified again, and must be recreated before
         * editing is enabled again.
         *
         * @type {boolean}
         */
        this.pending = false;

    };

    /**
     * Requests editable access to a given connection parameter, returning a
     * promise which is resolved with a ManagedArgument instance that provides
     * such access if the parameter is indeed editable.
     *
     * @param {ManagedClient} managedClient
     *     The ManagedClient instance associated with the connection for which
     *     an editable version of the connection parameter is being retrieved.
     *
     * @param {String} name
     *     The name of the connection parameter.
     *
     * @param {String} value
     *     The current value of the connection parameter, as received from a
     *     prior, inbound "argv" stream.
     *
     * @returns {Promise.<ManagedArgument>}
     *     A promise which is resolved with the new ManagedArgument instance
     *     once the requested parameter has been verified as editable.
     */
    ManagedArgument.getInstance = function getInstance(managedClient, name, value) {

        var deferred = $q.defer();

        // Create internal, fully-populated instance of ManagedArgument, to be
        // returned only once mutability of the associated connection parameter
        // has been verified
        var managedArgument = new ManagedArgument({
            name   : name,
            value  : value,
            stream : managedClient.client.createArgumentValueStream('text/plain', name)
        });

        // The connection parameter is editable only if a successful "ack" is
        // received
        managedArgument.stream.onack = function ackReceived(status) {
            if (status.isError())
                deferred.reject(status);
            else
                deferred.resolve(managedArgument);
        };

        return deferred.promise;

    };

    /**
     * Sets the given editable argument (connection parameter) to the given
     * value, updating the behavior of the associated connection in real-time.
     * If successful, the ManagedArgument provided cannot be used for future
     * calls to setValue() and will be read-only until replaced with a new
     * instance. This function only has an effect if the new parameter value
     * is different from the current value.
     *
     * @param {ManagedArgument} managedArgument
     *     The ManagedArgument instance associated with the connection
     *     parameter being modified.
     *
     * @param {String} value
     *     The new value to assign to the connection parameter.
     */
    ManagedArgument.setValue = function setValue(managedArgument, value) {

        // Stream new value only if value has changed and a change is not
        // already pending
        if (!managedArgument.pending && value !== managedArgument.value) {

            var writer = new Guacamole.StringWriter(managedArgument.stream);
            writer.sendText(value);
            writer.sendEnd();

            // ManagedArgument instance is no longer usable
            managedArgument.pending = true;

        }

    };

    return ManagedArgument;

}]);
