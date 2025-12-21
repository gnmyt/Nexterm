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
 * A filter for transforming an object into an array of all non-inherited
 * property key/value pairs. The resulting array contains one object for each
 * property in the original object, where the "key" property contains the
 * original property key and the "value" property contains the original
 * property value.
 */
angular.module('index').filter('toArray', [function toArrayFactory() {

    /**
     * The name of the property to use to store the cached result of converting
     * an object to an array. This property is added to each object converted,
     * such that the same array is returned each time unless the original
     * object has changed.
     *
     * @type String
     */
    var CACHE_KEY = '_guac_toArray';

    return function toArrayFilter(input) {

        // If no object is available, just return an empty array
        if (!input) {
            return [];
        }

        // Translate object into array of key/value pairs
        var array = [];
        angular.forEach(input, function fetchValueByKey(value, key) {
            array.push({
                key   : key,
                value : value
            });
        });

        // Sort consistently by key
        array.sort(function compareKeys(a, b) {
            if (a.key < b.key) return -1;
            if (a.key > b.key) return 1;
            return 0;
        });

        // Define non-enumerable property for holding cached array
        if (!input[CACHE_KEY]) {
            Object.defineProperty(input, CACHE_KEY, {
                value        : [],
                enumerable   : false,
                configurable : true,
                writable     : true
            });
        }

        // Update cache if resulting array is different
        if (!angular.equals(input[CACHE_KEY], array))
            input[CACHE_KEY] = array;

        return input[CACHE_KEY];

    };

}]);
