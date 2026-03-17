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
 * Service which defines the DisplayErrorList class.
 */
angular.module('import').factory('DisplayErrorList', [
        function defineDisplayErrorList() {

    /**
     * A list of human-readable error messages, intended to be usable in a
     * sortable / filterable table.
     *
     * @constructor
     * @param {String[]} messages
     *     The error messages that should be prepared for display.
     */
    const DisplayErrorList = function DisplayErrorList(messages) {

        /**
         * The error messages that should be prepared for display.
         *
         * @type {String[]}
         */
        this.messages = messages || [];

        /**
         * The single String message composed of all messages concatenated
         * together. This will be used for filtering / sorting, and should only
         * be calculated once, when toString() is called.
         *
         * @type {String}
         */
        this.concatenatedMessage = null;

    };

    /**
     * Return a sortable / filterable representation of all the error messages
     * wrapped by this DisplayErrorList.
     *
     * NOTE: Once this method is called, any changes to the underlying array
     * will have no effect. This is to ensure that repeated calls to toString()
     * by sorting / filtering UI code will not regenerate the concatenated
     * message every time.
     *
     * @returns {String}
     *     A sortable / filterable representation of the error messages wrapped
     *     by this DisplayErrorList
     */
    DisplayErrorList.prototype.toString = function messageListToString() {

        // Generate the concatenated message if not already generated
        if (!this.concatenatedMessage)
            this.concatenatedMessage = this.messages.join(' ');

        return this.concatenatedMessage;

    }

    /**
     * Return the underlying array containing the raw error messages, wrapped
     * by this DisplayErrorList.
     *
     * @returns {String[]}
     *     The underlying array containing the raw error messages, wrapped by
     *     this DisplayErrorList
     */
    DisplayErrorList.prototype.getArray = function getUnderlyingArray() {
        return this.messages;
    }

    return DisplayErrorList;

}]);
