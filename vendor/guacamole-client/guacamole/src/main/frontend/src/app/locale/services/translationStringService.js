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
 * Service for manipulating translation strings and translation table
 * identifiers.
 */
angular.module('locale').factory('translationStringService', [function translationStringService() {

    var service = {};
        
    /**
     * Given an arbitrary identifier, returns the corresponding translation
     * table identifier. Translation table identifiers are uppercase strings,
     * word components separated by single underscores. For example, the
     * string "Swap red/blue" would become "SWAP_RED_BLUE".
     *
     * @param {String} identifier
     *     The identifier to transform into a translation table identifier.
     *
     * @returns {String}
     *     The translation table identifier.
     */
    service.canonicalize = function canonicalize(identifier) {
        return identifier.replace(/[^a-zA-Z0-9]+/g, '_').toUpperCase();
    };

    return service;

}]);
