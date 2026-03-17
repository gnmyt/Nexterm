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
 * Filter which accepts a promise as input, returning the resolved value of
 * that promise if/when the promise is resolved. While the promise is not
 * resolved, null is returned.
 */
angular.module('index').filter('resolve', [function resolveFilter() {

    /**
     * The name of the property to use to store the resolved promise value.
     *
     * @type {!string}
     */
    const RESOLVED_VALUE_KEY = '_guac_resolveFilter_resolvedValue';

    return function resolveFilter(promise) {

        if (!promise)
            return null;

        // Assign value to RESOLVED_VALUE_KEY automatically upon resolution of
        // the received promise
        if (!(RESOLVED_VALUE_KEY in promise)) {
            promise[RESOLVED_VALUE_KEY] = null;
            promise.then((value) => {
                return promise[RESOLVED_VALUE_KEY] = value; 
            });
        }

        // Always return cached value
        return promise[RESOLVED_VALUE_KEY];

    };

}]);
