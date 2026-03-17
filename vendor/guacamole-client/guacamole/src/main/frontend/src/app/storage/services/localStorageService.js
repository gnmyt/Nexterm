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
 * Service for setting, removing, and retrieving localStorage keys. If access
 * to localStorage is disabled, or the browser does not support localStorage,
 * key values are temporarily stored in memory instead. If necessary, the same
 * functionality is also available at the localStorageServiceProvider level.
 */
angular.module('storage').provider('localStorageService', [function localStorageServiceProvider() {

    /**
     * Reference to this provider.
     *
     * @type localStorageServiceProvider
     */
    var provider = this;

    /**
     * Internal cache of key/value pairs stored within localStorage, updated
     * lazily as keys are retrieved, updated, or removed. If localStorage is
     * not actually available, then this cache will be the sole storage
     * location for these key/value pairs.
     *
     * @type Object.<String, String>
     */
    var storedItems = {};

    /**
     * Stores the given value within localStorage under the given key. If access
     * to localStorage is not provided/implemented by the browser, the key/value
     * pair will be stored internally (in memory) only, with the stored value
     * remaining retrievable via getItem() until the browser tab/window is
     * closed.
     *
     * @param {String} key
     *     The arbitrary, unique key under which the value should be stored.
     *
     * @param {Object} value
     *     The object to store under the given key. This may be any object that
     *     can be serialized as JSON, and will automatically be serialized as
     *     JSON prior to storage.
     */
    provider.setItem = function setItem(key, value) {

        // Store given value internally
        var data = JSON.stringify(value);
        storedItems[key] = data;

        // Additionally store value within localStorage if allowed
        try {
            if (window.localStorage)
                localStorage.setItem(key, data);
        }
        catch (ignore) {}

    };

    /**
     * Removes the item having the given key from localStorage. If access to
     * localStorage is not provided/implemented by the browser, the item is
     * removed solely from internal, in-memory storage. If no such item exists,
     * this function has no effect.
     *
     * @param {String} key
     *     The arbitrary, unique key of the item to remove from localStorage.
     */
    provider.removeItem = function removeItem(key) {

        // Evict key from internal storage
        delete storedItems[key];

        // Remove key from localStorage if allowed
        try {
            if (window.localStorage)
                localStorage.removeItem(key);
        }
        catch (ignore) {}

    };

    /**
     * Retrieves the value currently stored within localStorage for the item
     * having the given key. If access to localStorage is not
     * provided/implemented by the browser, the item is retrieved from
     * internal, in-memory storage. The retrieved value is automatically
     * deserialized from JSON prior to being returned.
     *
     * @param {String} key
     *     The arbitrary, unique key of the item to retrieve from localStorage.
     *
     * @returns {Object}
     *     The value stored within localStorage under the given key,
     *     automatically deserialized from JSON, or null if no such item is
     *     present.
     */
    provider.getItem = function getItem(key) {

        // Attempt to refresh internal storage from localStorage
        try {
            if (window.localStorage)
                storedItems[key] = localStorage.getItem(key);
        }
        catch (ignore) {}

        // Pull and parse value from internal storage, if present
        var data = storedItems[key];
        if (data)
            return JSON.parse(data);

        // No value defined for given key
        return null;

    };

    // Factory method required by provider
    this.$get = ['$injector', function localStorageServiceFactory($injector) {

        // Pass through all get/set/remove calls to the provider
        // implementations of the same
        return {
            setItem    : provider.setItem,
            removeItem : provider.removeItem,
            getItem    : provider.getItem
        };

    }];

}]);
