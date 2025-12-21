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
 * Provides the ClipboardData class used for interchange between the
 * guacClipboard directive, clipboardService service, etc.
 */
angular.module('clipboard').factory('ClipboardData', [function defineClipboardData() {

    /**
     * Arbitrary data which can be contained by the clipboard.
     *
     * @constructor
     * @param {ClipboardData|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     ClipboardData.
     */
    var ClipboardData = function ClipboardData(template) {

        // Use empty object by default
        template = template || {};

        /**
         * The ID of the ManagedClient handling the remote desktop connection
         * that originated this clipboard data, or null if the data originated
         * from the clipboard editor or local clipboard.
         *
         * @type {string}
         */
        this.source = template.source;

        /**
         * The mimetype of the data currently stored within the clipboard.
         *
         * @type String
         */
        this.type = template.type || 'text/plain';

        /**
         * The data currently stored within the clipboard. Depending on the
         * nature of the stored data, this may be either a String, a Blob, or a
         * File.
         *
         * @type String|Blob|File
         */
        this.data = template.data || '';

    };

    return ClipboardData;

}]);
