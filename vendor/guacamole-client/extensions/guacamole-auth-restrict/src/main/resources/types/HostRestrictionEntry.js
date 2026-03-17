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
 * Provides the HostRestrictionEntry class definition.
 */
angular.module('guacRestrict').factory('HostRestrictionEntry', [
        function defineHostRestrictionEntry() {

    /**
     * Creates a new HostRestrictionEntry, initializing the properties of that
     * HostRestrictionEntry with the corresponding properties of the given
     * template.
     *
     * @constructor
     * @param {HostRestrictionEntry|Object} [template={}]
     *     The object whose properties should be copied within the new
     *     HostRestrictionEntry.
     */
    var HostRestrictionEntry = function HostRestrictionEntry(template) {

        // Use empty object by default
        template = template || {};
        
        /**
         * The IP address, CIDR notation range, or DNS hostname of the host(s)
         * specified by this restriction.
         *
         * @type String
         */
        this.host = template.host || '';

    };

    return HostRestrictionEntry;

}]);
